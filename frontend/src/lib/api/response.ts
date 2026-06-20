import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(code: ApiErrorCode, message: string, status?: number) {
  const statusCode =
    status ??
    (code === "UNAUTHORIZED"
      ? 401
      : code === "FORBIDDEN"
        ? 403
        : code === "NOT_FOUND"
          ? 404
          : code === "VALIDATION_ERROR"
            ? 400
            : code === "CONFLICT"
              ? 409
              : code === "RATE_LIMITED"
                ? 429
                : 500);
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status: statusCode }
  );
}
