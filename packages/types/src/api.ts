import { z } from "zod";

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/**
 * Explicit result — no thrown exceptions across the client/server boundary,
 * no undefined. Every API client returns Result<T>.
 */
export type Result<T, E = ApiError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
  time: z.string().datetime(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
