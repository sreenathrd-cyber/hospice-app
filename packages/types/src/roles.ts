import { z } from "zod";

/**
 * One app, two experiences. The sign-in response carries the role; the mobile
 * router sends patients/caregivers to (patient) and clinicians/admins to (team).
 */
export const userRoleSchema = z.enum(["patient", "caregiver", "clinician", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const teamRoleSchema = z.enum(["clinician", "admin"]);
export type TeamRole = z.infer<typeof teamRoleSchema>;

export const familyRoleSchema = z.enum(["patient", "caregiver"]);
export type FamilyRole = z.infer<typeof familyRoleSchema>;

export function isTeamRole(role: UserRole): role is TeamRole {
  return role === "clinician" || role === "admin";
}

export function isFamilyRole(role: UserRole): role is FamilyRole {
  return role === "patient" || role === "caregiver";
}
