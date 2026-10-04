import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  desc,
  eq,
  or,
  alerts,
  patients,
  questionnaireAssignments,
  questionnaireResponses,
  tenants,
  users,
  type Database,
} from "@repo/db";
import {
  alertListItemSchema,
  alertsQuerySchema,
  assignQuestionnaireRequestSchema,
  evaluateResponse,
  isTeamRole,
  questionnaireAssignmentSchema,
  questionnaireResponseSchema,
  submitQuestionnaireRequestSchema,
  type AlertsQuery,
  type Alert,
  type AlertListItem,
  type AssignQuestionnaireRequest,
  type QuestionnaireAssignment,
  type QuestionnaireResponse,
  type ResponsesQuery,
  type ScoredSubmission,
  type SubmitQuestionnaireRequest,
} from "@repo/types";
import { DB_CLIENT } from "../db/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import { familyPatientIds } from "../common/patient-access.js";
import type { RequestAuth } from "../tenant/tenant.guard.js";
import { PushService } from "../messaging/push.service.js";

/**
 * Questionnaire engine: the care team assigns, the family submits, the server
 * scores and flags. Scoring/flagging NEVER happens client-side — the phone
 * renders questions and collects answers; every threshold lives in
 * @repo/types and is evaluated here, after persistence.
 */
