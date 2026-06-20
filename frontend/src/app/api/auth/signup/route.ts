import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/api/response";
import { slugify } from "@/lib/auth/slug";
import {
  ACTIVE_COMPANY_COOKIE,
  buildAppSession,
} from "@/lib/auth/server-session";

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
    joinSlug: z.string().min(1),
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

    const { seedCompanyTemplates } = await import("@/lib/server/seed-company-templates");
    await seedCompanyTemplates(admin, companyId, input.companyName.trim());

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
    const slug = slugify(input.joinSlug);
    const { data: company, error: lookupError } = await admin
      .from("companies")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (lookupError || !company) {
      await admin.auth.admin.deleteUser(userId);
      return fail("NOT_FOUND", "Company not found. Check the slug and try again.", 404);
    }

    companyId = company.id;

    const { error: memberError } = await admin.from("company_members").insert({
      company_id: companyId,
      user_id: userId,
      role: "accountant",
    });

    if (memberError) {
      await admin.auth.admin.deleteUser(userId);
      return fail("INTERNAL_ERROR", memberError.message, 500);
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
