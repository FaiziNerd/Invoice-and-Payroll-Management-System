import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/api/response";
import { slugify } from "@/lib/auth/slug";
import {
  ACTIVE_COMPANY_COOKIE,
  buildAppSession,
} from "@/lib/auth/server-session";
import { recordAuditLog } from "@/lib/server/record-audit-log";
import { ensureCompanyTemplates } from "@/lib/server/ensure-company-templates";

const signupSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
    companyName: z.string().min(1),
    companySlug: z.string().min(1).optional(),
  }),
  z.object({
    mode: z.literal("join"),
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
    inviteCode: z.string().min(32, "A valid invite code is required"),
  }),
]);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Invalid input", 400);
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name },
  });

  if (createError || !created.user) {
    const message = createError?.message ?? "Failed to create user";
    if (message.toLowerCase().includes("already")) {
      return fail("CONFLICT", "An account with this email already exists", 409);
    }
    return fail("INTERNAL_ERROR", message, 500);
  }

  const userId = created.user.id;
  let companyId: string;
  let memberRole: "admin" | "accountant" | "hr" = "admin";

  if (input.mode === "create") {
    const slug = input.companySlug?.trim() || slugify(input.companyName);
    if (!slug) {
      await admin.auth.admin.deleteUser(userId);
      return fail("VALIDATION_ERROR", "Company slug is required", 400);
    }

    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({ name: input.companyName.trim(), slug })
      .select("id")
      .single();

    if (companyError || !company) {
      await admin.auth.admin.deleteUser(userId);
      return fail("INTERNAL_ERROR", companyError?.message ?? "Failed to create company", 500);
    }

    companyId = company.id;

    await admin.from("organization_settings").insert({
      company_id: companyId,
      name: input.companyName.trim(),
    });

    await ensureCompanyTemplates(companyId, admin);

    const { error: memberError } = await admin.from("company_members").insert({
      company_id: companyId,
      user_id: userId,
      role: "admin",
    });

    if (memberError) {
      await admin.auth.admin.deleteUser(userId);
      return fail("INTERNAL_ERROR", memberError.message, 500);
    }
  } else {
    const inviteToken = input.inviteCode.trim().toLowerCase();

    const { data: invite, error: inviteError } = await admin
      .from("company_invites")
      .select("id, company_id, role, used_at, expires_at")
      .eq("token", inviteToken)
      .maybeSingle();

    if (inviteError) {
      await admin.auth.admin.deleteUser(userId);
      return fail("INTERNAL_ERROR", inviteError.message, 500);
    }

    if (!invite) {
      await admin.auth.admin.deleteUser(userId);
      return fail("NOT_FOUND", "Invalid or expired invite code", 404);
    }

    if (invite.used_at) {
      await admin.auth.admin.deleteUser(userId);
      return fail("CONFLICT", "This invite code has already been used", 409);
    }

    if (new Date(invite.expires_at) < new Date()) {
      await admin.auth.admin.deleteUser(userId);
      return fail("VALIDATION_ERROR", "This invite code has expired", 400);
    }

    companyId = invite.company_id;
    memberRole = invite.role as "admin" | "accountant" | "hr";

    const { error: memberError } = await admin.from("company_members").insert({
      company_id: companyId,
      user_id: userId,
      role: memberRole,
    });

    if (memberError) {
      await admin.auth.admin.deleteUser(userId);
      return fail("INTERNAL_ERROR", memberError.message, 500);
    }

    const { error: useError } = await admin
      .from("company_invites")
      .update({ used_by: userId, used_at: new Date().toISOString() })
      .eq("id", invite.id)
      .is("used_at", null);

    if (useError) {
      await admin.from("company_members").delete().eq("user_id", userId).eq("company_id", companyId);
      await admin.auth.admin.deleteUser(userId);
      return fail("CONFLICT", "Invite code was already used", 409);
    }
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (signInError) {
    return fail(
      "INTERNAL_ERROR",
      "Account created but sign-in failed. Please log in manually.",
      500
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("INTERNAL_ERROR", "Account created but session could not be established.", 500);
  }

  await recordAuditLog(supabase, {
    companyId,
    userId: user.id,
    userName: input.name.trim(),
    action: "create",
    entity: "user",
    entityId: user.id,
    description:
      input.mode === "create"
        ? `${input.name.trim()} created company and signed up as admin`
        : `${input.name.trim()} joined via invite as ${memberRole}`,
  });

  const session = await buildAppSession(supabase, user, companyId);
  if (!session) {
    return fail("INTERNAL_ERROR", "Failed to load session after signup.", 500);
  }

  const response = ok(session);
  response.cookies.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
