import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { none, some, type AgencyTheme, type Option } from "@repo/types";
import * as schema from "./schema.js";

export * from "./schema.js";

/**
 * Data-access primitives. apps/api imports query builders (eq, and, …) from
 * HERE, never from "drizzle-orm" directly — this keeps a single drizzle-orm
 * type identity across the ESM/CJS boundary (dual-package hazard otherwise).
 */
export { and, asc, desc, eq, gt, gte, lt, lte, ne, or, sql } from "drizzle-orm";

export type Database = ReturnType<typeof createDb>;

/** Single DB client factory. Connection string comes from env — never hardcoded. */
export function createDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

/**
 * Read boundary: the nullable logo_url column becomes an explicit Option in
 * the domain model. No null leaks past this function.
 */
export function toAgencyTheme(row: {
  agencyName: string;
  primaryColor: string;
  logoUrl: string | null;
  careLinePhone: string | null;
}): AgencyTheme {
  const logoUrl: Option<string> = row.logoUrl === null ? none() : some(row.logoUrl);
  const base = {
    agencyName: row.agencyName,
    primaryColor: row.primaryColor,
  };
  const withLogo = logoUrl.kind === "some" ? { ...base, logoUrl: logoUrl.value } : base;
  return row.careLinePhone === null ? withLogo : { ...withLogo, careLinePhone: row.careLinePhone };
}
