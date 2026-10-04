import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Database schema. PostgreSQL only.
 *
 * Tenant isolation is structural: every PHI table carries tenant_id, and every
 * query in apps/api filters on it from the authenticated session. There is a
 * mandatory cross-tenant test proving tenant A cannot read tenant B's rows.
 *
 * Domain models never contain null — nullable columns (logo_url) are mapped to
 * Option<T> at the read boundary (see toAgencyTheme in index.ts).
 */

export const userRoleEnum = pgEnum("user_role", ["patient", "caregiver", "clinician", "admin"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["info", "warning", "red"]);
export const messageDirectionEnum = pgEnum("message_direction", ["family_to_team", "team_to_family"]);
export const visitTypeEnum = pgEnum("visit_type", ["in_person", "video", "phone"]);
export const visitStatusEnum = pgEnum("visit_status", [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);
export const assignmentStatusEnum = pgEnum("assignment_status", ["pending", "completed", "cancelled"]);
export const siaClinicianRoleEnum = pgEnum("sia_clinician_role", ["rn", "msw"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyName: text("agency_name").notNull(),
  primaryColor: text("primary_color").notNull(),
  logoUrl: text("logo_url"),
  /** Agency care line dialed by the family's "Call care team" button. */
  careLinePhone: text("care_line_phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  role: userRoleEnum("role").notNull(),
  displayName: text("display_name").notNull(),
  phone: text("phone"),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  /** Expo push token for new-message notifications. Null until the device registers. */
  pushToken: text("push_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  displayName: text("display_name").notNull(),
  mrn: text("mrn").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  /** The patient's own app login, if they use the app directly. Null when only caregivers message. */
  userId: uuid("user_id")
    .references(() => users.id)
    .unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const enrollments = pgTable("enrollments", {
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  caregiverUserId: uuid("caregiver_user_id")
    .notNull()
    .references(() => users.id),
});

export const questionnaireResponses = pgTable("questionnaire_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  kind: text("kind").notNull(),
  scores: jsonb("scores").notNull(),
  /** The family member who submitted (caregiver or patient login). */
  submittedBy: uuid("submitted_by").references(() => users.id),
  assignmentId: uuid("assignment_id").references(() => questionnaireAssignments.id),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A questionnaire the care team asked a family to complete — the send schedule. */
export const questionnaireAssignments = pgTable("questionnaire_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  kind: text("kind").notNull(),
  status: assignmentStatusEnum("status").notNull().default("pending"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  /** Set when the assignment was generated from a recurring schedule. */
  scheduleId: uuid("schedule_id").references(() => questionnaireSchedules.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  responseId: uuid("response_id")
    .notNull()
    .references(() => questionnaireResponses.id),
  kind: text("kind").notNull(),
  symptom: text("symptom").notNull(),
  score: integer("score").notNull(),
  severity: alertSeverityEnum("severity").notNull(),
  message: text("message").notNull(),
  acknowledged: boolean("acknowledged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const threads = pgTable("threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => threads.id),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id),
  direction: messageDirectionEnum("direction").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Who may read/write a thread. Threads are private to their participants. */
export const threadParticipants = pgTable(
  "thread_participants",
  {
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.threadId, t.userId] })],
);

/** Per-user read watermark per thread — drives unread counts. */
export const threadReads = pgTable(
  "thread_reads",
  {
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.threadId, t.userId] })],
);

export const visits = pgTable("visits", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  clinicianId: uuid("clinician_id")
    .notNull()
    .references(() => users.id),
  visitType: visitTypeEnum("visit_type").notNull(),
  status: visitStatusEnum("status").notNull().default("scheduled"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  /** Telnyx Video Room id, created lazily on first join for video visits. */
  telnyxRoomId: text("telnyx_room_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siaEntries = pgTable("sia_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  visitId: uuid("visit_id")
    .notNull()
    .references(() => visits.id),
  clinicianRole: siaClinicianRoleEnum("clinician_role").notNull(),
  minutes: integer("minutes").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
});

/**
 * Append-only PHI access log. The API layer writes rows here; no endpoint may
 * update or delete them. Record IDs only — never PHI content.
 */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  recordType: text("record_type").notNull(),
  recordId: text("record_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Phone-code auth. Codes and session tokens are stored as SHA-256 hashes —
 * a database read never yields a usable code or token.
 */
export const verificationCodes = pgTable("verification_codes", {
  phone: text("phone").primaryKey(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Recurring questionnaire schedule — the team sets it, the generator creates assignments. */
export const questionnaireSchedules = pgTable("questionnaire_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  kind: text("kind").notNull(),
  frequency: text("frequency").notNull(),
  active: boolean("active").notNull().default(true),
  nextDueAt: timestamp("next_due_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Visit notes: draft → approved → filed. The transcript is the raw input;
 * sections are the clinician-structured note. Append-friendly, never hard-deleted.
 */
export const visitNotes = pgTable("visit_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  visitId: uuid("visit_id")
    .notNull()
    .references(() => visits.id),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  transcript: text("transcript"),
  sections: jsonb("sections").notNull().default({}),
  status: text("status").notNull().default("draft"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  approvedBy: uuid("approved_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});

/**
 * IDG sessions: scheduled → recording → completed. Attendees carry per-session
 * consent; recording is blocked until every attendee has consented.
 */
export const idgSessions = pgTable("idg_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("scheduled"),
  attendees: jsonb("attendees").notNull().default([]),
  transcript: text("transcript"),
  sections: jsonb("sections").notNull().default({}),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
