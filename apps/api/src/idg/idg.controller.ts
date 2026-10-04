import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  completeIdgSessionRequestSchema,
  createIdgSessionRequestSchema,
  recordIdgConsentRequestSchema,
  type CompleteIdgSessionRequest,
  type CreateIdgSessionRequest,
  type RecordIdgConsentRequest,
} from "@repo/types";
import { CurrentAuth } from "../common/current-auth.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { TenantGuard, type RequestAuth } from "../tenant/tenant.guard.js";
import { IdgService } from "./idg.service.js";

/** IDG sessions: schedule → per-attendee consent → record → complete. */
@UseGuards(TenantGuard)
@Controller("idg/sessions")
export class IdgController {
  constructor(private readonly idg: IdgService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createIdgSessionRequestSchema)) body: CreateIdgSessionRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.idg.createSession(auth, body);
  }

  @Get()
  async list(@CurrentAuth() auth: RequestAuth) {
    return this.idg.listSessions(auth);
  }

  @Post(":sessionId/consent")
  async consent(
    @Param("sessionId") sessionId: string,
    @Body(new ZodValidationPipe(recordIdgConsentRequestSchema)) body: RecordIdgConsentRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.idg.recordConsent(auth, sessionId, body);
  }

  @Post(":sessionId/start")
  async start(@Param("sessionId") sessionId: string, @CurrentAuth() auth: RequestAuth) {
    return this.idg.startRecording(auth, sessionId);
  }

  @Post(":sessionId/complete")
  async complete(
    @Param("sessionId") sessionId: string,
    @Body(new ZodValidationPipe(completeIdgSessionRequestSchema)) body: CompleteIdgSessionRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.idg.completeSession(auth, sessionId, body);
  }
}
