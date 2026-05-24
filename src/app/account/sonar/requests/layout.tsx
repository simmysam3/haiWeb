import type { ReactNode } from "react";

/**
 * v.1.41: layout shed its top-level Active/Declined tab strip. Declined now
 * lives as a value of the in-page direction-tab strip (`?direction=declined`),
 * so this layout is a plain pass-through. The `getActiveScopes` hint has
 * moved into the page itself via the existing data fetches; keeping the
 * layout slim avoids re-rendering tabs at two levels.
 */
export default function RequestManagementLayout({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
