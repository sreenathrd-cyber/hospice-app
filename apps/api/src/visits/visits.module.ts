import { Module } from "@nestjs/common";
import { TelnyxModule } from "../telnyx/telnyx.module.js";
import { PatientsController, VisitsController } from "./visits.controller.js";
import { VisitsService } from "./visits.service.js";

@Module({
  imports: [TelnyxModule],
  controllers: [VisitsController, PatientsController],
  providers: [VisitsService],
})
export class VisitsModule {}
