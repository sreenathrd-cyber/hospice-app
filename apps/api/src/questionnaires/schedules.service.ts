import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  and,
  asc,
  eq,
  lte,
  patients,
  questionnaireAssignments,
  questionnaireSchedules,
  type Database,
} from "@repo/db";
import {
  advanceDueDate,
  createScheduleRequestSchema,
  isTeamRole,
  questionnaireScheduleSchema,
  scheduleListItemSchema,
  updateScheduleRequestSchema,
  type CreateScheduleRequest,
  type QuestionnaireSchedule,
  type ScheduleListItem,
  type UpdateScheduleRequest,
} from "@repo/types";
import { z } from "zod";
import { DB_CLIENT } from "../db/database.module.js";
import type { RequestAuth } from "../tenant/tenant.guard.js";

/**
 * Recurring questionnaire schedules. The team sets "ESAS daily for patient X";
 * the hourly generator creates pending assignments as they come due. The
 * family experience doesn't change — new questionnaires just appear.
 */
@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(@Inject(DB_CLIENT) private readonly db: Database) {}

  private requireTeam(auth: RequestAuth): void {
    if (!isTeamRole(auth.role)) {
      throw new ForbiddenException({ code: "forbidden", message: "Care team only" });
    }
  }

  /** Team creates a recurring schedule. The first assignment generates on the next run. */
  async createSchedule(auth: RequestAuth, body: CreateScheduleRequest): Promise<QuestionnaireSchedule> {
    this.requireTeam(auth);
    const parsed = createScheduleRequestSchema.parse(body);

    const patient = await this.db.query.patients.findFirst({
      where: and(eq(patients.id, parsed.patientId), eq(patients.tenantId, auth.tenantId)),
    });
    if (!patient) {
      throw new NotFoundException({ code: "not_found", message: "Patient not found" });
    }

    const [schedule] = await this.db
      .insert(questionnaireSchedules)
      .values({
        tenantId: auth.tenantId,
        patientId: parsed.patientId,
        kind: parsed.kind,
        frequency: parsed.frequency,
        nextDueAt: parsed.startAt ? new Date(parsed.startAt) : new Date(),
      })
      .returning();
    if (!schedule) {
      throw new NotFoundException({ code: "not_found", message: "Couldn't create the schedule" });
    }
    return questionnaireScheduleSchema.parse(toDto(schedule));
  }

  /** Team's schedules with patient names, newest first. */
  async listSchedules(auth: RequestAuth): Promise<ScheduleListItem[]> {
    this.requireTeam(auth);
    const rows = await this.db
      .select({ schedule: questionnaireSchedules, patientName: patients.displayName })
      .from(questionnaireSchedules)
      .innerJoin(patients, eq(questionnaireSchedules.patientId, patients.id))
      .where(eq(questionnaireSchedules.tenantId, auth.tenantId))
      .orderBy(asc(questionnaireSchedules.createdAt));
    return z
      .array(scheduleListItemSchema)
      .parse(rows.map((r) => ({ ...toDto(r.schedule), patientName: r.patientName })));
  }

  /** Pause or resume a schedule. Pausing stops future generation; pending assignments stay. */
  async updateSchedule(
    auth: RequestAuth,
    scheduleId: string,
    body: UpdateScheduleRequest,
  ): Promise<QuestionnaireSchedule> {
    this.requireTeam(auth);
    const parsed = updateScheduleRequestSchema.parse(body);
    const schedule = await this.db.query.questionnaireSchedules.findFirst({
      where: and(
        eq(questionnaireSchedules.id, scheduleId),
        eq(questionnaireSchedules.tenantId, auth.tenantId),
      ),
    });
    if (!schedule) {
      throw new NotFoundException({ code: "not_found", message: "Schedule not found" });
    }
    const [updated] = await this.db
      .update(questionnaireSchedules)
      .set({ active: parsed.active })
      .where(eq(questionnaireSchedules.id, scheduleId))
      .returning();
    if (!updated) {
      throw new NotFoundException({ code: "not_found", message: "Schedule not found" });
    }
    return questionnaireScheduleSchema.parse(toDto(updated));
  }

  /**
   * Generate assignments for every active schedule that's due. Idempotent per
   * schedule: a pending assignment from the same schedule blocks a duplicate.
   * Returns the number of assignments created.
   */
  async generateDue(now: Date = new Date()): Promise<number> {
    const due = await this.db
      .select()
      .from(questionnaireSchedules)
      .where(and(eq(questionnaireSchedules.active, true), lte(questionnaireSchedules.nextDueAt, now)));

    let created = 0;
    for (const schedule of due) {
      const existing = await this.db.query.questionnaireAssignments.findFirst({
        where: and(
          eq(questionnaireAssignments.scheduleId, schedule.id),
          eq(questionnaireAssignments.status, "pending"),
        ),
      });
      if (!existing) {
        await this.db.insert(questionnaireAssignments).values({
          tenantId: schedule.tenantId,
          patientId: schedule.patientId,
          kind: schedule.kind,
          dueAt: schedule.nextDueAt,
          scheduleId: schedule.id,
        });
        created++;
      }
      const next = advanceDueDate(
        schedule.nextDueAt > now ? schedule.nextDueAt : now,
        schedule.frequency as "daily" | "weekly",
      );
      await this.db
        .update(questionnaireSchedules)
        .set({ nextDueAt: next })
        .where(eq(questionnaireSchedules.id, schedule.id));
    }
    if (created > 0) this.logger.log(`Generated ${created} scheduled questionnaire assignments`);
    return created;
  }

  /** Hourly generator — the heartbeat that turns schedules into assignments. */
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    await this.generateDue();
  }
}

function toDto(s: {
  id: string;
  tenantId: string;
  patientId: string;
  kind: string;
  frequency: string;
  active: boolean;
  nextDueAt: Date;
  createdAt: Date;
}) {
  return {
    id: s.id,
    tenantId: s.tenantId,
    patientId: s.patientId,
    kind: s.kind,
    frequency: s.frequency,
    active: s.active,
    nextDueAt: s.nextDueAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  };
}
