import type { Session, User, UserRole } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { setCurrentCompanyId } from "@/lib/company/context";

export const USER_ROLES: UserRole[] = ["admin", "accountant", "hr"];

export const SESSION_REFRESH_EVENT = "ipms-session-refresh";

type ApiResult<T> = { success: true; data: T } | { success: false; error: { message: string } };

async function parseApi<T>(res: Response): Promise<T | null> {
  const json = (await res.json()) as ApiResult<T>;
  if (!json.success) return null;
  return json.data;
}

export async function getSession(): Promise<Session | null> {
  const res = await fetch("/api/auth/session", { credentials: "include" });
  if (!res.ok) return null;
  const session = await parseApi<Session>(res);
  if (session?.companyId) {
    setCurrentCompanyId(session.companyId);
  }
  return session;
}

export async function login(email: string, password: string): Promise<Session | null> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return null;
  return getSession();
}

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  mode: "create" | "join";
  companyName?: string;
  companySlug?: string;
  inviteCode?: string;
}

export async function signUp(input: SignUpInput): Promise<Session | null> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = (await res.json()) as ApiResult<never>;
    throw new Error(json.success ? "Signup failed" : json.error.message);
  }
  const session = await parseApi<Session>(res);
  if (session?.companyId) {
    setCurrentCompanyId(session.companyId);
  }
  return session;
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function getUsers(): Promise<User[]> {
  const res = await fetch("/api/admin/users", { credentials: "include" });
  if (!res.ok) return [];
  return (await parseApi<User[]>(res)) ?? [];
}

export async function createUser(
  data: { name: string; email: string; role: UserRole; password: string },
  _actorId: string,
  _actorName: string
): Promise<User> {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const json = (await res.json()) as ApiResult<User>;
  if (!json.success) {
    throw new Error(json.error.message);
  }
  return json.data;
}

export async function updateUser(
  id: string,
  data: Partial<{ name: string; email: string; role: UserRole; password: string }>,
  _actorId: string,
  _actorName: string
): Promise<User | null> {
  const res = await fetch("/api/admin/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id, ...data }),
  });
  const json = (await res.json()) as ApiResult<User>;
  if (!json.success) {
    throw new Error(json.error.message);
  }
  return json.data;
}

export async function deleteUser(
  id: string,
  _actorId: string,
  _actorName: string
): Promise<boolean> {
  const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  const json = (await res.json()) as ApiResult<{ deleted: boolean }>;
  if (!json.success) {
    throw new Error(json.error.message);
  }
  return true;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, avatar, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!profile) return undefined;

  const session = await getSession();
  let role: UserRole = "accountant";
  if (session?.companyId) {
    const { data: membership } = await supabase
      .from("company_members")
      .select("role")
      .eq("user_id", id)
      .eq("company_id", session.companyId)
      .maybeSingle();
    if (membership?.role) role = membership.role as UserRole;
  }

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role,
    avatar: profile.avatar ?? undefined,
    createdAt: profile.created_at,
  };
}

/** @deprecated No-op — session is managed by Supabase httpOnly cookies */
export function setSession(_session: Session | null): void {}
