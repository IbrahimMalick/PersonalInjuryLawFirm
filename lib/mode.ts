// Instance mode. "live" is the product; "demo" is the sales demo — seeded
// leads, simulated clock, demo controls, no auth. One env var flips it.
export type NightshiftMode = "live" | "demo";

export function nightshiftMode(): NightshiftMode {
  return process.env.NIGHTSHIFT_MODE === "demo" ? "demo" : "live";
}

export function isDemo(): boolean {
  return nightshiftMode() === "demo";
}
