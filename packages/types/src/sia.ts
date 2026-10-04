import { z } from "zod";
import { patientIdSchema, siaEntryIdSchema, visitIdSchema } from "./branded.js";

/**
 * Service Intensity Add-on (SIA): qualifying in-person RN/MSW visits in the
 * last 7 days of life convert to 15-minute units. Video visits NEVER count.
 */
export const SIA_UNIT_MINUTES = 15;
export const SIA_RATE_PER_UNIT_DOLLARS = 17.44;
export const SIA_MAX_UNITS_PER_DAY = 16; // 4 combined RN+MSW hours/day cap
export const SIA_LOOKBACK_DAYS = 7;

export const siaClinicianRoleSchema = z.enum(["rn", "msw"]);
export type SiaClinicianRole = z.infer<typeof siaClinicianRoleSchema>;

export const siaEntrySchema = z.object({
  id: siaEntryIdSchema,
  visitId: visitIdSchema,
  clinicianRole: siaClinicianRoleSchema,
  /** SIA requires in-person time. The schema makes a video visit unrepresentable here. */
  inPerson: z.literal(true),
  minutes: z.number().int().min(1),
  occurredAt: z.string().datetime(),
});
export type SiaEntry = z.infer<typeof siaEntrySchema>;

/** Whole 15-minute units for one entry — CMS rounds up partial units. */
export function siaUnitsForEntry(minutes: number): number {
  return Math.ceil(minutes / SIA_UNIT_MINUTES);
}

/** Billable dollars for a day's units, enforcing the 4-hour (16-unit) daily cap. */
export function siaDollarsForDay(units: number): number {
  const capped = Math.min(units, SIA_MAX_UNITS_PER_DAY);
  return Math.round(capped * SIA_RATE_PER_UNIT_DOLLARS * 100) / 100;
}

export const createSiaEntryRequestSchema = z.object({
  visitId: visitIdSchema,
  clinicianRole: siaClinicianRoleSchema,
  minutes: z.number().int().min(1).max(24 * 60),
  occurredAt: z.string().datetime(),
});
export type CreateSiaEntryRequest = z.infer<typeof createSiaEntryRequestSchema>;

export const siaEntriesQuerySchema = z.object({
  patientId: patientIdSchema,
});
export type SiaEntriesQuery = z.infer<typeof siaEntriesQuerySchema>;

export const siaDaySummarySchema = z.object({
  /** Calendar date (YYYY-MM-DD) in the agency's timezone. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.number().int().min(0),
  units: z.number().int().min(0),
  cappedUnits: z.number().int().min(0),
  dollars: z.number().min(0),
});
export type SiaDaySummary = z.infer<typeof siaDaySummarySchema>;

/**
 * Potential SIA for a patient across captured entries, grouped by day with
 * the 16-unit daily cap applied. "Potential" because the 7-day end-of-life
 * lookback is a billing determination — capture's job is to not lose minutes.
 * Pure: the API fetches entries, this computes the money.
 */
export const siaSummarySchema = z.object({
  patientId: patientIdSchema,
  totalMinutes: z.number().int().min(0),
  totalUnits: z.number().int().min(0),
  cappedUnits: z.number().int().min(0),
  dollars: z.number().min(0),
  days: z.array(siaDaySummarySchema),
});
export type SiaSummary = z.infer<typeof siaSummarySchema>;

export function siaSummaryForEntries(
  patientId: SiaSummary["patientId"],
  entries: { minutes: number; occurredAt: string }[],
): SiaSummary {
  const byDay = new Map<string, number>();
  for (const e of entries) {
    const date = e.occurredAt.slice(0, 10);
    byDay.set(date, (byDay.get(date) ?? 0) + e.minutes);
  }
  const days: SiaDaySummary[] = [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, minutes]) => {
      const units = siaUnitsForEntry(minutes);
      const cappedUnits = Math.min(units, SIA_MAX_UNITS_PER_DAY);
      return { date, minutes, units, cappedUnits, dollars: siaDollarsForDay(units) };
    });
  const totalMinutes = days.reduce((s, d) => s + d.minutes, 0);
  const totalUnits = days.reduce((s, d) => s + d.units, 0);
  const cappedUnits = days.reduce((s, d) => s + d.cappedUnits, 0);
  const dollars = Math.round(days.reduce((s, d) => s + d.dollars, 0) * 100) / 100;
  return { patientId, totalMinutes, totalUnits, cappedUnits, dollars, days };
}
