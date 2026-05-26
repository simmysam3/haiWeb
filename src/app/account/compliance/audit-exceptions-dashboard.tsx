'use client';

import { useState } from 'react';
import { Tabs } from '@/components/tabs';
import { RunExceptionsPanel } from './run-exceptions-panel';
import { ComplianceDashboard } from './compliance-dashboard';

/**
 * v.1.41 Audit Exceptions — outer container with two-mode tabs.
 *
 * Both tabs surface "exceptions worth my attention" — but the data path is
 * different:
 *   Run exceptions   = audit_run_results with gaps / non-compliant status,
 *                      latest per (vendor, product) within the last 7d
 *   Activity flags   = agent-detected noncompliance (BOM resolution gaps,
 *                      vendor_not_on_network, manifest checks)
 *
 * Each panel owns its own fetch + count, surfaced via onCountChange to drive
 * the tab badges. Self-audit lives inside the Activity flags panel (it's the
 * trigger that produces flag entries).
 */

type ModeKey = 'runs' | 'flags';

export function AuditExceptionsDashboard() {
  const [mode, setMode] = useState<ModeKey>('runs');
  const [runCount, setRunCount] = useState<number | null>(null);
  const [flagCount, setFlagCount] = useState<number | null>(null);

  function changeMode(next: string) {
    if (next === 'runs' || next === 'flags') setMode(next);
  }

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          {
            key: 'runs',
            label: 'Run exceptions',
            count: runCount ?? undefined,
          },
          {
            key: 'flags',
            label: 'Incoming Activity Flags',
            count: flagCount ?? undefined,
          },
        ]}
        active={mode}
        onChange={changeMode}
      />
      {mode === 'runs' ? (
        <RunExceptionsPanel onCountChange={setRunCount} />
      ) : (
        <ComplianceDashboard onCountChange={setFlagCount} />
      )}
    </div>
  );
}
