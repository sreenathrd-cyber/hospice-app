import { Global, Module } from "@nestjs/common";
import { createDb, type Database } from "@repo/db";

export const DB_CLIENT = "DB_CLIENT";

/**
 * Single database client for the API. Global because every module needs it
 * and there is exactly one. Fails loudly at boot without DATABASE_URL — a PHI
 * backend must never boot misconfigured and fail mysteriously per-request.
 */
@Global()
@Module({
  providers: [
    {
      provide: DB_CLIENT,
      useFactory: (): Database => {
        const url = process.env.DATABASE_URL;
        if (!url) {
          throw new Error("DATABASE_URL is not set — the API cannot start without its database");
        }
        return createDb(url);
      },
    },
  ],
  exports: [DB_CLIENT],
})
export class DatabaseModule {}
