import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  createScheduleRequestSchema,
  updateScheduleRequestSchema,
  type CreateScheduleRequest,
  type UpdateScheduleRequest,
} from "@repo/types";
import { CurrentAuth } from "../common/current-auth.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { TenantGuard, type RequestAuth } from "../tenant/tenant.guard.js";
import { SchedulesService } from "./schedules.service.js";

/** Recurring questionnaire schedules — team creates, pauses, resumes. */
@UseGuards(TenantGuard)
@Controller("questionnaires/schedules")
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createScheduleRequestSchema)) body: CreateScheduleRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.schedules.createSchedule(auth, body);
  }

  @Get()
  async list(@CurrentAuth() auth: RequestAuth) {
    return this.schedules.listSchedules(auth);
  }

  @Patch(":scheduleId")
  async update(
    @Param("scheduleId") scheduleId: string,
    @Body(new ZodValidationPipe(updateScheduleRequestSchema)) body: UpdateScheduleRequest,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.schedules.updateSchedule(auth, scheduleId, body);
  }
}
