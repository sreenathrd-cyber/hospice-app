import { Module } from "@nestjs/common";
import { MessagingController, NotificationsController } from "./messaging.controller.js";
import { MessagingService } from "./messaging.service.js";
import { PushService } from "./push.service.js";

@Module({
  controllers: [MessagingController, NotificationsController],
  providers: [MessagingService, PushService],
  exports: [PushService],
})
export class MessagingModule {}
