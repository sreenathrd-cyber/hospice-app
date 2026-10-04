import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { eq, and } from "@repo/db";
import { sessions, users, type Database } from "@repo/db";
import { DB_CLIENT } from "../db/database.module.js";
import { hashSecret, isExpired } from "../auth/auth.logic.js";

export type RequestAuth = {
  userId: string;
  tenantId: string;
  role: "patient" | "caregiver" | "clinician" | "admin";
};

/**
 * Tenant gate. Verifies the Bearer token against the sessions table
 * (tokens stored hashed), checks expiry, and attaches the tenant-scoped
 * identity to the request. Fail closed on anything unexpected.
 *
 * Downstream handlers MUST read tenantId from request.auth — never from
 * client-supplied headers or bodies.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(DB_CLIENT) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = req.headers["authorization"];
    if (typeof header !== "string" || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException({ code: "unauthorized", message: "Sign in required" });
    }

    const tokenHash = hashSecret(header.slice("Bearer ".length));
    const session = await this.db.query.sessions.findFirst({
      where: eq(sessions.tokenHash, tokenHash),
    });
    if (!session || isExpired(session.expiresAt, new Date())) {
      if (session) {
        await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
      }
      throw new UnauthorizedException({
        code: "session_expired",
        message: "Your session expired. Please sign in again.",
      });
    }

    const user = await this.db.query.users.findFirst({
      where: and(eq(users.id, session.userId), eq(users.tenantId, session.tenantId)),
    });
    if (!user) {
      throw new UnauthorizedException({ code: "unauthorized", message: "Sign in required" });
    }

    const auth: RequestAuth = { userId: user.id, tenantId: session.tenantId, role: user.role };
    req.auth = auth;
    return true;
  }
}
