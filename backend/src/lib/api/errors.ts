export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number = 500
  ) {
    super(message);
    this.name = "ApiError";
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError("UNAUTHORIZED", message, 401);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError("FORBIDDEN", message, 403);
  }

  static notFound(message = "Not found") {
    return new ApiError("NOT_FOUND", message, 404);
  }

  static validation(message: string) {
    return new ApiError("VALIDATION_ERROR", message, 400);
  }

  static conflict(message: string) {
    return new ApiError("CONFLICT", message, 409);
  }

  static internal(message = "Internal server error") {
    return new ApiError("INTERNAL_ERROR", message, 500);
  }
}
