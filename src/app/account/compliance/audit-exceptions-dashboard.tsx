'use client';

import { RunExceptionsPanel } from './run-exceptions-panel';

/**
 * v1.42 Audit Exceptions — single-panel surface.
 *
 * Previously a two-tab container (Run exceptions + Incoming Activity Flags).
 * The v1.15 noncompliance pipeline that backed the Activity Flags tab was
 * removed in v1.42; this surface now renders only the modern v1.27+ audit-
 * run exceptions.
 */
export function AuditExceptionsDashboard() {
  return <RunExceptionsPanel />;
}
