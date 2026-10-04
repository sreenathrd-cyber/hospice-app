import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  asc,
  eq,
  patients,
  users,
  visits,
  type Database,
} from "@repo/db";
import {
  isTeamRole,
  patientDirectoryEntrySchema,
  scheduleVisitRequestSchema,
  visitJoinResponseSchema,
  visitListItemSchema,
  visitsQuerySchema,
  type PatientDirectoryEntry,
  type ScheduleVisitRequest,
  type VisitJoinResponse,
  type VisitListItem,
  type VisitsQuery,
} from "@repo/types";
import { z } from "zod";
import { DB_CLIENT } from "../db/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import { callerMaySeePatient, familyPatientIds } from "../common/patient-access.js";
import type { RequestAuth } from "../tenant/tenant.guard.js";
import { TelnyxService } from "../telnyx/telnyx.service.js";

/**
 * Visits: the team schedules, family and team join. Video visits run on
 * Telnyx Video Rooms — the server creates the room and mints short-lived
 * client tokens; the API key never leaves the server. Without a valid
 * Telnyx key, join fails loudly (telnyx_not_configured / telnyx_request_failed).
 */
@Injectable()
export class VisitsService {
  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    private readonly telnyx: TelnyxService,
    private readonly audit: AuditService,
  ) {}

  private requireTeam(auth: RequestAuth): void {
    if (!isTeamRole(auth.role)) {
      throw new ForbiddenException({ code: "forbidden", message: "Care team only" });
    }
  }

  private async requireVisitInTenant(auth: RequestAuth, visitId: string) {
    const visit = await this.db.query.visits.findFirst({
      where: and(eq(visits.id, visitId), eq(visits.tenantId, auth.tenantId)),
    });
    if (!visit) {
      throw new NotFoundException({ code: "not_found", message: "Visit not found" });
    }
    return visit;
  }

  /** Care team schedules a visit. The clinician defaults to the scheduler. */
  async schedule(auth: RequestAuth, body: ScheduleVisitRequest): Promise<VisitListItem> {
    this.requireTeam(auth);
    const parsed = scheduleVisitRequestSchema.parse(body);

    const patient = await this.db.query.patients.findFirst({
      where: and(eq(patients.id, parsed.patientId), eq(patients.tenantId, auth.tenantId)),
    });
    if (!patient) {
      throw new NotFoundException({ code: "not_found", message: "Patient not found" });
    }

    const clinicianId = parsed.clinicianId ?? auth.userId;
    const clinician = await this.db.query.users.findFirst({
      where: and(eq(users.id, clinicianId), eq(users.tenantId, auth.tenantId)),
    });
    if (!clinician || !isTeamRole(clinician.role as RequestAuth["role"])) {
      throw new NotFoundException({ code: "not_found", message: "Clinician not found" });
    }

    const [visit] = await this.db
      .insert(visits)
      .values({
        tenantId: auth.tenantId,
        patientId: parsed.patientId,
        clinicianId,
        visitType: parsed.visitType,
        scheduledAt: new Date(parsed.scheduledAt),
      })
      .returning();
    if (!visit) {
      throw new InternalServerErrorException({
        code: "schedule_failed",
        message: "Couldn't schedule the visit. Try again.",
      });
    }
    return visitListItemSchema.parse(toListItem(visit, patient.displayName, clinician.displayName));
  }

  /** Upcoming visits — team sees the tenant's, family sees their patients'. */
  async list(auth: RequestAuth, query: VisitsQuery): Promise<VisitListItem[]> {
    const { patientId } = visitsQuerySchema.parse(query);

    const rows = await this.db
      .select({ visit: visits, patientName: patients.displayName, clinicianName: users.displayName })
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .innerJoin(users, eq(visits.clinicianId, users.id))
      .where(
        and(
          eq(visits.tenantId, auth.tenantId),
          patientId ? eq(visits.patientId, patientId) : undefined,
        ),
      )
      .orderBy(asc(visits.scheduledAt));

    const items = rows.map((r) =>
      visitListItemSchema.parse(toListItem(r.visit, r.patientName, r.clinicianName)),
    );
    await this.audit.log(auth.tenantId, auth.userId, "view", "visit", patientId ?? "list");
    if (isTeamRole(auth.role)) return items;
    const allowed = await familyPatientIds(this.db, auth);
    return items.filter((i) => allowed.includes(i.patientId));
  }

  /**
   * Join a video visit. Creates the Telnyx room on first join, mints a
   * short-lived client token, and marks the visit in progress. The mobile app
   * opens joinUrl in a WebView — the hosted page runs the Telnyx video SDK.
   */
  async join(auth: RequestAuth, visitId: string): Promise<VisitJoinResponse> {
    const visit = await this.requireVisitInTenant(auth, visitId);
    if (!(await callerMaySeePatient(this.db, auth, visit.patientId))) {
      throw new ForbiddenException({ code: "forbidden", message: "Not your visit" });
    }
    if (visit.visitType !== "video") {
      throw new ForbiddenException({ code: "forbidden", message: "Not a video visit" });
    }
    if (visit.status === "completed" || visit.status === "cancelled") {
      throw new ForbiddenException({ code: "forbidden", message: "Visit is over" });
    }

    let roomId = visit.telnyxRoomId;
    if (!roomId) {
      roomId = (await this.telnyx.createVideoRoom()).roomId;
      await this.db.update(visits).set({ telnyxRoomId: roomId }).where(eq(visits.id, visit.id));
    }
    const { token } = await this.telnyx.createClientToken(roomId);
    await this.db
      .update(visits)
      .set({ status: "in_progress" })
      .where(eq(visits.id, visit.id));

    const webUrl = process.env.WEB_URL;
    if (!webUrl) {
      throw new InternalServerErrorException({
        code: "web_url_not_configured",
        message: "Video visits are not configured",
      });
    }
    const joinUrl = `${webUrl.replace(/\/$/, "")}/visit/join?roomId=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`;
    return visitJoinResponseSchema.parse({
      roomId,
      token,
      joinUrl,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  }

  /** Care team marks a visit complete. */
  async complete(auth: RequestAuth, visitId: string): Promise<{ ok: true }> {
    this.requireTeam(auth);
    await this.requireVisitInTenant(auth, visitId);
    await this.db.update(visits).set({ status: "completed" }).where(eq(visits.id, visitId));
    return { ok: true };
  }

  /** Minimal patient directory for the team scheduler. */
  async patientDirectory(auth: RequestAuth): Promise<PatientDirectoryEntry[]> {
    this.requireTeam(auth);
    const rows = await this.db
      .select({ id: patients.id, displayName: patients.displayName })
      .from(patients)
      .where(eq(patients.tenantId, auth.tenantId))
      .orderBy(asc(patients.displayName));
    return z.array(patientDirectoryEntrySchema).parse(rows);
  }
}

function toListItem(
  v: {
    id: string;
    patientId: string;
    clinicianId: string;
    visitType: "in_person" | "video" | "phone";
    status: "scheduled" | "in_progress" | "completed" | "cancelled";
    scheduledAt: Date;
    telnyxRoomId: string | null;
    createdAt: Date;
  },
  patientName: string,
  clinicianName: string,
) {
  return {
    id: v.id,
    patientId: v.patientId,
    clinicianId: v.clinicianId,
    visitType: v.visitType,
    status: v.status,
    scheduledAt: v.scheduledAt.toISOString(),
    telnyxRoomId: v.telnyxRoomId ?? undefined,
    createdAt: v.createdAt.toISOString(),
    patientName,
    clinicianName,
  };
}
