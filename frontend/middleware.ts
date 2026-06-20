import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import {
  AUTH_API_PATHS,
  PROTECTED_PREFIXES,
  PUBLIC_PATHS,
  PUBLIC_PREFIXES,
} from "@/lib/auth/constants";

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedAppRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createMiddlewareClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (AUTH_API_PATHS.has(pathname)) {
      return response;
    }
    if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return response;
    }
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }
    return response;
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!user && isProtectedAppRoute(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!user && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
