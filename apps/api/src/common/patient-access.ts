import { and, eq, enrollments, patients, type Database } from "@repo/db";
import type { RequestAuth } from "../tenant/tenant.guard.js";

/**
 * Patient ids the caller's family may act on: their own record (patient role)
 * or the patients they're enrolled with (caregiver role). Team roles get an
 * empty list — they don't act "as family".
 */
export async function familyPatientIds(db: Database, auth: RequestAuth): Promise<string[]> {
  if (auth.role === "patient") {
    const rows = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.tenantId, auth.tenantId), eq(patients.userId, auth.userId)));
    return rows.map((r) => r.id);
  }
  if (auth.role === "caregiver") {
    const rows = await db
      .select({ patientId: enrollments.patientId })
      .from(enrollments)
      .innerJoin(patients, eq(enrollments.patientId, patients.id))
      .where(
        and(eq(enrollments.caregiverUserId, auth.userId), eq(patients.tenantId, auth.tenantId)),
      );
    return rows.map((r) => r.patientId);
  }
  return [];
}

/** True when the caller is on the care team or in the patient's family. */
export async function callerMaySeePatient(
  db: Database,
  auth: RequestAuth,
  patientId: string,
): Promise<boolean> {
  if (auth.role === "clinician" || auth.role === "admin") return true;
  return (await familyPatientIds(db, auth)).includes(patientId);
}
