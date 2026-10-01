import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Landing from "@/components/Landing";
import { currentUser } from "@/lib/auth";
import { isDemo } from "@/lib/mode";

// Dedicated, indexable public URL for the family-law pitch — see
// app/immigration/page.tsx for why this exists as its own route instead of a
// query param. ?area=family still works and redirects here.

export const metadata: Metadata = {
  title: "Nightshift for Family Law",
  description:
    "24/7 AI intake for family-law firms. Flags a reported safety concern or an imminent hearing for immediate attention — a human approves every reply.",
};

export default async function FamilyLawLanding() {
  if (isDemo()) redirect("/demo");
  if (await currentUser()) redirect("/");
  return <Landing area="family_law" />;
}
