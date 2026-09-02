import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { audit } from "@/lib/audit";
import { billingEnabled, getStripe, mapStripeStatus } from "@/lib/billing";
import { getDb, tables } from "@/lib/db";

export const dynamic = "force-dynamic";

// Stripe is the source of truth for subscription state; this webhook keeps
// the firms table in sync. Signature-verified; unsigned requests do nothing.

async function firmIdForCustomer(customerId: string): Promise<number | null> {
  const db = await getDb();
  const rows = await db
    .select({ id: tables.firms.id })
    .from(tables.firms)
    .where(eq(tables.firms.stripeCustomerId, customerId))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function POST(request: Request) {
  if (!billingEnabled() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new NextResponse("missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    return new NextResponse(`invalid signature: ${(e as Error).message}`, { status: 400 });
  }

  const db = await getDb();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const firmId = Number(session.metadata?.firmId);
      if (firmId && session.customer && session.subscription) {
        await db
          .update(tables.firms)
          .set({
            stripeCustomerId: String(session.customer),
            stripeSubscriptionId: String(session.subscription),
            subscriptionStatus: "active",
          })
          .where(eq(tables.firms.id, firmId));
        await audit("billing.subscribed", { firmId, detail: { event: event.id } });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const firmId =
        Number(sub.metadata?.firmId) || (await firmIdForCustomer(String(sub.customer)));
      if (firmId) {
        const status =
          event.type === "customer.subscription.deleted"
            ? "canceled"
            : mapStripeStatus(sub.status);
        await db
          .update(tables.firms)
          .set({ subscriptionStatus: status, stripeSubscriptionId: sub.id })
          .where(eq(tables.firms.id, firmId));
        await audit("billing.status_changed", { firmId, detail: { status, event: event.id } });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
