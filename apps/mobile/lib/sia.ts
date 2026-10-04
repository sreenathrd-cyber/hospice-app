import {
  createSiaEntryRequestSchema,
  siaEntrySchema,
  siaSummarySchema,
  type CreateSiaEntryRequest,
  type Result,
  type SiaEntry,
  type SiaSummary,
} from "@repo/types";
import { z } from "zod";
import { apiGet, apiPost } from "./api-client";

/** SIA boundary — thin wrappers over the API client, nothing more. */

export function createSiaEntry(body: CreateSiaEntryRequest): Promise<Result<SiaEntry>> {
  const parsed = createSiaEntryRequestSchema.parse(body);
  return apiPost("/sia/entries", parsed, (raw) => siaEntrySchema.parse(raw));
}

export function siaEntries(patientId: string): Promise<Result<SiaEntry[]>> {
  return apiGet(`/sia/entries?patientId=${encodeURIComponent(patientId)}`, (raw) =>
    z.array(siaEntrySchema).parse(raw),
  );
}

export function siaSummary(patientId: string): Promise<Result<SiaSummary>> {
  return apiGet(`/sia/summary?patientId=${encodeURIComponent(patientId)}`, (raw) =>
    siaSummarySchema.parse(raw),
  );
}
