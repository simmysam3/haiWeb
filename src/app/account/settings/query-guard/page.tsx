import { cookies, headers } from 'next/headers';
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
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const base = `${proto}://${host}`;
  const opts = { headers: { cookie: cookieHeader }, cache: 'no-store' as const };
  try {
    const [matrixRes, rulesRes, settingsRes, statesRes, eventsRes] = await Promise.all([
      fetch(`${base}/api/account/query-guard/rules/resolved`, opts),
      fetch(`${base}/api/account/query-guard/rules`, opts),
      fetch(`${base}/api/account/query-guard/settings`, opts),
      fetch(`${base}/api/account/query-guard/states`, opts),
      fetch(`${base}/api/account/query-guard/events?limit=100`, opts),
    ]);
    // States + events are progressive enhancements like rules/settings —
    // degrade to empty lists if either fetch fails.
    let states: QueryGuardState[] = [];
    if (statesRes.ok) {
      const statesPayload = (await statesRes.json()) as { states?: QueryGuardState[] };
      if (Array.isArray(statesPayload.states)) states = statesPayload.states;
    }
    let events: QueryGuardEvent[] = [];
    if (eventsRes.ok) {
      const eventsPayload = (await eventsRes.json()) as { events?: QueryGuardEvent[] };
      if (Array.isArray(eventsPayload.events)) events = eventsPayload.events;
    }
    if (!matrixRes.ok) {
      return {
        matrix: synthesizeDefaultMatrix(),
        rules: [],
        defaultAlertEmail: null,
        states,
        events,
        error: `Unable to load query-guard rules (status ${matrixRes.status}). Showing spec defaults — saves may fail until the backend is reachable.`,
      };
    }
    const matrixPayload = (await matrixRes.json()) as { matrix?: ResolvedQueryGuardRule[] };
    // Raw rules + settings are progressive enhancements (global column
    // provenance, alert-email placeholder) — degrade quietly if they fail.
    let rules: QueryGuardRule[] = [];
    if (rulesRes.ok) {
      const rulesPayload = (await rulesRes.json()) as { rules?: QueryGuardRule[] };
      if (Array.isArray(rulesPayload.rules)) rules = rulesPayload.rules;
    }
    let defaultAlertEmail: string | null = null;
    if (settingsRes.ok) {
      const settings = (await settingsRes.json()) as QueryGuardSettings;
      defaultAlertEmail = settings.default_alert_email ?? null;
    }
    return {
      matrix: matrixPayload.matrix ?? synthesizeDefaultMatrix(),
      rules,
      defaultAlertEmail,
      states,
      events,
      error: null,
    };
  } catch (err) {
    console.error('[query-guard] fetch failed', err);
    return {
      matrix: synthesizeDefaultMatrix(),
      rules: [],
      defaultAlertEmail: null,
      states: [],
      events: [],
      error:
        'Unable to reach the query-guard service. Showing spec defaults — saves may fail until the backend is reachable.',
    };
  }
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
