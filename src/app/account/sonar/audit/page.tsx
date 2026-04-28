import { redirect } from "next/navigation";
import { getActiveScopes } from "./_lib/scopes";

export default async function AuditLanding() {
  const scopes = await getActiveScopes();
  if (scopes.length === 0) {
    redirect("/account/sonar/audit/nominations");
  }
  redirect("/account/sonar/audit/dashboard");
}
