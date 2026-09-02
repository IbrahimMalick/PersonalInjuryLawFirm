import Stripe from "stripe";
import type { FirmRow } from "./db/schema";

// Stripe billing. Signup starts a 14-day trial; a subscription (Stripe
// Checkout) keeps the firm active after it. When Stripe env vars are absent
// the platform runs in "free" mode — nothing is gated — so dev and early
// pilots work without an account.

export const TRIAL_DAYS = 14;

export function billingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

export function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export type BillingState =
  | { kind: "free" }
  | { kind: "trialing"; daysLeft: number }
  | { kind: "active"; pastDue: boolean }
  | { kind: "blocked" };

export function firmBillingState(firm: FirmRow): BillingState {
  if (!billingEnabled()) return { kind: "free" };
  if (firm.subscriptionStatus === "active" || firm.subscriptionStatus === "trialing") {
    return { kind: "active", pastDue: false };
  }
  if (firm.subscriptionStatus === "past_due") {
    return { kind: "active", pastDue: true }; // grace period; Stripe retries
  }
  // No live subscription — fall back to the signup trial window.
  if (firm.trialEndsAt && new Date(firm.trialEndsAt).getTime() > Date.now()) {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(firm.trialEndsAt).getTime() - Date.now()) / 86_400_000)
    );
    return { kind: "trialing", daysLeft };
  }
  return { kind: "blocked" };
}

/** Map a Stripe subscription status onto our column. */
export function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
    case "trialing":
      return status;
    case "past_due":
      return "past_due";
    default:
      return "canceled"; // canceled, unpaid, incomplete, incomplete_expired, paused
  }
}
