import { Module } from "@nestjs/common";
import { IdgController } from "./idg.controller.js";
import { IdgService } from "./idg.service.js";

@Module({
  controllers: [IdgController],
  providers: [IdgService],
})
export class IdgModule {}
