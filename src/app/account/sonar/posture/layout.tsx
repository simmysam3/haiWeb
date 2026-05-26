import type { ReactNode } from "react";
import { BacklogTabs } from "./_components/backlog-tabs";
import { getActiveScopes } from "../_lib/scopes";

export default async function BacklogLayout({ children }: { children: ReactNode }) {
  const scopesResult = await getActiveScopes();
  const hasScopes = scopesResult.kind === 'ok' && scopesResult.scopes.length > 0;
  return (
    <div>
      <BacklogTabs hasScopes={hasScopes} />
      {children}
    </div>
  );
}
