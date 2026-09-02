"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavTabs({
  isAdmin,
  isOperator,
}: {
  isAdmin: boolean;
  isOperator?: boolean;
}) {
  const path = usePathname();
  const tabs = [
    { href: "/", label: "Inbox" },
    { href: "/gap", label: "Cost of the Gap" },
    { href: "/guardrails", label: "Guardrails" },
    ...(isAdmin ? [{ href: "/settings", label: "Settings" }] : []),
    ...(isOperator ? [{ href: "/operator", label: "Operator" }] : []),
  ];
  return (
    <nav className="flex items-end gap-1 h-full" aria-label="Screens">
      {tabs.map((t) => {
        const active = t.href === "/" ? path === "/" || path.startsWith("/lead") : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`folder-tab px-5 pt-2 pb-1.5 font-display font-semibold text-base uppercase tracking-wider ${
              active ? "bg-manila text-papertext" : "bg-ink-raised text-dim hover:text-inktext"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
