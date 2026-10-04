import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  alertsQuerySchema,
  assignQuestionnaireRequestSchema,
  responsesQuerySchema,
  submitQuestionnaireRequestSchema,
  type AlertsQuery,
  type AssignQuestionnaireRequest,
  type ResponsesQuery,
  type SubmitQuestionnaireRequest,
} from "@repo/types";
import { CurrentAuth } from "../common/current-auth.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { TenantGuard, type RequestAuth } from "../tenant/tenant.guard.js";
import { QuestionnairesService } from "./questionnaires.service.js";

/**
 * Questionnaire engine. Assign (team), submit (family), history, and the
 * alert inbox. Tenant-guarded; every body and query is zod-validated.
 */
@UseGuards(TenantGuard)
@Controller("questionnaires")
export class QuestionnairesController {
  constructor(private readonly questionnaires: QuestionnairesService) {}

  @Post("assignments")
  async assign(
    @Body(new ZodValidationPipe(assignQuestionnaireRequestSchema)) body: AssignQuestionnaireRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.questionnaires.assign(auth, body);
  }

  @Get("assignments/pending")
  async pendingForFamily(@CurrentAuth() auth: RequestAuth) {
    return this.questionnaires.pendingForFamily(auth);
  }

  @Post("responses")
  async submit(
    @Body(new ZodValidationPipe(submitQuestionnaireRequestSchema)) body: SubmitQuestionnaireRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.questionnaires.submit(auth, body);
  }

  @Get("responses")
  async history(
    @Query(new ZodValidationPipe(responsesQuerySchema)) query: ResponsesQuery,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.questionnaires.history(auth, query);
  }
}

@UseGuards(TenantGuard)
@Controller("alerts")
export class AlertsController {
  constructor(private readonly questionnaires: QuestionnairesService) {}

  @Get()
  async listAlerts(
    @Query(new ZodValidationPipe(alertsQuerySchema)) query: AlertsQuery,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.questionnaires.listAlerts(auth, query);
  }

  @Post(":alertId/acknowledge")
  async acknowledge(
    @Param("alertId") alertId: string,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.questionnaires.acknowledge(auth, alertId);
  }
}
