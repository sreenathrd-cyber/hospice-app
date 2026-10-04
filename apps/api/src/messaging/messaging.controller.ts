import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  createThreadRequestSchema,
  messagesQuerySchema,
  registerPushTokenRequestSchema,
  sendMessageRequestSchema,
  type CreateThreadRequest,
  type MessagesQuery,
  type RegisterPushTokenRequest,
  type SendMessageRequest,
} from "@repo/types";
import { CurrentAuth } from "../common/current-auth.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { TenantGuard, type RequestAuth } from "../tenant/tenant.guard.js";
import { MessagingService } from "./messaging.service.js";

/**
 * Care team ↔ family messaging. Tenant-guarded; every body and query is
 * zod-validated; thread access is participant-checked in the service.
 */
@UseGuards(TenantGuard)
@Controller("threads")
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Post()
  async createThread(
    @Body(new ZodValidationPipe(createThreadRequestSchema)) body: CreateThreadRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.messaging.createThread(auth, body.patientId);
  }

  @Get()
  async listThreads(@CurrentAuth() auth: RequestAuth) {
    return this.messaging.listThreads(auth);
  }

  @Get(":threadId/messages")
  async listMessages(
    @Param("threadId") threadId: string,
    @Query(new ZodValidationPipe(messagesQuerySchema)) query: MessagesQuery,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.messaging.listMessages(auth, threadId, query);
  }

  @Post(":threadId/messages")
  async sendMessage(
    @Param("threadId") threadId: string,
    @Body(new ZodValidationPipe(sendMessageRequestSchema)) body: SendMessageRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.messaging.sendMessage(auth, threadId, body.body);
  }

  @Post(":threadId/read")
  async markRead(@Param("threadId") threadId: string, @CurrentAuth() auth: RequestAuth) {
    return this.messaging.markRead(auth, threadId);
  }
}

/** Push-token registration lives with messaging — it's only used for message alerts. */
@UseGuards(TenantGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly messaging: MessagingService) {}

  @Post("push-token")
  async registerPushToken(
    @Body(new ZodValidationPipe(registerPushTokenRequestSchema)) body: RegisterPushTokenRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.messaging.registerPushToken(auth, body.token);
  }
}
