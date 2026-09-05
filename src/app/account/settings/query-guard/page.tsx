import { fetchBffJson } from '@/lib/server-fetch';
import type {
  QueryGuardEvent,
  QueryGuardRule,
  QueryGuardSettings,
  QueryGuardState,
  ResolvedQueryGuardRule,
  TrustClass,
} from '@haiwave/protocol';
import { DEFAULT_QUERY_GUARD_RULES } from '@haiwave/protocol';
import { PageHeader } from '@/components/page-header';
import { GuardRulesMatrix, RULE_TYPES, TRUST_CLASSES } from './_components/guard-rules-matrix';
import { EnforcementStates } from './_components/enforcement-states';
import { TripHistory } from './_components/trip-history';

/**
 * If the BFF fetch fails we still need to display *something* — synthesising
 * the 16-row resolved matrix from the protocol's DEFAULT_QUERY_GUARD_RULES
 * guarantees the grid always shows the real backend defaults rather than an
 * empty shell. The error banner above the grid makes the failure explicit so
 * users know writes will likely also fail.
 */
function synthesizeDefaultMatrix(): ResolvedQueryGuardRule[] {
  const matrix: ResolvedQueryGuardRule[] = [];
  for (const tc of TRUST_CLASSES as readonly TrustClass[]) {
    for (const rt of RULE_TYPES) {
      matrix.push({
        rule_type: rt,
        trust_class: tc,
        ...DEFAULT_QUERY_GUARD_RULES[rt],
        source: 'default',
        rule_id: null,
      });
    }
  }
  return matrix;
}

interface LoadResult {
  matrix: ResolvedQueryGuardRule[];
  rules: QueryGuardRule[];
  defaultAlertEmail: string | null;
  states: QueryGuardState[];
  events: QueryGuardEvent[];
  error: string | null;
}

async function loadQueryGuard(): Promise<LoadResult> {
  // D-62: every lane goes through `fetchBffJson`, which takes the origin from
  // the configured PORTAL_BASE_URL (never the request's Host header), forwards
  // the cookie, and never throws — a network failure is `status: 0`.
  const [matrixRes, rulesRes, settingsRes, statesRes, eventsRes] = await Promise.all([
    fetchBffJson<{ matrix?: ResolvedQueryGuardRule[] }>('/api/account/query-guard/rules/resolved'),
    fetchBffJson<{ rules?: QueryGuardRule[] }>('/api/account/query-guard/rules'),
    fetchBffJson<QueryGuardSettings>('/api/account/query-guard/settings'),
    fetchBffJson<{ states?: QueryGuardState[] }>('/api/account/query-guard/states'),
    fetchBffJson<{ events?: QueryGuardEvent[] }>('/api/account/query-guard/events?limit=100'),
  ]);
  // States + events are progressive enhancements like rules/settings —
  // degrade to empty lists if either fetch fails.
  let states: QueryGuardState[] = [];
  if (statesRes.kind === 'ok' && Array.isArray(statesRes.data.states)) states = statesRes.data.states;
  let events: QueryGuardEvent[] = [];
  if (eventsRes.kind === 'ok' && Array.isArray(eventsRes.data.events)) events = eventsRes.data.events;
  if (matrixRes.kind === 'error') {
    if (matrixRes.status === 0) {
      console.error('[query-guard] fetch failed', matrixRes.message);
      return {
        matrix: synthesizeDefaultMatrix(),
        rules: [],
        defaultAlertEmail: null,
        states,
        events,
        error:
          'Unable to reach the query-guard service. Showing spec defaults — saves may fail until the backend is reachable.',
      };
    }
    return {
      matrix: synthesizeDefaultMatrix(),
      rules: [],
      defaultAlertEmail: null,
      states,
      events,
      error: `Unable to load query-guard rules (status ${matrixRes.status}). Showing spec defaults — saves may fail until the backend is reachable.`,
    };
  }
  // Raw rules + settings are progressive enhancements (global column
  // provenance, alert-email placeholder) — degrade quietly if they fail.
  let rules: QueryGuardRule[] = [];
  if (rulesRes.kind === 'ok' && Array.isArray(rulesRes.data.rules)) rules = rulesRes.data.rules;
  let defaultAlertEmail: string | null = null;
  if (settingsRes.kind === 'ok') defaultAlertEmail = settingsRes.data.default_alert_email ?? null;
  return {
    matrix: matrixRes.data.matrix ?? synthesizeDefaultMatrix(),
    rules,
    defaultAlertEmail,
    states,
    events,
    error: null,
  };
}

/**
 * Server component for /account/settings/query-guard. Loads the caller's
 * resolved rules matrix (plus raw override rows and settings) on the server
 * via the BFF passthrough so the first paint already has data, then hands it
 * to the client GuardRulesMatrix for interactive editing.
 *
 * Auth: covered by src/proxy.ts which redirects unauthenticated /account/*
 * requests to /api/auth/login before this component runs.
 */
export default async function QueryGuardPage() {
  const { matrix, rules, defaultAlertEmail, states, events, error } = await loadQueryGuard();

  return (
    <div className="space-y-2">
      <PageHeader
        title="Query Guard"
        description="Rules-based limits on how counterparties may query you — thresholds, windows, and enforcement actions by trust class."
      />
      {error && (
        <div
          role="alert"
          className="mt-3 p-3 rounded-md border border-problem/30 bg-problem/10 text-sm text-problem"
        >
          {error}
        </div>
      )}
      <GuardRulesMatrix
        initialMatrix={matrix}
        defaultAlertEmail={defaultAlertEmail}
        initialRules={rules}
      />
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-charcoal">Active enforcement</h2>
        <EnforcementStates initialStates={states} />
      </section>
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-charcoal">Trip history</h2>
        <TripHistory initialEvents={events} />
      </section>
    </div>
  );
}
