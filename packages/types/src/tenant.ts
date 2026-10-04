import { z } from "zod";
import { tenantIdSchema } from "./branded.js";

/** White-label agency branding. Resolved once, applied everywhere — no per-screen conditionals. */
export const agencyThemeSchema = z.object({
  agencyName: z.string().min(1).max(80),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex color"),
  logoUrl: z.string().url().optional(),
  /** The agency's care line, dialed by the family's "Call care team" button. */
  careLinePhone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, "must be E.164 format")
    .optional(),
});
export type AgencyTheme = z.infer<typeof agencyThemeSchema>;

export const tenantSchema = z.object({
  id: tenantIdSchema,
  theme: agencyThemeSchema,
  createdAt: z.string().datetime(),
});
export type Tenant = z.infer<typeof tenantSchema>;

/** Built-in fallback theme used before the agency config loads. Never hardcode agency names in screens. */
export const defaultTheme = {
  agencyName: "Hospice Care",
  primaryColor: "#1F6F5B",
} as const satisfies Pick<AgencyTheme, "agencyName" | "primaryColor">;
