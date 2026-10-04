import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  createVisitNoteRequestSchema,
  updateVisitNoteRequestSchema,
  type CreateVisitNoteRequest,
  type UpdateVisitNoteRequest,
} from "@repo/types";
import { CurrentAuth } from "../common/current-auth.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { TenantGuard, type RequestAuth } from "../tenant/tenant.guard.js";
import { NotesService } from "./notes.service.js";

/** Visit notes: draft → clinician approve → filed to the chart. */
@UseGuards(TenantGuard)
@Controller()
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Post("visits/:visitId/notes")
  async create(
    @Param("visitId") visitId: string,
    @Body(new ZodValidationPipe(createVisitNoteRequestSchema)) body: CreateVisitNoteRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.notes.createNote(auth, visitId, body);
  }

  @Get("visits/:visitId/notes")
  async list(@Param("visitId") visitId: string, @CurrentAuth() auth: RequestAuth) {
    return this.notes.listNotes(auth, visitId);
  }

  @Patch("notes/:noteId")
  async update(
    @Param("noteId") noteId: string,
    @Body(new ZodValidationPipe(updateVisitNoteRequestSchema)) body: UpdateVisitNoteRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.notes.updateNote(auth, noteId, body);
  }
}
