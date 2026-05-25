import type { ReactNode } from "react";
import { BacklogTabs } from "./_components/backlog-tabs";
import { CoverageHeaderStrip } from "./_components/coverage-header-strip";
import { getActiveScopes } from "../_lib/scopes";

// v.1.41 Backlog IA — folder name kept as `posture/` (URL preserved at
// /account/sonar/posture per the label-only test phase). Layout still
// wraps every child page; the tab bar is now mode-switching across
// Events / Gaps / Obligations.
export default async function BacklogLayout({ children }: { children: ReactNode }) {
  const scopesResult = await getActiveScopes();
  // The layout only needs to know whether tabs should be enabled. On error,
  // fail closed (treat as no scopes) so the tab bar still renders. The
  // child page renders the user-visible error banner.
  const hasScopes = scopesResult.kind === 'ok' && scopesResult.scopes.length > 0;
  return (
    <div>
      {/*
        v1.37 — slim coverage context strip: one row of coverage % + delta +
        SKU count + a deep-link to the full coverage surface at
        /sonar/dashboard. Visible on every Backlog child page so the
        workflow always shows the metric you're acting against. Server
        component; silent-fail on transport errors (Dashboard owns the
        canonical error banner).
      */}
      <CoverageHeaderStrip />
      <BacklogTabs hasScopes={hasScopes} />
      {children}
    </div>
  );
}
