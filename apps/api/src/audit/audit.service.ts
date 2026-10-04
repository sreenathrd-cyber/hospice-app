import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
  and,
  auditLog,
  desc,
  eq,
  gte,
  lt,
  lte,
  users,
  type Database,
} from "@repo/db";
import {
  auditLogEntrySchema,
  auditLogQuerySchema,
  type AuditAction,
  type AuditLogEntry,
  type AuditLogQuery,
  type AuditRecordType,
} from "@repo/types";
import { z } from "zod";
import { DB_CLIENT } from "../db/database.module.js";
import type { RequestAuth } from "../tenant/tenant.guard.js";

/**
 * Append-only PHI access log. Services call log() when PHI is read or
 * changed; admins read the trail via query(). No update or delete path
 * exists — by design, not by omission.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DB_CLIENT) private readonly db: Database) {}

  /** Record one access. Fire-and-forget from the caller's perspective — await it, but it never throws for bad input. */
  async log(
    tenantId: string,
    actorId: string,
    action: AuditAction,
    recordType: AuditRecordType,
    recordId: string,
  ): Promise<void> {
    await this.db.insert(auditLog).values({ tenantId, actorId, action, recordType, recordId });
  }

  /** Admin-only: the tenant's audit trail, newest first, cursor-paginated. */
  async query(auth: RequestAuth, filters: AuditLogQuery): Promise<AuditLogEntry[]> {
    if (auth.role !== "admin") {
      throw new ForbiddenException({ code: "forbidden", message: "Admins only" });
    }
    const q = auditLogQuerySchema.parse(filters);

    const conditions = [eq(auditLog.tenantId, auth.tenantId)];
    if (q.actorId) conditions.push(eq(auditLog.actorId, q.actorId));
    if (q.recordType) conditions.push(eq(auditLog.recordType, q.recordType));
    if (q.from) conditions.push(gte(auditLog.createdAt, new Date(q.from)));
    if (q.to) conditions.push(lte(auditLog.createdAt, new Date(q.to)));
    if (q.cursor) conditions.push(lt(auditLog.createdAt, new Date(q.cursor)));

    const rows = await this.db
      .select({ entry: auditLog, actorName: users.displayName })
      .from(auditLog)
      .innerJoin(users, eq(auditLog.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt))
      .limit(q.limit);

    return z
      .array(auditLogEntrySchema)
      .parse(
        rows.map((r) => ({
          id: r.entry.id,
          tenantId: r.entry.tenantId,
          actorId: r.entry.actorId,
          actorName: r.actorName,
          action: r.entry.action,
          recordType: r.entry.recordType,
          recordId: r.entry.recordId,
          createdAt: r.entry.createdAt.toISOString(),
        })),
      );
  }
}
