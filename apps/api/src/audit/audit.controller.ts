import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { auditLogQuerySchema, type AuditLogQuery } from "@repo/types";
import { CurrentAuth } from "../common/current-auth.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { TenantGuard, type RequestAuth } from "../tenant/tenant.guard.js";
import { AuditService } from "./audit.service.js";

/** Admin-only audit trail viewer. */
@UseGuards(TenantGuard)
@Controller("admin/audit-log")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async query(
    @Query(new ZodValidationPipe(auditLogQuerySchema)) query: AuditLogQuery,
    @CurrentAuth() auth: RequestAuth,
  ) {
    return this.audit.query(auth, query);
  }
}
