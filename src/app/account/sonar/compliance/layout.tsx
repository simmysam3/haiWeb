import type { ReactNode } from "react";
import { ComplianceTabs } from "./compliance-tabs";
import { getActiveScopes } from "./_lib/scopes";

export default async function AuditLayout({ children }: { children: ReactNode }) {
  const scopesResult = await getActiveScopes();
  // The layout only needs to know whether tabs should be enabled. On error,
  // fail closed (treat as no scopes) so the tab bar still renders. The
  // child page renders the user-visible error banner.
  const hasScopes = scopesResult.kind === 'ok' && scopesResult.scopes.length > 0;
  return (
    <div>
      <ComplianceTabs hasScopes={hasScopes} />
      {children}
    </div>
  );
}
