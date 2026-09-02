import { redirect } from "next/navigation";

// The single-tenant first-run flow became multi-tenant signup.
export default function SetupRedirect() {
  redirect("/signup");
}
