import { ESCALATION_DELAY_SECONDS } from "./alerts";

// Persistent urgency for the inbox row — the one-time Sign Now email and the
// 30-min escalation only fire once each; this is what a reviewer sees every
// time they glance at the list, for as long as a lead sits unanswered.
//
// Sign Now leads use the same clock as the escalation email (so the inbox
// turns red exactly when that reminder would fire); everything else uses a
// slower, generic clock.

export type Urgency = "none" | "amber" | "red";

const SIGN_NOW_RED_MIN = ESCALATION_DELAY_SECONDS / 60; // 30 — matches lib/alerts.ts
const SIGN_NOW_AMBER_MIN = SIGN_NOW_RED_MIN / 2; // 15
const DEFAULT_AMBER_MIN = 60;
const DEFAULT_RED_MIN = 120;

function toDate(iso: string): Date {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
}

export function leadUrgency(params: {
  /** Only a lead still awaiting a human is ever urgent. */
  needsEyes: boolean;
  receivedAt: string;
  routing: string | null;
  now?: Date;
}): Urgency {
  if (!params.needsEyes) return "none";
  const waitedMin =
    ((params.now ?? new Date()).getTime() - toDate(params.receivedAt).getTime()) / 60_000;
  const isSignNow = params.routing === "sign_now";
  const amberAt = isSignNow ? SIGN_NOW_AMBER_MIN : DEFAULT_AMBER_MIN;
  const redAt = isSignNow ? SIGN_NOW_RED_MIN : DEFAULT_RED_MIN;
  if (waitedMin >= redAt) return "red";
  if (waitedMin >= amberAt) return "amber";
  return "none";
}
