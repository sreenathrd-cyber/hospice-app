import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, idgSessions, type Database } from "@repo/db";
import {
  canTransitionIdg,
  completeIdgSessionRequestSchema,
  createIdgSessionRequestSchema,
  idgAttendeeSchema,
  idgReadyToRecord,
  idgSectionsSchema,
  idgSessionSchema,
  isTeamRole,
  recordIdgConsentRequestSchema,
  type CompleteIdgSessionRequest,
  type CreateIdgSessionRequest,
  type IdgAttendee,
  type IdgSession,
  type RecordIdgConsentRequest,
} from "@repo/types";
import { z } from "zod";
import { DB_CLIENT } from "../db/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import type { RequestAuth } from "../tenant/tenant.guard.js";

/**
 * IDG ambient capture. Consent is per-session and per-attendee: the session
 * can't start recording until every listed attendee has consented. The
 * transcript enters as text until a speech-to-text provider is configured.
 */
@Injectable()
export class IdgService {
  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  private requireTeam(auth: RequestAuth): void {
    if (!isTeamRole(auth.role)) {
      throw new ForbiddenException({ code: "forbidden", message: "Care team only" });
    }
  }

  private async requireSession(auth: RequestAuth, sessionId: string) {
    const session = await this.db.query.idgSessions.findFirst({
      where: and(eq(idgSessions.id, sessionId), eq(idgSessions.tenantId, auth.tenantId)),
    });
    if (!session) {
      throw new NotFoundException({ code: "not_found", message: "IDG session not found" });
    }
    return session;
  }

  /** Schedule an IDG session with its attendee list. Everyone starts unconsented. */
  async createSession(auth: RequestAuth, body: CreateIdgSessionRequest): Promise<IdgSession> {
    this.requireTeam(auth);
    const parsed = createIdgSessionRequestSchema.parse(body);
    const attendees: IdgAttendee[] = parsed.attendees.map((a) => ({
      name: a.name,
      role: a.role,
      consentedAt: null,
    }));
    const [session] = await this.db
      .insert(idgSessions)
      .values({
        tenantId: auth.tenantId,
        scheduledAt: new Date(parsed.scheduledAt),
        attendees,
        createdBy: auth.userId,
      })
      .returning();
    if (!session) {
      throw new NotFoundException({ code: "not_found", message: "Couldn't schedule the session" });
    }
    return toDto(session);
  }

  /** Upcoming and recent sessions, newest first. */
  async listSessions(auth: RequestAuth): Promise<IdgSession[]> {
    this.requireTeam(auth);
    const rows = await this.db
      .select()
      .from(idgSessions)
      .where(eq(idgSessions.tenantId, auth.tenantId))
      .orderBy(desc(idgSessions.scheduledAt));
    const result = z.array(idgSessionSchema).parse(rows.map(toDto));
    await this.audit.log(auth.tenantId, auth.userId, "view", "idg_session", "list");
    return result;
  }

  /** Record one attendee's consent for this session. Idempotent per attendee. */
  async recordConsent(
    auth: RequestAuth,
    sessionId: string,
    body: RecordIdgConsentRequest,
  ): Promise<IdgSession> {
    this.requireTeam(auth);
    const parsed = recordIdgConsentRequestSchema.parse(body);
    const session = await this.requireSession(auth, sessionId);
    if (session.status !== "scheduled") {
      throw new BadRequestException({
        code: "invalid_state",
        message: "Consent can only be recorded before recording starts.",
      });
    }
    const attendees = z.array(idgAttendeeSchema).parse(session.attendees);
    const attendee = attendees.find(
      (a) => a.name.toLowerCase() === parsed.attendeeName.toLowerCase(),
    );
    if (!attendee) {
      throw new NotFoundException({ code: "not_found", message: "That person isn't on the attendee list." });
    }
    attendee.consentedAt = new Date().toISOString();
    const [updated] = await this.db
      .update(idgSessions)
      .set({ attendees })
      .where(eq(idgSessions.id, sessionId))
      .returning();
    if (!updated) {
      throw new NotFoundException({ code: "not_found", message: "IDG session not found" });
    }
    return toDto(updated);
  }

  /** Start recording — blocked until every attendee has consented. */
  async startRecording(auth: RequestAuth, sessionId: string): Promise<IdgSession> {
    this.requireTeam(auth);
    const session = await this.requireSession(auth, sessionId);
    if (session.status !== "scheduled") {
      throw new BadRequestException({ code: "invalid_state", message: "This session isn't scheduled." });
    }
    const attendees = z.array(idgAttendeeSchema).parse(session.attendees);
    if (!idgReadyToRecord(attendees)) {
      const missing = attendees.filter((a) => a.consentedAt === null).map((a) => a.name);
      throw new BadRequestException({
        code: "consent_missing",
        message: `Recording can't start until everyone consents. Still waiting on: ${missing.join(", ")}.`,
      });
    }
    const [updated] = await this.db
      .update(idgSessions)
      .set({ status: "recording", startedAt: new Date() })
      .where(eq(idgSessions.id, sessionId))
      .returning();
    if (!updated) {
      throw new NotFoundException({ code: "not_found", message: "IDG session not found" });
    }
    return toDto(updated);
  }

  /** Close the session with its transcript and structured sections. */
  async completeSession(
    auth: RequestAuth,
    sessionId: string,
    body: CompleteIdgSessionRequest,
  ): Promise<IdgSession> {
    this.requireTeam(auth);
    const parsed = completeIdgSessionRequestSchema.parse(body);
    const session = await this.requireSession(auth, sessionId);
    if (!canTransitionIdg(session.status as "scheduled" | "recording" | "completed", "completed")) {
      throw new BadRequestException({
        code: "invalid_state",
        message: "Only a recording session can be completed.",
      });
    }
    const [updated] = await this.db
      .update(idgSessions)
      .set({
        status: "completed",
        endedAt: new Date(),
        transcript: parsed.transcript ?? session.transcript,
        sections: parsed.sections ?? session.sections,
      })
      .where(eq(idgSessions.id, sessionId))
      .returning();
    if (!updated) {
      throw new NotFoundException({ code: "not_found", message: "IDG session not found" });
    }
    return toDto(updated);
  }
}

function toDto(s: {
  id: string;
  tenantId: string;
  scheduledAt: Date;
  status: string;
  attendees: unknown;
  transcript: string | null;
  sections: unknown;
  createdBy: string;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}): IdgSession {
  return idgSessionSchema.parse({
    id: s.id,
    tenantId: s.tenantId,
    scheduledAt: s.scheduledAt.toISOString(),
    status: s.status,
    attendees: s.attendees,
    transcript: s.transcript,
    sections: idgSectionsSchema.parse(s.sections),
    createdBy: s.createdBy,
    startedAt: s.startedAt ? s.startedAt.toISOString() : null,
    endedAt: s.endedAt ? s.endedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
  });
}
