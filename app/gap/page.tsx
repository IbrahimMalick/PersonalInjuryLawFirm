import GapCalculator from "@/components/GapCalculator";
import AppShell from "@/components/product/AppShell";
import { requireFirmUser } from "@/lib/auth";
import { isDemo } from "@/lib/mode";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GapPage() {
  if (isDemo()) redirect("/demo/gap");
  const { user, firm } = await requireFirmUser();
  return (
    <AppShell user={user} firm={firm}>
      <GapCalculator />
    </AppShell>
  );
}
