import { randomBytes } from "crypto";

/** 256-bit cryptographically secure invite token (64 hex chars). */
export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

/** 256-bit cryptographically secure invoice share token (64 hex chars). */
export function generateSecureShareToken(): string {
  return randomBytes(32).toString("hex");
}
