import { redirect } from "next/navigation";
import { getActiveScopes } from "./_lib/scopes";

export default async function AuditsLanding() {
  const scopes = await getActiveScopes();
  if (scopes.length === 0) {
    redirect("/account/monitoring/audits/scope-library");
  }
  redirect("/account/monitoring/audits/dashboard");
}
