import { Module } from "@nestjs/common";
import { MessagingModule } from "../messaging/messaging.module.js";
import {
  AlertsController,
  QuestionnairesController,
} from "./questionnaires.controller.js";
import { QuestionnairesService } from "./questionnaires.service.js";
import { SchedulesController } from "./schedules.controller.js";
import { SchedulesService } from "./schedules.service.js";

@Module({
  imports: [MessagingModule],
  controllers: [QuestionnairesController, AlertsController, SchedulesController],
  providers: [QuestionnairesService, SchedulesService],
})
export class QuestionnairesModule {}
