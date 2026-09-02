import GuardrailsPanel from "@/components/GuardrailsPanel";
import AppShell from "@/components/product/AppShell";
import { requireFirmUser } from "@/lib/auth";
import { isDemo } from "@/lib/mode";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GuardrailsPage() {
  if (isDemo()) redirect("/demo/guardrails");
  const { user, firm } = await requireFirmUser();
  return (
    <AppShell user={user} firm={firm}>
      <GuardrailsPanel firmName={firm.name} />
    </AppShell>
  );
}
