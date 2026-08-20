import GuardrailsPanel from "@/components/GuardrailsPanel";
import { DEMO_FIRM_NAME } from "@/lib/guardrails";

export default function DemoGuardrails() {
  return <GuardrailsPanel firmName={DEMO_FIRM_NAME} />;
}
