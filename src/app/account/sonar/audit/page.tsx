import { redirect } from "next/navigation";
import { getActiveScopes } from "./_lib/scopes";

export default async function AuditLanding() {
  const scopesResult = await getActiveScopes();
  // On error, fall through to /dashboard which renders the error banner —
  // do not bounce the user to /nominations and tell them they have no
  // scopes when haiCore is actually down.
  if (scopesResult.kind === 'ok' && scopesResult.scopes.length === 0) {
    redirect("/account/sonar/observations?tab=audit");
  }
  redirect("/account/sonar/audit/dashboard");
}
