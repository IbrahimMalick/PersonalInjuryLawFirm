import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/product/AppShell";
import { audit } from "@/lib/audit";
import { requireFirmUser } from "@/lib/auth";
import { billingEnabled, firmBillingState, getStripe, TRIAL_DAYS } from "@/lib/billing";
import { getDb, tables } from "@/lib/db";
import { baseUrl } from "@/lib/email";
import { isDemo } from "@/lib/mode";

export const dynamic = "force-dynamic";

async function startCheckout(): Promise<void> {
  "use server";
  const { user, firm } = await requireFirmUser("admin");
  if (!billingEnabled()) redirect("/settings/billing");
  const stripe = getStripe();
  const db = await getDb();

  let customerId = firm.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: firm.name,
      metadata: { firmId: String(firm.id) },
    });
    customerId = customer.id;
    await db
      .update(tables.firms)
      .set({ stripeCustomerId: customerId })
      .where(eq(tables.firms.id, firm.id));
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: { metadata: { firmId: String(firm.id) } },
    metadata: { firmId: String(firm.id) },
    success_url: `${baseUrl()}/settings/billing?success=1`,
    cancel_url: `${baseUrl()}/settings/billing?canceled=1`,
  });
  await audit("billing.checkout_started", { firmId: firm.id, userId: user.id });
  redirect(session.url!);
}

async function openPortal(): Promise<void> {
  "use server";
  const { firm } = await requireFirmUser("admin");
  if (!billingEnabled() || !firm.stripeCustomerId) redirect("/settings/billing");
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: firm.stripeCustomerId,
    return_url: `${baseUrl()}/settings/billing`,
  });
  redirect(session.url);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  if (isDemo()) redirect("/demo");
  const { user, firm } = await requireFirmUser("admin");
  const state = firmBillingState(firm);
  const { success, canceled } = await searchParams;

  return (
    <AppShell user={user} firm={firm}>
      <div className="px-6 pt-4 pb-10 max-w-[720px] mx-auto">
        <div className="flex items-center justify-between pb-3">
          <h1 className="font-display font-bold uppercase tracking-wide text-2xl text-paper">
            Billing
          </h1>
          <Link href="/settings" className="field-label text-dim hover:text-inktext">
            ← Settings
          </Link>
        </div>

        {success && (
          <p className="text-ok text-[15px] border border-ok/50 rounded-sm px-4 py-3 mb-4">
            Subscription active — thank you. It can take a few seconds for the status below to
            update.
          </p>
        )}
        {canceled && (
          <p className="text-dim text-[15px] border border-ink-line rounded-sm px-4 py-3 mb-4">
            Checkout canceled — nothing was charged.
          </p>
        )}

        <div className="rounded-sm border border-ink-line bg-ink-raised px-5 py-4 space-y-4">
          {state.kind === "free" && (
            <p className="text-[15px] text-dim">
              Billing isn&apos;t configured on this deployment — every firm runs free. (Set
              Stripe env vars to enable subscriptions.)
            </p>
          )}

          {state.kind === "trialing" && (
            <>
              <div className="flex items-baseline justify-between">
                <span className="font-display font-bold uppercase tracking-wide text-lg text-paper">
                  Free trial
                </span>
                <span className="font-mono text-meter text-lg">
                  {state.daysLeft} day{state.daysLeft === 1 ? "" : "s"} left
                </span>
              </div>
              <p className="text-sm text-dim">
                Every feature is on during your {TRIAL_DAYS}-day trial. Subscribe any time —
                you won&apos;t be charged twice or lose anything.
              </p>
              <form action={startCheckout}>
                <button className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider px-5 py-2.5 hover:bg-manila-deep">
                  Subscribe
                </button>
              </form>
            </>
          )}

          {state.kind === "active" && (
            <>
              <div className="flex items-baseline justify-between">
                <span className="font-display font-bold uppercase tracking-wide text-lg text-paper">
                  Subscription
                </span>
                <span className={`field-label ${state.pastDue ? "text-stamp" : "text-ok"}`}>
                  {state.pastDue ? "PAYMENT PAST DUE" : "ACTIVE"}
                </span>
              </div>
              {state.pastDue && (
                <p className="text-sm text-stamp">
                  Your last payment failed. Update your card in the billing portal — Stripe
                  retries automatically for a few days before access pauses.
                </p>
              )}
              <form action={openPortal}>
                <button className="rounded-sm border border-manila text-manila font-display font-bold uppercase tracking-wider px-5 py-2.5 hover:bg-manila/10">
                  Manage subscription
                </button>
              </form>
            </>
          )}

          {state.kind === "blocked" && (
            <>
              <div className="flex items-baseline justify-between">
                <span className="font-display font-bold uppercase tracking-wide text-lg text-paper">
                  Trial ended
                </span>
                <span className="field-label text-stamp">SENDING PAUSED</span>
              </div>
              <p className="text-sm text-dim">
                Your inbox keeps receiving and triaging inquiries, and you can read everything
                — but approving replies is paused until you subscribe. Nothing has been
                deleted.
              </p>
              <form action={startCheckout}>
                <button className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider px-5 py-2.5 hover:bg-manila-deep">
                  Subscribe &amp; resume
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