@Injectable()
export class QuestionnairesService {
  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    private readonly push: PushService,
    private readonly audit: AuditService,
  ) {}

  private requireTeam(auth: RequestAuth): void {
    if (!isTeamRole(auth.role)) {
      throw new ForbiddenException({ code: "forbidden", message: "Care team only" });
    }
  }

  /** Patient ids the caller's family may act on (own record or enrolled). */
  private familyPatientIds(auth: RequestAuth): Promise<string[]> {
    return familyPatientIds(this.db, auth);
  }

  private async requirePatientInTenant(auth: RequestAuth, patientId: string) {
    const patient = await this.db.query.patients.findFirst({
      where: and(eq(patients.id, patientId), eq(patients.tenantId, auth.tenantId)),
    });
    if (!patient) {
      throw new NotFoundException({ code: "not_found", message: "Patient not found" });
    }
    return patient;
  }

  /** Care team assigns a questionnaire to a patient (the send schedule). */
  async assign(
    auth: RequestAuth,
    body: AssignQuestionnaireRequest,
  ): Promise<QuestionnaireAssignment> {
    this.requireTeam(auth);
    assignQuestionnaireRequestSchema.parse(body);
    await this.requirePatientInTenant(auth, body.patientId);

    const [assignment] = await this.db
      .insert(questionnaireAssignments)
      .values({
        tenantId: auth.tenantId,
        patientId: body.patientId,
        kind: body.kind,
        dueAt: body.dueAt ? new Date(body.dueAt) : new Date(),
      })
      .returning();
    if (!assignment) {
      throw new InternalServerErrorException({
        code: "assign_failed",
        message: "Couldn't assign the questionnaire. Try again.",
      });
    }
    return questionnaireAssignmentSchema.parse(toAssignmentDto(assignment));
  }

  /** Pending questionnaires for the caller's family, soonest due first. */
  async pendingForFamily(auth: RequestAuth): Promise<QuestionnaireAssignment[]> {
    const patientIds = await this.familyPatientIds(auth);
    if (patientIds.length === 0) return [];

    const rows = await this.db
      .select()
      .from(questionnaireAssignments)
      .where(
        and(
          eq(questionnaireAssignments.tenantId, auth.tenantId),
          eq(questionnaireAssignments.status, "pending"),
        ),
      )
      .orderBy(questionnaireAssignments.dueAt);
    return rows
      .filter((r) => patientIds.includes(r.patientId))
      .map((r) => questionnaireAssignmentSchema.parse(toAssignmentDto(r)));
  }

  /**
   * Family submits answers. The assignment must be pending, belong to the
   * caller's patient, and match the submitted kind. Scoring and flagging run
   * server-side after the response is persisted; red flags push the team.
   */
  async submit(
    auth: RequestAuth,
    body: SubmitQuestionnaireRequest,
  ): Promise<QuestionnaireResponse> {
    if (isTeamRole(auth.role)) {
      throw new ForbiddenException({ code: "forbidden", message: "Family submissions only" });
    }
    const parsed = submitQuestionnaireRequestSchema.parse(body);

    const assignment = await this.db.query.questionnaireAssignments.findFirst({
      where: and(
        eq(questionnaireAssignments.id, parsed.assignmentId),
        eq(questionnaireAssignments.tenantId, auth.tenantId),
      ),
    });
    if (!assignment || assignment.status !== "pending") {
      throw new NotFoundException({ code: "not_found", message: "Questionnaire not found" });
    }
    if (assignment.kind !== parsed.kind) {
      throw new ForbiddenException({ code: "forbidden", message: "Wrong questionnaire" });
    }
    const patientIds = await this.familyPatientIds(auth);
    if (!patientIds.includes(assignment.patientId)) {
      throw new ForbiddenException({ code: "forbidden", message: "Not your questionnaire" });
    }

    const [response] = await this.db
      .insert(questionnaireResponses)
      .values({
        tenantId: auth.tenantId,
        patientId: assignment.patientId,
        kind: parsed.kind,
        scores: parsed.scores,
        submittedBy: auth.userId,
        assignmentId: assignment.id,
      })
      .returning();
    if (!response) {
      throw new InternalServerErrorException({
        code: "submit_failed",
        message: "Couldn't save your answers. Try again.",
      });
    }
    await this.db
      .update(questionnaireAssignments)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(questionnaireAssignments.id, assignment.id));

    const submission = { kind: parsed.kind, scores: parsed.scores } as ScoredSubmission;
    const newAlerts = evaluateResponse(
      response.patientId as Alert["patientId"],
      response.id as Alert["responseId"],
      submission,
    );
    if (newAlerts.length > 0) {
      await this.db.insert(alerts).values(
        newAlerts.map((a) => ({
          tenantId: auth.tenantId,
          patientId: response.patientId,
          responseId: response.id,
          kind: a.questionnaireKind,
          symptom: a.symptom,
          score: a.score,
          severity: a.severity,
          message: a.message,
        })),
      );
    }
    if (newAlerts.some((a) => a.severity === "red")) {
      const tenant = await this.db.query.tenants.findFirst({
        where: eq(tenants.id, auth.tenantId),
      });
      const team = await this.db
        .select({ pushToken: users.pushToken })
        .from(users)
        .where(
          and(
            eq(users.tenantId, auth.tenantId),
            or(eq(users.role, "clinician"), eq(users.role, "admin")),
          ),
        );
      void this.push.notifyAlert(
        team.flatMap((m) =>
          m.pushToken
            ? [{ pushToken: m.pushToken, agencyName: tenant?.agencyName ?? "Your care team" }]
            : [],
        ),
      );
    }

    return questionnaireResponseSchema.parse(toResponseDto(response));
  }

  /** Response history for a patient — team sees their tenant's, family sees their own. */
  async history(auth: RequestAuth, query: ResponsesQuery): Promise<QuestionnaireResponse[]> {
    const { patientId } = query;
    await this.requirePatientInTenant(auth, patientId);
    if (!isTeamRole(auth.role)) {
      const mine = await this.familyPatientIds(auth);
      if (!mine.includes(patientId)) {
        throw new ForbiddenException({ code: "forbidden", message: "Not your records" });
      }
    }

    const rows = await this.db
      .select()
      .from(questionnaireResponses)
      .where(
        and(
          eq(questionnaireResponses.tenantId, auth.tenantId),
          eq(questionnaireResponses.patientId, patientId),
        ),
      )
      .orderBy(desc(questionnaireResponses.submittedAt));
    const result = rows.map((r) => questionnaireResponseSchema.parse(toResponseDto(r)));
    await this.audit.log(auth.tenantId, auth.userId, "view", "questionnaire_response", patientId);
    return result;
  }

  /** Alert inbox for the care team, newest first. */
  async listAlerts(auth: RequestAuth, query: AlertsQuery): Promise<AlertListItem[]> {
    this.requireTeam(auth);
    const { unacknowledgedOnly } = alertsQuerySchema.parse(query);

    const rows = await this.db
      .select({ alert: alerts, patientName: patients.displayName })
      .from(alerts)
      .innerJoin(patients, eq(alerts.patientId, patients.id))
      .where(
        and(
          eq(alerts.tenantId, auth.tenantId),
          unacknowledgedOnly ? eq(alerts.acknowledged, false) : undefined,
        ),
      )
      .orderBy(desc(alerts.createdAt));
    const items = rows.map((r) =>
      alertListItemSchema.parse({
        id: r.alert.id,
        patientId: r.alert.patientId,
        responseId: r.alert.responseId,
        questionnaireKind: r.alert.kind,
        symptom: r.alert.symptom,
        score: r.alert.score,
        severity: r.alert.severity,
        message: r.alert.message,
        createdAt: r.alert.createdAt.toISOString(),
        acknowledged: r.alert.acknowledged,
        patientName: r.patientName,
      }),
    );
    await this.audit.log(auth.tenantId, auth.userId, "view", "alert", "list");
    return items;
  }

  /** Acknowledge an alert — one-tap triage from the inbox. */
  async acknowledge(auth: RequestAuth, alertId: string): Promise<{ ok: true }> {
    this.requireTeam(auth);
    const alert = await this.db.query.alerts.findFirst({
      where: and(eq(alerts.id, alertId), eq(alerts.tenantId, auth.tenantId)),
    });
    if (!alert) {
      throw new NotFoundException({ code: "not_found", message: "Alert not found" });
    }
    await this.db.update(alerts).set({ acknowledged: true }).where(eq(alerts.id, alertId));
    await this.audit.log(auth.tenantId, auth.userId, "acknowledge", "alert", alertId);
    return { ok: true };
  }
}

function toAssignmentDto(a: {
  id: string;
  tenantId: string;
  patientId: string;
  kind: string;
  status: "pending" | "completed" | "cancelled";
  dueAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: a.id,
    tenantId: a.tenantId,
    patientId: a.patientId,
    kind: a.kind,
    status: a.status,
    dueAt: a.dueAt.toISOString(),
    completedAt: a.completedAt ? a.completedAt.toISOString() : undefined,
    createdAt: a.createdAt.toISOString(),
  };
}

function toResponseDto(r: {
  id: string;
  patientId: string;
  kind: string;
  scores: unknown;
  submittedAt: Date;
}) {
  return {
    id: r.id,
    patientId: r.patientId,
    kind: r.kind,
    scores: r.scores,
    submittedAt: r.submittedAt.toISOString(),
  };
}
