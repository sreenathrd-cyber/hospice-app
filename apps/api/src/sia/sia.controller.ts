import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import {
  createSiaEntryRequestSchema,
  siaEntriesQuerySchema,
  type CreateSiaEntryRequest,
  type SiaEntriesQuery,
} from "@repo/types";
import { CurrentAuth } from "../common/current-auth.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { TenantGuard, type RequestAuth } from "../tenant/tenant.guard.js";
import { SiaService } from "./sia.service.js";

/** SIA capture: log in-person minutes, read entries and the computed summary. */
@UseGuards(TenantGuard)
@Controller("sia")
export class SiaController {
  constructor(private readonly sia: SiaService) {}

  @Post("entries")
  async createEntry(
    @Body(new ZodValidationPipe(createSiaEntryRequestSchema)) body: CreateSiaEntryRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.sia.createEntry(auth, body);
  }

  @Get("entries")
  async entries(
    @Query(new ZodValidationPipe(siaEntriesQuerySchema)) query: SiaEntriesQuery,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.sia.entriesForPatient(auth, query);
  }

  @Get("summary")
  async summary(
    @Query(new ZodValidationPipe(siaEntriesQuerySchema)) query: SiaEntriesQuery,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.sia.summaryForPatient(auth, query);
  }
}
