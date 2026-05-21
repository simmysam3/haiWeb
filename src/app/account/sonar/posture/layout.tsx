import type { ReactNode } from "react";
import { PostureTabs } from "./_components/posture-tabs";
import { CoverageHeaderStrip } from "./_components/coverage-header-strip";
import { getActiveScopes } from "../_lib/scopes";

export default async function PostureLayout({ children }: { children: ReactNode }) {
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
        /sonar/dashboard. Visible on every Posture child page so the
        workflow always shows the metric you're acting against. Server
        component; silent-fail on transport errors (Dashboard owns the
        canonical error banner).
      */}
      <CoverageHeaderStrip />
      <PostureTabs hasScopes={hasScopes} />
      {children}
    </div>
  );
}
