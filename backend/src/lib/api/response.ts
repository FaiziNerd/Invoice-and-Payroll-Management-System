import type { ApiErrorCode } from "./errors.js";
import { ApiError } from "./errors.js";

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorBody = {
  message: string;
  code: ApiErrorCode;
};

export type ApiErrorResponse = {
  success: false;
  error: ApiErrorBody;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function ok<T>(data: T): ApiSuccessResponse<T> {
  return { success: true, data };
}

export function fail(code: ApiErrorCode, message: string): ApiErrorResponse {
  return { success: false, error: { code, message } };
}

export function fromError(err: unknown): ApiErrorResponse {
  if (err instanceof ApiError) {
    return fail(err.code, err.message);
  }
  if (err instanceof Error) {
    return fail("INTERNAL_ERROR", err.message);
  }
  return fail("INTERNAL_ERROR", "Unknown error");
}

export function httpStatusFromCode(code: ApiErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION_ERROR":
      return 400;
    case "CONFLICT":
      return 409;
    default:
      return 500;
  }
}
