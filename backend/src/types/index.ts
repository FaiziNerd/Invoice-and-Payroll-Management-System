/** Re-export API response shapes used by both backend routes and frontend fetchers. */
export type {
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiErrorBody,
} from "../lib/api/response.js";

export type { ApiErrorCode } from "../lib/api/errors.js";
