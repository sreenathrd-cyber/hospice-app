import Constants from "expo-constants";
import { err, ok, type Result } from "@repo/types";
import { getSession } from "./session";

const baseUrl =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  "http://localhost:3001";

/**
 * The single HTTP boundary for the mobile app. Every request returns
 * Result<T> — no thrown exceptions, no undefined. Auth attaches from
 * SecureStore; a 401 means the session died mid-flow and the caller routes
 * back to sign-in (papercut: session-expiry mid-flow).
 */
async function request<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body: unknown,
  parse: (raw: unknown) => T,
): Promise<Result<T>> {
  const session = await getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session.kind === "some") {
    headers["Authorization"] = `Bearer ${session.value.token}`;
    headers["x-tenant-id"] = session.value.tenantId;
  }
  let res: Response;
  try {
    const init: RequestInit = { method, headers };
    if (method === "POST") {
      init.body = JSON.stringify(body);
    }
    res = await fetch(`${baseUrl}/api/v1${path}`, init);
  } catch {
    return err("network_error", "Couldn't reach the server. Check your connection and try again.");
  }
  if (res.status === 401) {
    return err("unauthorized", "Your session expired. Please sign in again.");
  }
  if (!res.ok) {
    return err("request_failed", `The request failed (status ${res.status}). Please try again.`);
  }
  try {
    return ok(parse(await res.json()));
  } catch {
    return err("bad_response", "The server returned something unexpected. Please try again.");
  }
}

export function apiGet<T>(path: string, parse: (raw: unknown) => T): Promise<Result<T>> {
  return request("GET", path, undefined, parse);
}

export function apiPost<T>(
  path: string,
  body: unknown,
  parse: (raw: unknown) => T,
): Promise<Result<T>> {
  return request("POST", path, body, parse);
}

export function apiPatch<T>(
  path: string,
  body: unknown,
  parse: (raw: unknown) => T,
): Promise<Result<T>> {
  return request("PATCH", path, body, parse);
}
