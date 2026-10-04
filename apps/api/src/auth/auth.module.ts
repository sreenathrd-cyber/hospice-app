import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { TelnyxModule } from "../telnyx/telnyx.module.js";

@Module({
  imports: [TelnyxModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
