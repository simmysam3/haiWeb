import type { ReactNode } from "react";
import { AuditsTabs } from "./audits-tabs";
import { getActiveScopes } from "./_lib/scopes";

export default async function AuditsLayout({ children }: { children: ReactNode }) {
  const scopes = await getActiveScopes();
  return (
    <div>
      <AuditsTabs hasScopes={scopes.length > 0} />
      {children}
    </div>
  );
}
