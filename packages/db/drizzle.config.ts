import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Only used when emitting/applying migrations. Never hardcode a URL here.
    url: process.env.DATABASE_URL ?? "",
  },
});
