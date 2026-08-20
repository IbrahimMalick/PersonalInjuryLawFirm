import { apiUser } from "./auth";
import { isDemo } from "./mode";

// Demo APIs are open on a demo instance; on a live firm instance they still
// exist (for training/sales use by the firm) but require a signed-in user.
export async function demoApiAllowed(): Promise<boolean> {
  if (isDemo()) return true;
  return Boolean(await apiUser());
}
