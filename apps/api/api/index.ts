// Vercel serverless entry point for the NestJS API.
// Creates the Nest application once per function instance and delegates
// requests to the underlying Express server.
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express, { type Request, type Response } from "express";
import { AppModule } from "../src/app.module.js";

const server = express();
let initialized: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    initialized = (async () => {
      const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
        logger: ["error", "warn"],
      });
      app.setGlobalPrefix("api/v1");
      await app.init();
    })();
  }
  await initialized;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  await ensureInitialized();
  server(req, res, () => {
    res.status(404).json({ message: "Not found" });
  });
}
