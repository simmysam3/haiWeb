'use client';

import { useState } from 'react';
import type {
  QueryGuardAction,
  QueryGuardOriginFilter,
  QueryGuardRule,
  QueryGuardRuleType,
  QueryGuardRuleUpsert,
  QueryGuardWindow,
  ResolvedQueryGuardRule,
  TrustClass,
} from '@haiwave/protocol';
import { DEFAULT_QUERY_GUARD_RULES } from '@haiwave/protocol';
import { Button, Drawer } from '@/components';
import { RuleDrawerBody, type RuleFormValue } from './rule-drawer-body';
import { TestDrawer } from './test-drawer';

export const RULE_TYPES = ['sku_repeat', 'sku_breadth', 'ad_hoc_cap', 'excess_volume'] as const;
export const TRUST_CLASSES = [
  'unknown',
  'behavioral_only',
  'trading_pair',
  'premier_partner',
] as const;

const RULE_TYPE_LABEL: Record<QueryGuardRuleType, string> = {
  sku_repeat: 'sku_repeat',
  sku_breadth: 'sku_breadth',
  ad_hoc_cap: 'ad_hoc_cap',
  excess_volume: 'excess_volume',
};

const TRUST_CLASS_LABEL: Record<TrustClass, string> = {
  unknown: 'unknown',
  behavioral_only: 'behavioral_only',
  trading_pair: 'trading_pair',
  premier_partner: 'premier_partner',
};

const TRUST_CLASS_FRIENDLY: Record<TrustClass, string> = {
  unknown: 'Unknown',
  behavioral_only: 'Behavioral only',
  trading_pair: 'Trading pair',
  premier_partner: 'Premier partner',
};

/**
 * One matrix cell's effective rule. For trust-class columns this is a
 * resolved-matrix row verbatim; for the "All counterparties" column it is
 * derived from the raw client_global rule (or the spec default when no
 * global override exists). `trust_class: null` marks the global column.
 */
export interface CellRule {
  rule_type: QueryGuardRuleType;
  trust_class: TrustClass | null;
  window: QueryGuardWindow | null;
  threshold: number;
  origin_filter: QueryGuardOriginFilter;
  actions: QueryGuardAction[];
  enabled: boolean;
  source: 'default' | 'global' | 'class';
  rule_id: string | null;
}

interface Props {
  initialMatrix: ResolvedQueryGuardRule[];
  defaultAlertEmail: string | null;
  /**
   * Raw stored rules (overrides only). The client_global rows drive the
   * "All counterparties" column and its reset logic. Optional so the page
   * can omit it when the raw-rules fetch fails — the global column then
   * falls back to spec defaults.
   */
  initialRules?: QueryGuardRule[];
}

/**
 * Interactive 4 × 5 query-guard rules matrix for
 * /account/settings/query-guard (spec §9.1). Rows = 4 rule types; columns =
 * "All counterparties" (client_global scope) + 4 trust classes. Cell click
 * opens a drawer for editing threshold / window / origin filter / actions /
 * enabled; Save PUTs an upsert to the BFF and re-fetches the resolved
 * matrix; "Reset to default" deletes the override row the cell owns.
 */
