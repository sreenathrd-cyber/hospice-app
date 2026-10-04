import { Controller, Get } from "@nestjs/common";
import { healthResponseSchema } from "@repo/types";

/** Public liveness probe. Carries no PHI and requires no auth. */
@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return healthResponseSchema.parse({
      status: "ok",
      version: "0.1.0",
      time: new Date().toISOString(),
    });
  }
}
