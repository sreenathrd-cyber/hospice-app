import { z } from "zod";

/**
 * Explicit absence. Domain models never use null/undefined — when a value may
 * be missing, it is Option<T>. This forces every consumer to handle both cases.
 */
export type Option<T> = { kind: "some"; value: T } | { kind: "none" };

export function some<T>(value: T): Option<T> {
  return { kind: "some", value };
}

export function none<T>(): Option<T> {
  return { kind: "none" };
}

/** zod schema factory for Option<T> — validates the explicit shape at boundaries. */
export function optionSchema<T>(inner: z.ZodType<T>): z.ZodType<Option<T>> {
  return z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("some"), value: inner }),
    z.object({ kind: z.literal("none") }),
  ]) as z.ZodType<Option<T>>;
}

export function mapOption<T, U>(opt: Option<T>, fn: (value: T) => U): Option<U> {
  return opt.kind === "some" ? some(fn(opt.value)) : none<U>();
}

export function unwrapOr<T>(opt: Option<T>, fallback: T): T {
  return opt.kind === "some" ? opt.value : fallback;
}
