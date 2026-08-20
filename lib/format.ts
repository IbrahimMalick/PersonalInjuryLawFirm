// Time formatting for the product UI — always in the firm's timezone.

function toDate(iso: string): Date {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
}

export function fmtTime(iso: string, timezone: string): string {
  try {
    return toDate(iso).toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso: string, timezone: string): string {
  try {
    const d = toDate(iso);
    const sameDay =
      d.toLocaleDateString("en-US", { timeZone: timezone }) ===
      new Date().toLocaleDateString("en-US", { timeZone: timezone });
    const time = fmtTime(iso, timezone);
    if (sameDay) return time;
    return `${time} · ${d.toLocaleDateString("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
    })}`;
  } catch {
    return iso;
  }
}

export function agoLabel(iso: string): string {
  const ms = Date.now() - toDate(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h ${min % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}
