import {
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  eq,
  sessions,
  tenants,
  toAgencyTheme,
  users,
  verificationCodes,
  type Database,
} from "@repo/db";
import {
  AUTH_POLICY,
  loginResponseSchema,
  requestCodeResponseSchema,
  verifyCodeResponseSchema,
  type LoginResponse,
  type RequestCodeResponse,
  type VerifyCodeResponse,
} from "@repo/types";
import { DB_CLIENT } from "../db/database.module.js";
import { TelnyxService } from "../telnyx/telnyx.service.js";
import { AuditService } from "../audit/audit.service.js";
import { generateCode, generateToken, hashSecret, isExpired } from "./auth.logic.js";
import * as bcrypt from "bcryptjs";

/**
 * Phone-code auth. The agency registers phone numbers; users prove possession
 * via a 6-digit SMS code. Unknown numbers get the same response shape with no
 * SMS — no user enumeration, no SMS-pumping abuse.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    private readonly telnyx: TelnyxService,
    private readonly audit: AuditService,
  ) {}

  async requestCode(phone: string): Promise<RequestCodeResponse> {
    const user = await this.db.query.users.findFirst({ where: eq(users.phone, phone) });
    if (!user) {
      return requestCodeResponseSchema.parse({ sent: false });
    }

    const now = new Date();
    const existing = await this.db.query.verificationCodes.findFirst({
      where: eq(verificationCodes.phone, phone),
    });
    if (existing && !isExpired(existing.expiresAt, now)) {
      const ageMs = now.getTime() - existing.createdAt.getTime();
      if (ageMs < AUTH_POLICY.codeResendCooldownSeconds * 1000) {
        return requestCodeResponseSchema.parse({ sent: true });
      }
    }

    const code = generateCode();
    const expiresAt = new Date(now.getTime() + AUTH_POLICY.codeTtlMinutes * 60_000);
    await this.db
      .insert(verificationCodes)
      .values({ phone, codeHash: hashSecret(code), expiresAt, attempts: 0 })
      .onConflictDoUpdate({
        target: verificationCodes.phone,
        set: { codeHash: hashSecret(code), expiresAt, attempts: 0, createdAt: now },
      });

    await this.telnyx.sendSms({
      to: phone,
      body: `Your Hospice Care sign-in code is ${code}. It expires in ${AUTH_POLICY.codeTtlMinutes} minutes.`,
    });
    return requestCodeResponseSchema.parse({ sent: true });
  }

  async verifyCode(phone: string, code: string): Promise<VerifyCodeResponse> {
    const now = new Date();
    const row = await this.db.query.verificationCodes.findFirst({
      where: eq(verificationCodes.phone, phone),
    });

    const invalidCode = {
      code: "invalid_code",
      message: "That code didn't work. Check the code and try again.",
    } as const;

    if (!row || isExpired(row.expiresAt, now)) {
      if (row) {
        await this.db.delete(verificationCodes).where(eq(verificationCodes.phone, phone));
      }
      throw new UnauthorizedException(invalidCode);
    }

    if (row.attempts >= AUTH_POLICY.codeMaxAttempts) {
      await this.db.delete(verificationCodes).where(eq(verificationCodes.phone, phone));
      throw new UnauthorizedException({
        code: "too_many_attempts",
        message: "Too many tries. Request a new code.",
      });
    }

    if (hashSecret(code) !== row.codeHash) {
      await this.db
        .update(verificationCodes)
        .set({ attempts: row.attempts + 1 })
        .where(eq(verificationCodes.phone, phone));
      throw new UnauthorizedException(invalidCode);
    }

    await this.db.delete(verificationCodes).where(eq(verificationCodes.phone, phone));

    const user = await this.db.query.users.findFirst({ where: eq(users.phone, phone) });
    if (!user) {
      throw new UnauthorizedException(invalidCode);
    }
    const tenant = await this.db.query.tenants.findFirst({
      where: eq(tenants.id, user.tenantId),
    });
    if (!tenant) {
      throw new InternalServerErrorException({
        code: "tenant_missing",
        message: "Account configuration error",
      });
    }

    const token = generateToken();
    await this.db.insert(sessions).values({
      tokenHash: hashSecret(token),
      userId: user.id,
      tenantId: user.tenantId,
      expiresAt: new Date(now.getTime() + AUTH_POLICY.sessionTtlDays * 86_400_000),
    });
    await this.audit.log(user.tenantId, user.id, "login", "user", user.id);

    return verifyCodeResponseSchema.parse({
      token,
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
      theme: toAgencyTheme(tenant),
    });
  }

  /**
   * Email/password login for web dashboard and mobile app.
   * Returns the same session shape as verifyCode.
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    const invalid = {
      code: "invalid_credentials",
      message: "Email or password didn't match. Try again.",
    } as const;

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(invalid);
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException(invalid);
    }

    const tenant = await this.db.query.tenants.findFirst({
      where: eq(tenants.id, user.tenantId),
    });
    if (!tenant) {
      throw new InternalServerErrorException({
        code: "tenant_missing",
        message: "Account configuration error",
      });
    }

    const now = new Date();
    const token = generateToken();
    await this.db.insert(sessions).values({
      tokenHash: hashSecret(token),
      userId: user.id,
      tenantId: user.tenantId,
      expiresAt: new Date(now.getTime() + AUTH_POLICY.sessionTtlDays * 86_400_000),
    });
    await this.audit.log(user.tenantId, user.id, "login", "user", user.id);

    return loginResponseSchema.parse({
      token,
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
      theme: toAgencyTheme(tenant),
    });
  }
}
