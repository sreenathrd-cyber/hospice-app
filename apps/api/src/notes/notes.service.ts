import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { and, asc, eq, visits, visitNotes, type Database } from "@repo/db";
import {
  canTransitionNote,
  createVisitNoteRequestSchema,
  isTeamRole,
  updateVisitNoteRequestSchema,
  visitNoteSchema,
  visitNoteSectionsSchema,
  type CreateVisitNoteRequest,
  type UpdateVisitNoteRequest,
  type VisitNote,
} from "@repo/types";
import { z } from "zod";
import { DB_CLIENT } from "../db/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import type { RequestAuth } from "../tenant/tenant.guard.js";
import { TranscriptionNotConfiguredError, TRANSCRIPTION_PROVIDER, type TranscriptionProvider } from "./transcription-provider.js";

/**
 * Visit notes: draft → approved → filed. The clinician structures the
 * transcript into sections, approves the note, and files it to the chart.
 * Filed notes are immutable — corrections are new notes, not edits.
 */
@Injectable()
export class NotesService {
  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    private readonly audit: AuditService,
    @Optional()
    @Inject(TRANSCRIPTION_PROVIDER)
    private readonly transcription: TranscriptionProvider | null,
  ) {}

  private requireTeam(auth: RequestAuth): void {
    if (!isTeamRole(auth.role)) {
      throw new ForbiddenException({ code: "forbidden", message: "Care team only" });
    }
  }

  private async requireVisit(auth: RequestAuth, visitId: string) {
    const visit = await this.db.query.visits.findFirst({
      where: and(eq(visits.id, visitId), eq(visits.tenantId, auth.tenantId)),
    });
    if (!visit) {
      throw new NotFoundException({ code: "not_found", message: "Visit not found" });
    }
    return visit;
  }

  /** Create a draft note against a visit. Transcript is optional — the note can be written directly. */
  async createNote(auth: RequestAuth, visitId: string, body: CreateVisitNoteRequest): Promise<VisitNote> {
    this.requireTeam(auth);
    const parsed = createVisitNoteRequestSchema.parse(body);
    const visit = await this.requireVisit(auth, visitId);

    const [note] = await this.db
      .insert(visitNotes)
      .values({
        tenantId: auth.tenantId,
        visitId: visit.id,
        patientId: visit.patientId,
        transcript: parsed.transcript ?? null,
        sections: parsed.sections ?? {},
        createdBy: auth.userId,
      })
      .returning();
    if (!note) {
      throw new NotFoundException({ code: "not_found", message: "Couldn't create the note" });
    }
    return toDto(note);
  }

  /** Notes for a visit, oldest first — the chart reads in order. */
  async listNotes(auth: RequestAuth, visitId: string): Promise<VisitNote[]> {
    this.requireTeam(auth);
    await this.requireVisit(auth, visitId);
    const rows = await this.db
      .select()
      .from(visitNotes)
      .where(and(eq(visitNotes.visitId, visitId), eq(visitNotes.tenantId, auth.tenantId)))
      .orderBy(asc(visitNotes.createdAt));
    const result = z.array(visitNoteSchema).parse(rows.map(toDto));
    await this.audit.log(auth.tenantId, auth.userId, "view", "visit_note", visitId);
    return result;
  }

  /**
   * Edit sections (draft only) or advance status (forward-only).
   * Approving stamps the clinician and time; filing locks the note.
   */
  async updateNote(auth: RequestAuth, noteId: string, body: UpdateVisitNoteRequest): Promise<VisitNote> {
    this.requireTeam(auth);
    const parsed = updateVisitNoteRequestSchema.parse(body);
    const note = await this.db.query.visitNotes.findFirst({
      where: and(eq(visitNotes.id, noteId), eq(visitNotes.tenantId, auth.tenantId)),
    });
    if (!note) {
      throw new NotFoundException({ code: "not_found", message: "Note not found" });
    }

    if (parsed.sections !== undefined && note.status !== "draft") {
      throw new BadRequestException({
        code: "note_locked",
        message: "Only draft notes can be edited. File a new note to correct a filed one.",
      });
    }
    if (parsed.status !== undefined && parsed.status !== note.status) {
      if (!canTransitionNote(note.status as "draft" | "approved" | "filed", parsed.status)) {
        throw new BadRequestException({
          code: "invalid_transition",
          message: `A note can't go from ${note.status} to ${parsed.status}.`,
        });
      }
    }

    const [updated] = await this.db
      .update(visitNotes)
      .set({
        ...(parsed.sections !== undefined ? { sections: parsed.sections } : {}),
        ...(parsed.status !== undefined
          ? {
              status: parsed.status,
              ...(parsed.status === "approved"
                ? { approvedBy: auth.userId, approvedAt: new Date() }
                : {}),
            }
          : {}),
      })
      .where(eq(visitNotes.id, noteId))
      .returning();
    if (!updated) {
      throw new NotFoundException({ code: "not_found", message: "Note not found" });
    }
    return toDto(updated);
  }

  /**
   * Audio → transcript via the configured provider. Fails loudly when no
   * provider is configured — never returns a silent empty transcript.
   */
  async transcribe(
    auth: RequestAuth,
    visitId: string,
    audio: Buffer,
    mimeType: string,
  ): Promise<{ transcript: string; provider: string }> {
    this.requireTeam(auth);
    await this.requireVisit(auth, visitId);
    if (!this.transcription) {
      throw new TranscriptionNotConfiguredError();
    }
    const transcript = await this.transcription.transcribe(audio, mimeType);
    return { transcript, provider: this.transcription.providerName };
  }
}

function toDto(n: {
  id: string;
  tenantId: string;
  visitId: string;
  patientId: string;
  transcript: string | null;
  sections: unknown;
  status: string;
  createdBy: string;
  approvedBy: string | null;
  createdAt: Date;
  approvedAt: Date | null;
}): VisitNote {
  return visitNoteSchema.parse({
    id: n.id,
    tenantId: n.tenantId,
    visitId: n.visitId,
    patientId: n.patientId,
    transcript: n.transcript,
    sections: visitNoteSectionsSchema.parse(n.sections),
    status: n.status,
    createdBy: n.createdBy,
    approvedBy: n.approvedBy,
    createdAt: n.createdAt.toISOString(),
    approvedAt: n.approvedAt ? n.approvedAt.toISOString() : null,
  });
}
