export const ACTIVE_COMPANY_COOKIE = "ipms-active-company";

/** Routes accessible without authentication */
export const PUBLIC_PATHS = new Set(["/", "/login", "/signup"]);

export const PUBLIC_PREFIXES = ["/share/invoice/", "/api/shared/"];

export const AUTH_API_PATHS = new Set([
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
]);

export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/invoices",
  "/clients",
  "/designer",
  "/employees",
  "/departments",
  "/payroll",
  "/salary-slips",
  "/admin",
  "/portal",
  "/pending-approval",
];
