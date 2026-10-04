import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, siaEntries, visits, type Database } from "@repo/db";
import {
  createSiaEntryRequestSchema,
  isTeamRole,
  siaEntriesQuerySchema,
  siaEntrySchema,
  siaSummaryForEntries,
  siaSummarySchema,
  type CreateSiaEntryRequest,
  type SiaEntriesQuery,
  type SiaEntry,
  type SiaSummary,
} from "@repo/types";
import { DB_CLIENT } from "../db/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import type { RequestAuth } from "../tenant/tenant.guard.js";

/**
 * SIA capture: the team logs in-person RN/MSW minutes per visit; the API
 * returns the computed unit/dollar summary. Video visits are unrepresentable
 * here — the entry endpoint rejects non-in-person visits, and the schema
 * pins inPerson: true.
 */
@Injectable()
export class SiaService {
  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  private requireTeam(auth: RequestAuth): void {
    if (!isTeamRole(auth.role)) {
      throw new ForbiddenException({ code: "forbidden", message: "Care team only" });
    }
  }

  /** Log timed minutes against an in-person visit. */
  async createEntry(auth: RequestAuth, body: CreateSiaEntryRequest): Promise<SiaEntry> {
    this.requireTeam(auth);
    const parsed = createSiaEntryRequestSchema.parse(body);

    const visit = await this.db.query.visits.findFirst({
      where: and(eq(visits.id, parsed.visitId), eq(visits.tenantId, auth.tenantId)),
    });
    if (!visit) {
      throw new NotFoundException({ code: "not_found", message: "Visit not found" });
    }
    if (visit.visitType !== "in_person") {
      throw new ForbiddenException({
        code: "forbidden",
        message: "SIA only counts in-person visits — video and phone visits never qualify",
      });
    }

    const [entry] = await this.db
      .insert(siaEntries)
      .values({
        tenantId: auth.tenantId,
        visitId: parsed.visitId,
        clinicianRole: parsed.clinicianRole,
        minutes: parsed.minutes,
        occurredAt: new Date(parsed.occurredAt),
      })
      .returning();
    if (!entry) {
      throw new InternalServerErrorException({
        code: "sia_failed",
        message: "Couldn't save the timed entry. Try again.",
      });
    }
    return siaEntrySchema.parse({
      id: entry.id,
      visitId: entry.visitId,
      clinicianRole: entry.clinicianRole,
      inPerson: true,
      minutes: entry.minutes,
      occurredAt: entry.occurredAt.toISOString(),
    });
  }

  /** Timed entries for a patient, newest first. */
  async entriesForPatient(auth: RequestAuth, query: SiaEntriesQuery): Promise<SiaEntry[]> {
    this.requireTeam(auth);
    const { patientId } = siaEntriesQuerySchema.parse(query);

    const rows = await this.db
      .select({ entry: siaEntries })
      .from(siaEntries)
      .innerJoin(visits, eq(siaEntries.visitId, visits.id))
      .where(and(eq(siaEntries.tenantId, auth.tenantId), eq(visits.patientId, patientId)))
      .orderBy(desc(siaEntries.occurredAt));
    return rows.map((r) =>
      siaEntrySchema.parse({
        id: r.entry.id,
        visitId: r.entry.visitId,
        clinicianRole: r.entry.clinicianRole,
        inPerson: true,
        minutes: r.entry.minutes,
        occurredAt: r.entry.occurredAt.toISOString(),
      }),
    );
  }

  /** Computed SIA summary: units and dollars with the daily cap applied. */
  async summaryForPatient(auth: RequestAuth, query: SiaEntriesQuery): Promise<SiaSummary> {
    const entries = await this.entriesForPatient(auth, query);
    const { patientId } = siaEntriesQuerySchema.parse(query);
    await this.audit.log(auth.tenantId, auth.userId, "view", "sia_entry", patientId);
    return siaSummarySchema.parse(
      siaSummaryForEntries(patientId, entries.map((e) => ({ minutes: e.minutes, occurredAt: e.occurredAt }))),
    );
  }
}
