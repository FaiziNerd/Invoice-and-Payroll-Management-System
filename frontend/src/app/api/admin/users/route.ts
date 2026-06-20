import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/api/response";
import { ACTIVE_COMPANY_COOKIE, readActiveCompanyCookie } from "@/lib/auth/server-session";
import type { UserRole } from "@/types";

async function requireCompanyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: fail("UNAUTHORIZED", "Not authenticated", 401) };

  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const companyId = readActiveCompanyCookie(cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value);
  if (!companyId) {
    return { error: fail("VALIDATION_ERROR", "No active company selected", 400) };
  }

  const { data: membership } = await supabase
    .from("company_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!membership || membership.role !== "admin") {
    return { error: fail("FORBIDDEN", "Admin access required", 403) };
  }

  return { supabase, admin: createAdminClient(), user, companyId };
}

export async function GET() {
  const ctx = await requireCompanyAdmin();
  if ("error" in ctx && ctx.error) return ctx.error;
  const { supabase, companyId } = ctx as Exclude<typeof ctx, { error: unknown }>;

  const { data: members, error } = await supabase
    .from("company_members")
    .select("user_id, role, created_at")
    .eq("company_id", companyId);

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  const userIds = (members ?? []).map((m) => m.user_id);
  if (userIds.length === 0) {
    return ok([]);
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, name, email, avatar, created_at")
    .in("id", userIds);

  if (profilesError) {
    return fail("INTERNAL_ERROR", profilesError.message, 500);
  }

  const roleByUser = new Map((members ?? []).map((m) => [m.user_id, m.role]));

  const users = (profiles ?? []).map((profile) => ({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: (roleByUser.get(profile.id) ?? "accountant") as UserRole,
    avatar: profile.avatar ?? undefined,
    createdAt: profile.created_at,
  }));

  return ok(users);
}

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "accountant", "hr"]),
});

export async function POST(request: Request) {
  const ctx = await requireCompanyAdmin();
  if ("error" in ctx && ctx.error) return ctx.error;
  const { admin, companyId } = ctx as Exclude<typeof ctx, { error: unknown }>;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const input = parsed.data;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name },
  });

  if (createError || !created.user) {
    return fail("CONFLICT", createError?.message ?? "Failed to create user", 409);
  }

  const { error: memberError } = await admin.from("company_members").insert({
    company_id: companyId,
    user_id: created.user.id,
    role: input.role,
  });

  if (memberError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return fail("INTERNAL_ERROR", memberError.message, 500);
  }

  return ok({
    id: created.user.id,
    name: input.name,
    email: input.email,
    role: input.role,
    createdAt: new Date().toISOString(),
  });
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "accountant", "hr"]).optional(),
  password: z.string().min(6).optional(),
});

export async function PATCH(request: Request) {
  const ctx = await requireCompanyAdmin();
  if ("error" in ctx && ctx.error) return ctx.error;
  const { admin, companyId } = ctx as Exclude<typeof ctx, { error: unknown }>;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { id, name, email, role, password } = parsed.data;

  if (name || email) {
    const updates: Record<string, string> = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    const { error } = await admin.from("profiles").update(updates).eq("id", id);
    if (error) return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (email || password) {
    const authUpdates: { email?: string; password?: string } = {};
    if (email) authUpdates.email = email;
    if (password) authUpdates.password = password;
    const { error } = await admin.auth.admin.updateUserById(id, authUpdates);
    if (error) return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (role) {
    const { error } = await admin
      .from("company_members")
      .update({ role })
      .eq("company_id", companyId)
      .eq("user_id", id);
    if (error) return fail("INTERNAL_ERROR", error.message, 500);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, email, avatar, created_at")
    .eq("id", id)
    .single();

  const { data: membership } = await admin
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", id)
    .single();

  return ok({
    id: profile?.id ?? id,
    name: profile?.name ?? name,
    email: profile?.email ?? email,
    role: (membership?.role ?? role) as UserRole,
    avatar: profile?.avatar ?? undefined,
    createdAt: profile?.created_at ?? new Date().toISOString(),
  });
}

export async function DELETE(request: Request) {
  const ctx = await requireCompanyAdmin();
  if ("error" in ctx && ctx.error) return ctx.error;
  const { admin, user, companyId } = ctx as Exclude<typeof ctx, { error: unknown }>;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return fail("VALIDATION_ERROR", "id query parameter is required", 400);
  }

  if (id === user.id) {
    return fail("VALIDATION_ERROR", "Cannot delete your own account while logged in", 400);
  }

  const { count } = await admin
    .from("company_members")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "admin");

  const { data: targetMember } = await admin
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", id)
    .maybeSingle();

  if (!targetMember) {
    return fail("NOT_FOUND", "User is not a member of this company", 404);
  }

  if (targetMember.role === "admin" && (count ?? 0) <= 1) {
    return fail("VALIDATION_ERROR", "Cannot delete the last admin user", 400);
  }

  const { error } = await admin
    .from("company_members")
    .delete()
    .eq("company_id", companyId)
    .eq("user_id", id);

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  return ok({ deleted: true });
}
