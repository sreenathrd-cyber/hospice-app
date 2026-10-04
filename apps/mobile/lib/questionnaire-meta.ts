import type { QuestionnaireKind } from "@repo/types";
import { ESAS_SYMPTOMS } from "@repo/types";

/**
 * Presentation metadata for the questionnaire renderer. Clinical wording only —
 * every threshold and score lives in @repo/types; this file holds labels.
 */
export const KIND_META: Record<QuestionnaireKind, { title: string; intro: string }> = {
  esas: {
    title: "Symptom check",
    intro: "Rate each symptom over the past 24 hours. 0 means no symptom, 10 is the worst you can imagine.",
  },
  pps: {
    title: "Activity check",
    intro: "Overall activity level right now, from 0% to 100%.",
  },
  phq2_gad2: {
    title: "Mood check",
    intro: "Over the last 2 weeks, how often have you been bothered by the following?",
  },
  bowel_bladder: {
    title: "Comfort check",
    intro: "A few quick questions about comfort today.",
  },
  caregiver_wellbeing: {
    title: "Caregiver check-in",
    intro: "This one is about you, the caregiver. Please answer honestly.",
  },
};

export const ESAS_LABELS: Record<(typeof ESAS_SYMPTOMS)[number], string> = {
  pain: "Pain",
  tiredness: "Tiredness",
  drowsiness: "Drowsiness",
  nausea: "Nausea",
  appetite: "Lack of appetite",
  shortnessOfBreath: "Shortness of breath",
  depression: "Depression",
  anxiety: "Anxiety",
  wellbeing: "Wellbeing (10 = worst)",
};

export const PHQ2_GAD2_LABELS: Record<string, string> = {
  littleInterest: "Little interest or pleasure in doing things",
  feelingDown: "Feeling down, depressed, or hopeless",
  nervous: "Feeling nervous, anxious, or on edge",
  worrying: "Not being able to stop or control worrying",
};

export const FREQUENCY_ANCHORS = ["Not at all", "Several days", "More than half the days", "Nearly every day"];

export const BM_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "two_days_ago", label: "2 days ago" },
  { value: "longer", label: "Longer than 2 days" },
] as const;

export const CAREGIVER_LABELS: Record<string, { label: string; low: string; high: string }> = {
  strain: { label: "How strained do you feel?", low: "Not at all", high: "Extremely" },
  sleepQuality: { label: "How was your sleep?", low: "Terrible", high: "Great" },
  feelingSupported: { label: "How supported do you feel?", low: "Not at all", high: "Very" },
};
