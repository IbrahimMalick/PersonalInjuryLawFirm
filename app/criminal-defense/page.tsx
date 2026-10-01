import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Landing from "@/components/Landing";
import { currentUser } from "@/lib/auth";
import { isDemo } from "@/lib/mode";

// Dedicated, indexable public URL for the criminal-defense pitch — see
// app/immigration/page.tsx for why this exists as its own route instead of a
// query param. ?area=criminal still works and redirects here.

export const metadata: Metadata = {
  title: "Nightshift for Criminal Defense",
  description:
    "24/7 AI intake for criminal-defense firms. Flags a person in custody, a warrant, or a court date this week — the case file holds no account of events, and every reply is fixed, reviewed wording.",
};

export default async function CriminalDefenseLanding() {
  if (isDemo()) redirect("/demo");
  if (await currentUser()) redirect("/");
  return <Landing area="criminal_defense" />;
}
