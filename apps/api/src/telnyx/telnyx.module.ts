import { Module } from "@nestjs/common";
import { TelnyxController } from "./telnyx.controller.js";
import { TelnyxService } from "./telnyx.service.js";

@Module({
  controllers: [TelnyxController],
  providers: [TelnyxService],
  exports: [TelnyxService],
})
export class TelnyxModule {}
