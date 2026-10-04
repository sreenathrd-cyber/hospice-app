CREATE TYPE "public"."visit_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "care_line_phone" text;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "status" "visit_status" DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "telnyx_room_id" text;