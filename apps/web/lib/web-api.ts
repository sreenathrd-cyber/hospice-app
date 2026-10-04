import {
  alertListItemSchema,
  err,
  ok,
  requestCodeResponseSchema,
  verifyCodeResponseSchema,
  type AlertListItem,
  type Result,
} from "@repo/types";
import { z } from "zod";

/**
 * Client-side API access for the team dashboard. The bearer token lives in
 * localStorage — acceptable for the pilot, but the production hardening is
 * an httpOnly cookie set by a Next.js route handler proxying /auth/*, so the
 * token never touches JavaScript. Every response is zod-parsed; nothing
 * unvalidated reaches the UI.
 */
const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const SESSION_KEY = "hospice.web.session";

export type WebSession = {
  token: string;
  role: string;
  agencyName: string;
  primaryColor: string;
};

export function loadSession(): WebSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = z
      .object({
        token: z.string().min(1),
        role: z.string(),
        agencyName: z.string(),
        primaryColor: z.string(),
      })
      .safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveSession(session: WebSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

async function authed<T>(session: WebSession, path: string, parse: (raw: unknown) => T): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/v1${path}`, {
      headers: { Authorization: `Bearer ${session.token}` },
      cache: "no-store",
    });
  } catch {
    return err("network_error", "Couldn't reach the server. Check your connection.");
  }
  if (res.status === 401) return err("unauthorized", "Your session expired. Sign in again.");
  if (!res.ok) return err("request_failed", `Server returned ${res.status}.`);
  const parsed = parse(await res.json().catch(() => ({})));
  return ok(parsed);
}

export async function requestCode(phone: string): Promise<Result<{ sent: boolean }>> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/v1/auth/request-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
  } catch {
    return err("network_error", "Couldn't reach the server. Check your connection.");
  }
  if (!res.ok) return err("request_failed", "Couldn't send the code. Try again.");
  const parsed = requestCodeResponseSchema.safeParse(await res.json());
  if (!parsed.success) return err("bad_response", "Unexpected server response.");
  return ok({ sent: parsed.data.sent });
}

export async function verifyCode(phone: string, code: string): Promise<Result<WebSession>> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/v1/auth/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
  } catch {
    return err("network_error", "Couldn't reach the server. Check your connection.");
  }
  if (!res.ok) return err("invalid_code", "That code didn't work. Try again.");
  const parsed = verifyCodeResponseSchema.safeParse(await res.json());
  if (!parsed.success) return err("bad_response", "Unexpected server response.");
  const d = parsed.data;
  return ok({
    token: d.token,
    role: d.role,
    agencyName: d.theme.agencyName,
    primaryColor: d.theme.primaryColor,
  });
}

export function listAlerts(session: WebSession): Promise<Result<AlertListItem[]>> {
  return authed(session, "/alerts", (raw) => z.array(alertListItemSchema).parse(raw));
}

const okSchema = z.object({ ok: z.literal(true) });

export function acknowledgeAlert(session: WebSession, alertId: string): Promise<Result<{ ok: true }>> {
  return authed(session, `/alerts/${encodeURIComponent(alertId)}/acknowledge`, (raw) =>
    okSchema.parse(raw),
  );
}

/* ---------------- Audit trail (admin) ---------------- */

const auditLogEntrySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorName: z.string(),
  action: z.string(),
  recordType: z.string(),
  recordId: z.string(),
  createdAt: z.string().datetime(),
});
export type WebAuditEntry = z.infer<typeof auditLogEntrySchema>;

export type AuditFilters = {
  recordType?: string;
  from?: string;
  to?: string;
};

export function queryAuditLog(
  session: WebSession,
  filters: AuditFilters = {},
): Promise<Result<WebAuditEntry[]>> {
  const params = new URLSearchParams({ limit: "100" });
  if (filters.recordType) params.set("recordType", filters.recordType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return authed(session, `/admin/audit-log?${params.toString()}`, (raw) =>
    z.array(auditLogEntrySchema).parse(raw),
  );
}
