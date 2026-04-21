import type { ReactNode } from "react";
import { AuditsTabs } from "./audits-tabs";

export default function AuditsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <AuditsTabs />
      {children}
    </div>
  );
}
