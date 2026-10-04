CREATE TYPE "public"."assignment_status" AS ENUM('pending', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "questionnaire_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" "assignment_status" DEFAULT 'pending' NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questionnaire_responses" ADD COLUMN "submitted_by" uuid;--> statement-breakpoint
ALTER TABLE "questionnaire_responses" ADD COLUMN "assignment_id" uuid;--> statement-breakpoint
ALTER TABLE "questionnaire_assignments" ADD CONSTRAINT "questionnaire_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_assignments" ADD CONSTRAINT "questionnaire_assignments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_responses" ADD CONSTRAINT "questionnaire_responses_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_responses" ADD CONSTRAINT "questionnaire_responses_assignment_id_questionnaire_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."questionnaire_assignments"("id") ON DELETE no action ON UPDATE no action;