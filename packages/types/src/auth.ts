import { z } from "zod";
import { tenantIdSchema, userIdSchema } from "./branded.js";
import { userRoleSchema } from "./roles.js";
import { agencyThemeSchema } from "./tenant.js";

/**
 * Phone-code auth. No passwords: the agency registers the phone number, the
 * user proves possession via a 6-digit SMS code (sent through Telnyx).
 */

export const e164PhoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, "must be E.164 format");

export const requestCodeSchema = z.object({ phone: e164PhoneSchema });
export type RequestCode = z.infer<typeof requestCodeSchema>;

export const requestCodeResponseSchema = z.object({
  /**
   * Always true-shaped: the API never reveals whether a phone is registered.
   * Unknown numbers get { sent: false } and no SMS (anti-enumeration).
   */
  sent: z.boolean(),
});
export type RequestCodeResponse = z.infer<typeof requestCodeResponseSchema>;

export const verifyCodeSchema = z.object({
  phone: e164PhoneSchema,
  code: z.string().regex(/^\d{6}$/, "must be a 6-digit code"),
});
export type VerifyCode = z.infer<typeof verifyCodeSchema>;

export const verifyCodeResponseSchema = z.object({
  /** Opaque session token — shown once, stored hashed server-side. */
  token: z.string().min(1),
  userId: userIdSchema,
  role: userRoleSchema,
  tenantId: tenantIdSchema,
  theme: agencyThemeSchema,
});
export type VerifyCodeResponse = z.infer<typeof verifyCodeResponseSchema>;

/**
 * Email/password auth for web dashboard and mobile app.
 */
export const loginSchema = z.object({
  email: z.string().email("must be a valid email"),
  password: z.string().min(1, "password is required"),
});
export type Login = z.infer<typeof loginSchema>;

export const loginResponseSchema = verifyCodeResponseSchema;
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** Auth policy constants — the only place these numbers live. */
export const AUTH_POLICY = {
  codeTtlMinutes: 10,
  codeMaxAttempts: 5,
  codeResendCooldownSeconds: 60,
  sessionTtlDays: 30,
} as const;
