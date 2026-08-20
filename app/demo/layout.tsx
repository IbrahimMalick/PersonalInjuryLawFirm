import Shell from "@/components/Shell";
import { isDemo } from "@/lib/mode";
import { requireUser } from "@/lib/auth";

// The sales demo lives here, unchanged: sim clock, seeded leads, demo
// controls. On a demo instance (NIGHTSHIFT_MODE=demo) it's open; on a live
// firm instance it's kept behind login so a public URL never exposes it.
export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  if (!isDemo()) await requireUser();
  return <Shell>{children}</Shell>;
}
