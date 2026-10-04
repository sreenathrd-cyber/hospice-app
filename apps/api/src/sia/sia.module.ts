import { Module } from "@nestjs/common";
import { SiaController } from "./sia.controller.js";
import { SiaService } from "./sia.service.js";

@Module({
  controllers: [SiaController],
  providers: [SiaService],
})
export class SiaModule {}
