import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AuditModule } from "./audit/audit.module.js";
import { HealthController } from "./health/health.controller.js";
import { DatabaseModule } from "./db/database.module.js";
import { TelnyxModule } from "./telnyx/telnyx.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { IdgModule } from "./idg/idg.module.js";
import { MessagingModule } from "./messaging/messaging.module.js";
import { NotesModule } from "./notes/notes.module.js";
import { QuestionnairesModule } from "./questionnaires/questionnaires.module.js";
import { SiaModule } from "./sia/sia.module.js";
import { VisitsModule } from "./visits/visits.module.js";

@Module({
  imports: [ScheduleModule.forRoot(), AuditModule, DatabaseModule, TelnyxModule, AuthModule, IdgModule, MessagingModule, NotesModule, QuestionnairesModule, SiaModule, VisitsModule],
  controllers: [HealthController],
})
export class AppModule {}
