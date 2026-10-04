import { err, healthResponseSchema, ok, type Result } from "@repo/types";

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";

/**
 * Server-side API access for the web portal. Runs in Server Components /
 * Route Handlers only — never imported by a "use client" component, so no
 * API URL or response ever leaks into the client bundle beyond what we render.
 */
export async function checkApiHealth(): Promise<Result<{ reachable: boolean }>> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/v1/health`, { cache: "no-store" });
  } catch {
    return err("network_error", "API unreachable");
  }
  if (!res.ok) return err("request_failed", `API returned ${res.status}`);
  const parsed = healthResponseSchema.safeParse(await res.json());
  if (!parsed.success) return err("bad_response", "API returned an unexpected response");
  return ok({ reachable: true });
}
