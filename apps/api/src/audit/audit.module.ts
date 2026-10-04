import { Global, Module } from "@nestjs/common";
import { AuditController } from "./audit.controller.js";
import { AuditService } from "./audit.service.js";

/**
 * Global: every module logs PHI access here, and exactly one module serves
 * the trail. There is one audit log per deployment.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
