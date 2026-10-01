import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Landing from "@/components/Landing";
import { currentUser } from "@/lib/auth";
import { isDemo } from "@/lib/mode";

// Dedicated, indexable public URL for the immigration pitch — same Landing
// component and content as the root page, just reached by its own route
// instead of a query param (?area=immigration still works and redirects
// here — see app/page.tsx). Lets this area be linked, shared, and ranked on
// its own, without a second codebase or a second place to edit copy.

export const metadata: Metadata = {
  title: "Nightshift for Immigration Law",
  description:
    "24/7 AI intake for immigration law firms. Reads every after-hours message, flags what's time-critical, and drafts the reply — a human approves every send.",
};

export default async function ImmigrationLanding() {
  if (isDemo()) redirect("/demo");
  if (await currentUser()) redirect("/"); // logged in → the real inbox, not the pitch
  return <Landing area="immigration" />;
}