export function GuardRulesMatrix({ initialMatrix, defaultAlertEmail, initialRules = [] }: Props) {
  const [matrix, setMatrix] = useState<ResolvedQueryGuardRule[]>(initialMatrix);
  const [rules, setRules] = useState<QueryGuardRule[]>(initialRules);
  const [open, setOpen] = useState<{ tc: TrustClass | null; rt: QueryGuardRuleType } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  function find(tc: TrustClass | null, rt: QueryGuardRuleType): CellRule {
    if (tc !== null) {
      const row = matrix.find((r) => r.trust_class === tc && r.rule_type === rt);
      if (row) return { ...row };
      const d = DEFAULT_QUERY_GUARD_RULES[rt];
      return { rule_type: rt, trust_class: tc, ...d, source: 'default', rule_id: null };
    }
    const globalRule = rules.find((r) => r.scope === 'client_global' && r.rule_type === rt);
    if (globalRule) {
      return {
        rule_type: rt,
        trust_class: null,
        window: globalRule.window,
        threshold: globalRule.threshold,
        origin_filter: globalRule.origin_filter,
        actions: globalRule.actions,
        enabled: globalRule.enabled,
        source: 'global',
        rule_id: globalRule.id,
      };
    }
    const d = DEFAULT_QUERY_GUARD_RULES[rt];
    return { rule_type: rt, trust_class: null, ...d, source: 'default', rule_id: null };
  }

  async function refetch(): Promise<void> {
    const [resolvedRes, rulesRes] = await Promise.all([
      fetch('/api/account/query-guard/rules/resolved', { cache: 'no-store' }),
      fetch('/api/account/query-guard/rules', { cache: 'no-store' }),
    ]);
    if (resolvedRes.ok) {
      const payload = (await resolvedRes.json()) as { matrix?: ResolvedQueryGuardRule[] };
      if (Array.isArray(payload.matrix)) setMatrix(payload.matrix);
    }
    if (rulesRes.ok) {
      const payload = (await rulesRes.json()) as { rules?: QueryGuardRule[] };
      if (Array.isArray(payload.rules)) setRules(payload.rules);
    }
  }

  async function save(cell: CellRule, form: RuleFormValue): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const body: QueryGuardRuleUpsert = {
        scope: cell.trust_class === null ? 'client_global' : 'trust_class',
        trust_class: cell.trust_class,
        rule_type: cell.rule_type,
        window: cell.rule_type === 'excess_volume' ? null : form.window,
        threshold: form.threshold,
        origin_filter: form.originFilter,
        actions: form.actions,
        enabled: form.enabled,
      };
      const res = await fetch('/api/account/query-guard/rules', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Save failed (${res.status}): ${text}`);
      }
      await refetch();
      setOpen(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefault(cell: CellRule): Promise<void> {
    if (!cell.rule_id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/query-guard/rules/${cell.rule_id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Reset failed (${res.status}): ${text}`);
      }
      await refetch();
      setOpen(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setSaving(false);
    }
  }

  const openCell = open ? find(open.tc, open.rt) : null;
  // Reset deletes the override row the cell itself owns: a class cell's
  // class-scoped row, or the global cell's client_global row. A class cell
  // inheriting from global has no row of its own to delete.
  const canReset =
    openCell !== null &&
    openCell.rule_id !== null &&
    ((openCell.trust_class !== null && openCell.source === 'class') ||
      (openCell.trust_class === null && openCell.source === 'global'));

  return (
    <div className="mt-6">
      <div className="mb-4 flex justify-end">
        <Button variant="secondary" onClick={() => setTestOpen(true)}>
          Test rules
        </Button>
      </div>
      <div
        role="grid"
        className="grid grid-cols-6 gap-px bg-slate/15 border border-slate/15 rounded-md overflow-hidden"
      >
        <div className="bg-light-gray p-3 text-xs font-semibold text-charcoal">Rule \ Class</div>
        <div className="bg-light-gray p-3 text-xs font-semibold text-charcoal">
          All counterparties
        </div>
        {TRUST_CLASSES.map((tc) => (
          <div key={tc} className="bg-light-gray p-3 text-xs font-semibold text-charcoal">
            {TRUST_CLASS_LABEL[tc]}
          </div>
        ))}
        {RULE_TYPES.map((rt) => (
          <RuleRow key={rt} rt={rt} find={find} onCellClick={(tc) => setOpen({ tc, rt })} />
        ))}
      </div>

      <GuardSummary matrix={matrix} />

      {error && (
        <p className="mt-3 text-sm text-problem" role="alert">
          {error}
        </p>
      )}

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={
          open
            ? `${RULE_TYPE_LABEL[open.rt]} / ${open.tc === null ? 'All counterparties' : TRUST_CLASS_LABEL[open.tc]}`
            : ''
        }
      >
        {open && openCell && (
          <RuleDrawerBody
            key={`${open.tc ?? 'global'}-${open.rt}`}
            cell={openCell}
            defaultAlertEmail={defaultAlertEmail}
            saving={saving}
            canReset={canReset}
            onSave={(form) => save(openCell, form)}
            onReset={() => resetToDefault(openCell)}
            onClose={() => setOpen(null)}
          />
        )}
      </Drawer>

      <TestDrawer open={testOpen} onClose={() => setTestOpen(false)} />
    </div>
  );
}

