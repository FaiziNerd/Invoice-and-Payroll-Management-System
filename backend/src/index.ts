/**
 * Backend entry point.
 * HTTP routing will be added here (or under src/routes/) as modules are built.
 */
export { ok, fail, fromError, type ApiResponse } from "./lib/api/response.js";
export { ApiError } from "./lib/api/errors.js";
export { getEnv } from "./config/env.js";
export { createAdminClient } from "./lib/supabase/admin.js";
export { createAnonClient } from "./lib/supabase/anon.js";
