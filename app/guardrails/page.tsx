import GuardrailsPanel from "@/components/GuardrailsPanel";
import AppShell from "@/components/product/AppShell";
import { requireUser } from "@/lib/auth";
import { getFirm } from "@/lib/firm";
import { isDemo } from "@/lib/mode";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GuardrailsPage() {
  if (isDemo()) redirect("/demo/guardrails");
  const user = await requireUser();
  const firm = await getFirm();
  return (
    <AppShell user={user}>
      <GuardrailsPanel firmName={firm.name} />
    </AppShell>
  );
}