function RuleRow({
  rt,
  find,
  onCellClick,
}: {
  rt: QueryGuardRuleType;
  find: (tc: TrustClass | null, rt: QueryGuardRuleType) => CellRule;
  onCellClick: (tc: TrustClass | null) => void;
}) {
  const columns: (TrustClass | null)[] = [null, ...TRUST_CLASSES];
  return (
    <>
      <div className="bg-white p-3 text-sm font-medium text-charcoal">
        {RULE_TYPE_LABEL[rt]}
        {rt === 'excess_volume' && (
          <span className="mt-1 block text-[10px] font-normal text-slate">
            Requires counterparty agent &ge; protocol v3.51
          </span>
        )}
      </div>
      {columns.map((tc) => {
        const cell = find(tc, rt);
        return (
          <button
            key={`${rt}-${tc ?? 'global'}`}
            type="button"
            role="gridcell"
            aria-label={`${rt} rule for ${tc === null ? 'all counterparties' : tc}`}
            className="bg-white p-3 text-left hover:bg-light-gray transition-colors"
            onClick={() => onCellClick(tc)}
          >
            <span className="block text-sm text-charcoal">{formatCell(cell)}</span>
            <span
              className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${chipClass(cell.source)}`}
            >
              {SOURCE_LABEL[cell.source]}
            </span>
          </button>
        );
      })}
    </>
  );
}

function formatCell(cell: CellRule): string {
  if (cell.rule_type === 'excess_volume') return `${cell.threshold}%`;
  return `${cell.threshold} / ${cell.window ?? 'day'}`;
}

const SOURCE_LABEL: Record<CellRule['source'], string> = {
  default: 'Default',
  global: 'Global',
  class: 'Class',
};

function chipClass(source: CellRule['source']): string {
  if (source === 'global') return 'bg-success/15 text-success';
  if (source === 'class') return 'bg-navy/10 text-navy';
  return 'bg-light-gray text-slate';
}

const SUMMARY_ORDER: QueryGuardRuleType[] = [
  'sku_breadth',
  'sku_repeat',
  'ad_hoc_cap',
  'excess_volume',
];

const ACTION_VERB: Record<QueryGuardAction['type'], string> = {
  alert: 'alert',
  pause: 'pause',
  log: 'log',
  block: 'block',
};

function summarizeRule(rule: ResolvedQueryGuardRule): string {
  if (!rule.enabled) return `${ruleNoun(rule)} off`;
  const verb = ACTION_VERB[rule.actions[0]?.type ?? 'alert'];
  if (rule.rule_type === 'excess_volume') {
    return `${verb} at ${rule.threshold}% over largest historic order`;
  }
  const window = rule.window ?? 'day';
  if (rule.rule_type === 'sku_breadth') return `${verb} at ${rule.threshold} distinct SKUs/${window}`;
  if (rule.rule_type === 'sku_repeat') return `${verb} at ${rule.threshold} queries/SKU/${window}`;
  return `${verb} at ${rule.threshold} ad-hoc requests/${window}`;
}

function ruleNoun(rule: ResolvedQueryGuardRule): string {
  if (rule.rule_type === 'sku_breadth') return 'SKU breadth';
  if (rule.rule_type === 'sku_repeat') return 'SKU repeat';
  if (rule.rule_type === 'ad_hoc_cap') return 'ad-hoc cap';
  return 'excess volume';
}

/**
 * Plain-English restatement of each trust class's effective rules, one
 * bullet per class (DriftSummary idiom), so the operator reads behavior
 * rather than reverse-engineering it from twenty cells.
 */
function GuardSummary({ matrix }: { matrix: ResolvedQueryGuardRule[] }) {
  return (
    <ul className="mt-5 space-y-2 text-sm text-charcoal">
      {TRUST_CLASSES.map((tc) => {
        const parts = SUMMARY_ORDER.map((rt) => matrix.find((r) => r.trust_class === tc && r.rule_type === rt))
          .filter((r): r is ResolvedQueryGuardRule => r !== undefined)
          .map(summarizeRule);
        if (parts.length === 0) return null;
        return (
          <li key={tc} className="flex gap-2">
            <span aria-hidden className="select-none text-slate">
              &bull;
            </span>
            <span>
              <span className="font-semibold">{TRUST_CLASS_FRIENDLY[tc]}:</span> {parts.join('; ')}.
            </span>
          </li>
        );
      })}
    </ul>
  );
}
