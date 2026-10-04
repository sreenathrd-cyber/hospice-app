import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  scheduleVisitRequestSchema,
  visitsQuerySchema,
  type ScheduleVisitRequest,
  type VisitsQuery,
} from "@repo/types";
import { CurrentAuth } from "../common/current-auth.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { TenantGuard, type RequestAuth } from "../tenant/tenant.guard.js";
import { VisitsService } from "./visits.service.js";

/** Visits: schedule (team), list, join a video visit, mark complete. */
@UseGuards(TenantGuard)
@Controller("visits")
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Post()
  async schedule(
    @Body(new ZodValidationPipe(scheduleVisitRequestSchema)) body: ScheduleVisitRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.visits.schedule(auth, body);
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(visitsQuerySchema)) query: VisitsQuery,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.visits.list(auth, query);
  }

  @Post(":visitId/join")
  async join(@Param("visitId") visitId: string, @CurrentAuth() auth: RequestAuth) {
    return this.visits.join(auth, visitId);
  }

  @Post(":visitId/complete")
  async complete(@Param("visitId") visitId: string, @CurrentAuth() auth: RequestAuth) {
    return this.visits.complete(auth, visitId);
  }
}

/** Minimal patient directory for the team scheduler. */
@UseGuards(TenantGuard)
@Controller("patients")
export class PatientsController {
  constructor(private readonly visits: VisitsService) {}

  @Get()
  async directory(@CurrentAuth() auth: RequestAuth) {
    return this.visits.patientDirectory(auth);
  }
}
