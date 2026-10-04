import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestAuth } from "../tenant/tenant.guard.js";

/** Extracts the tenant-scoped identity the TenantGuard attached. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestAuth => {
    return ctx.switchToHttp().getRequest().auth as RequestAuth;
  },
);
