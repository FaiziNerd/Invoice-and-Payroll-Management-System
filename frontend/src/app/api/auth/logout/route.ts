import { createClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/api/response";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/auth/server-session";

export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  const response = ok({ signedOut: true });
  response.cookies.set(ACTIVE_COMPANY_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
