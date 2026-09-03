"use client";

import { useEffect, useRef } from "react";

// Progressive enhancement for the public intake form: once the form is
// submitting, lock the button so a fast double/triple-click can't fire it
// again. With JS off it's a plain submit button.

export default function IntakeSubmitButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const btn = ref.current;
    const form = btn?.form;
    if (!btn || !form) return;

    const original = btn.textContent;
    const lock = () => {
      btn.disabled = true;
      btn.textContent = "Sending…";
    };
    // If the browser restores the page from bfcache (Back button), un-lock.
    const restore = (e: PageTransitionEvent) => {
      if (e.persisted) {
        btn.disabled = false;
        if (original) btn.textContent = original;
      }
    };

    form.addEventListener("submit", lock);
    window.addEventListener("pageshow", restore);
    return () => {
      form.removeEventListener("submit", lock);
      window.removeEventListener("pageshow", restore);
    };
  }, []);

  return (
    <button
      ref={ref}
      type="submit"
      className={className}
    >
      {children}
    </button>
  );
}
