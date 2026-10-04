import { createHash, randomBytes, randomInt } from "node:crypto";

/**
 * Pure auth primitives — no I/O, fully unit-tested. The service layer wires
 * these to Drizzle; the logic itself never touches the network or the clock
 * beyond what is passed in.
 */

/** 6-digit SMS code from a cryptographic RNG. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Opaque session token — 256 bits, shown to the client exactly once. */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * SHA-256 hex digest. Codes and tokens are stored hashed: a database read
 * never yields a usable code or token.
 */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
