import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Landing from "@/components/Landing";
import { currentUser } from "@/lib/auth";
import { isDemo } from "@/lib/mode";

// Dedicated, indexable public URL for the personal-injury pitch — see
// app/immigration/page.tsx for why this exists as its own route. The root
// "/" used to double as this page; it's now the overview homepage
// (components/HomeLanding.tsx) that points to all four areas, this one
// included.

export const metadata: Metadata = {
  title: "Nightshift for Personal Injury Law",
  description:
    "24/7 AI intake for personal-injury firms. Reads every after-hours message, builds a case file, computes the filing deadline, and drafts the reply — a human approves every send.",
};

export default async function PersonalInjuryLanding() {
  if (isDemo()) redirect("/demo");
  if (await currentUser()) redirect("/");
  return <Landing area="personal_injury" />;
}
