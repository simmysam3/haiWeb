'use client';
import type { BomNode, VendorLine } from '@haiwave/protocol';
import { evaluateNodeReadiness, PhantomDemandProbeResponseSchema } from '@haiwave/protocol';
import { Pill } from '@/components/pill';
import { IdChip } from '@/components/id-chip';
import { VerifiedUndisclosedChip } from '@/components/verified-undisclosed-chip';
import { stockCoverage, isRedacted } from './bom-accordion-tree';
import { SpotCheckTooltip } from './spot-check-tooltip';
import { MesUnavailable } from './mes-unavailable';

// Expanded detail band for a phantom-demand BOM node (PD drill-in redesign,
// spec 2026-07-23). Rendered inline beneath its row by BomAccordionTree
// (renderBand). Every variant has a non-blank identity header; redaction
// (aliases, class labels, stripped skus/free-text) already arrives applied from
// the snapshot — this component only renders what survived it.

// Moved here from bom-node-detail.tsx (retired in the two-pane teardown).
const WALL_LABELS: Record<string, string> = {
  no_bilateral: 'No bilateral access',
  declined_by_seller: 'Declined by seller',
  excluded_by_buyer: 'Excluded by buyer',
  no_answer: 'No answer',
  depth_cap: 'Recursion depth cap',
  agent_error: 'Agent error',
  posture_opt_out: 'Supplier posture: opted out',
};

// v1.55 Spec 3 — human phrasing for the ReadinessReason enum, shown beside the
// verdict Pill so an at-risk / not-ready component says *why*, not just its state.
const READINESS_REASON_LABELS: Record<string, string> = {
  no_interchangeable_trading_pair: 'No interchangeable trading pair matched this class',
  all_unavailable: 'Every interchangeable vendor is unavailable',
  split_source_only: 'Coverable only by splitting the order across vendors',
  single_short_qty: 'Best quote is short on quantity',
  timeline_slip: 'Covered, but delivery lands after the target date',
  partial_completeness: 'Only partial quotes are available',
};

const CONFIDENCE_TONE: Record<string, 'success' | 'warn' | 'neutral'> = {
  high: 'success',
  medium: 'neutral',
  low: 'warn',
};

// The stored qlt IS the whole responder_-prefixed probe response; safeParse it
// through the real schema. (The retired component's guard checked un-prefixed
// names and never matched — this fixes that latent drop.)
function parseLiveQuote(qlt: unknown) {
  if (qlt === null || qlt === undefined) return null;
  const parsed = PhantomDemandProbeResponseSchema.safeParse(qlt);
  if (!parsed.success) return null;
  if (parsed.data.responder_completeness === 'declined') return null;
  return parsed.data;
}

function inventoryText(vb: VendorLine): string {
  if (vb.inventory_disclosure === 'exact' && vb.on_hand_qty_at_vendor !== null) {
    return `${vb.on_hand_qty_at_vendor} on hand (exact disclosure)`;
  }
  if (vb.inventory_disclosure === 'sufficient') return 'sufficient for this demand';
  return 'not disclosed';
}

function attributeSummary(node: BomNode): string {
  return node.attributes
    .map((a) => a.value)
    .filter((v) => v.length > 0)
    .join(' · ');
}

function KvRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-slate">{label}</dt>
      <dd className="m-0 text-charcoal">{children}</dd>
    </>
  );
}

function LiveQuoteValue({ quote }: { quote: NonNullable<ReturnType<typeof parseLiveQuote>> }) {
  return (
    <>
      {quote.responder_quoted_quantity} by {quote.responder_quoted_timeline?.slice(0, 10) ?? 'unknown'}
      <Pill
        definition="The responder's stated confidence in this live spot-check quote."
        tone={CONFIDENCE_TONE[quote.responder_confidence] ?? 'neutral'}
        className="ml-1"
      >
        {quote.responder_confidence} confidence
      </Pill>
    </>
  );
}

function StockLead({ node }: { node: BomNode }) {
  const coverage = stockCoverage(node);
  if (coverage === 'full') {
    return (
      <p className="px-2.5 pt-2 text-xs text-success">
        Covered from your on-hand stock — no sourcing required for this run.
      </p>
    );
  }
  if (coverage === 'partial') {
    const remaining = node.qty_required_total - (node.on_hand_qty ?? 0);
    return (
      <p className="px-2.5 pt-2 text-xs text-slate">
        Partially covered from stock — sourcing evaluated for the remaining {remaining}.
      </p>
    );
  }
  return null;
}

function RawMaterialSection({ vb }: { vb: VendorLine }) {
  const rm = vb.raw_material_status;
  if (!rm) return null;
  const derived = rm.declared_conversion
    ? Math.floor(rm.on_hand.qty * rm.declared_conversion.units_per_uom)
    : null;
  return (
    <section>
      <div className="px-2.5 pt-2 text-[10px] uppercase tracking-wide text-slate-400">Raw material</div>
      <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-0.5 px-2.5 py-1 text-xs">
        <KvRow label="Material">{rm.material_class ?? 'Unclassified raw material'}</KvRow>
        <KvRow label="On hand">
          {rm.on_hand.qty.toLocaleString()} {rm.on_hand.uom}
        </KvRow>
        {rm.replenish_lead_days !== null && (
          <KvRow label="Replenishment">{rm.replenish_lead_days} days</KvRow>
        )}
        {rm.declared_conversion && derived !== null && (
          <KvRow label="Declared conversion">
            {rm.declared_conversion.units_per_uom} units per {rm.on_hand.uom} → ≈{' '}
            {derived.toLocaleString()} units{' '}
            <span className="text-slate-400">(vendor-declared)</span>
          </KvRow>
        )}
      </dl>
    </section>
  );
}

function AlternatesSection({ node, targetDate }: { node: BomNode; targetDate: string }) {
  if (node.alternates_status === 'not_evaluated') return null;
  const readiness = evaluateNodeReadiness(node, targetDate);
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2 px-2.5 pt-2 pb-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">
          Interchangeable vendors ({node.alternates.length})
        </span>
        <Pill category="readiness" value={readiness.verdict} />
        {readiness.reason && (
          <span data-testid="readiness-reason" className="text-xs text-slate">
            {READINESS_REASON_LABELS[readiness.reason] ?? readiness.reason.replace(/_/g, ' ')}
          </span>
        )}
      </div>
      {node.alternates.length === 0 ? (
        <p className="px-2.5 pb-2 text-xs text-slate">
          No interchangeable trading pair matched this component&apos;s class.
        </p>
      ) : (
        <ul className="space-y-1 px-2.5 pb-2">
          {node.alternates.map((a) => (
            <li
              key={`${a.vendor_participant_id}:${a.vendor_sku}`}
              className="flex flex-wrap items-baseline gap-x-2 text-xs"
            >
              {a.vendor_legal_name && (
                <span className="font-medium text-charcoal">{a.vendor_legal_name}</span>
              )}
              <IdChip id={a.vendor_participant_id} />
              <span className="font-mono text-slate">{a.vendor_sku}</span>
              {a.availability ? (
                <>
                  <span className="text-charcoal">
                    {a.availability.quoted_quantity ?? '—'} by{' '}
                    {a.availability.quoted_timeline?.slice(0, 10) ?? 'unknown'}
                  </span>
                  <Pill category="probe_status" value={a.availability.completeness} />
                </>
              ) : (
                <span className="text-problem">
                  {(a.unavailable_reason ?? '').replace(/_/g, ' ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BandShell({
  header,
  children,
  red,
}: {
  header: React.ReactNode;
  children?: React.ReactNode;
  red?: boolean;
}) {
  return (
    <div
      data-testid="bom-node-band"
      className={`my-1 ml-11 rounded-md border border-slate-200 border-l-[3px] ${
        red ? 'border-l-problem bg-problem/5' : 'border-l-teal bg-slate-50/40'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-2.5 py-2">
        {header}
      </div>
      {children}
    </div>
  );
}

export function BomNodeBand({
  node,
  targetDate,
  lineRef,
}: {
  node: BomNode;
  targetDate: string;
  lineRef: string;
}) {
  // ── Wall: red band, plain-language reason. Never names anyone. ──
  if (node.wall_block) {
    const reason = node.wall_block.reason;
    const body =
      reason === 'posture_opt_out'
        ? 'The supplier holding this tier has opted out of phantom-demand disclosure. Its identity and sourcing are withheld by policy — this is a posture choice, not a data failure. Readiness for this branch is assessed as unknown.'
        : `${WALL_LABELS[reason] ?? reason}. ${
            node.wall_block.detail ?? 'Supply past this point is not visible on this run.'
          }`;
    return (
      <BandShell
        red
        header={
          <>
            <span className="font-semibold text-problem">Supply not visible past this point</span>
            <span className="text-xs text-slate">line {lineRef}</span>
          </>
        }
      >
        <p className="px-2.5 py-2.5 text-xs text-problem">{body}</p>
      </BandShell>
    );
  }

  const vb = node.vendor_block;

  // ── Redacted vendor: alias chip header, class + safe facets, no sku/free-text. ──
  if (vb && isRedacted(node)) {
    const quote = parseLiveQuote(vb.qlt);
    const attrs = attributeSummary(node);
    return (
      <BandShell
        header={
          <>
            <VerifiedUndisclosedChip alias={vb.supplier_alias} />
            <span className="text-xs text-slate">
              verified network participant — identity withheld · line {lineRef}
            </span>
          </>
        }
      >
        <StockLead node={node} />
        <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-0.5 px-2.5 py-2 text-xs">
          <KvRow label="Component class">{node.component_label}</KvRow>
          {attrs && <KvRow label="Attributes">{attrs}</KvRow>}
          {vb.plt_days !== null && (
            <KvRow label="Published lead time">
              <SpotCheckTooltip>{vb.plt_days} days</SpotCheckTooltip>
            </KvRow>
          )}
          {quote && (
            <KvRow label="Live quote">
              <LiveQuoteValue quote={quote} />
            </KvRow>
          )}
          {vb.historical_lt && (
            <KvRow label="Historical">
              p50 {vb.historical_lt.p50}d · p75 {vb.historical_lt.p75}d · p90 {vb.historical_lt.p90}d{' '}
              <span className="text-slate">({vb.historical_lt.sample_count} orders)</span>
            </KvRow>
          )}
          <KvRow label="Inventory">{inventoryText(vb)}</KvRow>
        </dl>
        <RawMaterialSection vb={vb} />
        <AlternatesSection node={node} targetDate={targetDate} />
      </BandShell>
    );
  }

  // ── Disclosed vendor: named + participant chip + their SKU. ──
  if (vb && vb.vendor_participant_id) {
    const quote = parseLiveQuote(vb.qlt);
    return (
      <BandShell
        header={
          <>
            <span className="font-semibold text-charcoal">
              {vb.vendor_legal_name ?? node.component_label}
            </span>
            <IdChip id={vb.vendor_participant_id} />
            <span className="text-xs text-slate">
              their SKU: <span className="font-mono">{vb.vendor_sku}</span> · line {lineRef}
            </span>
          </>
        }
      >
        <StockLead node={node} />
        <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-0.5 px-2.5 py-2 text-xs">
          {vb.plt_days !== null && (
            <KvRow label="Published lead time">
              <SpotCheckTooltip>{vb.plt_days} days</SpotCheckTooltip>
            </KvRow>
          )}
          {quote && (
            <KvRow label="Live quote">
              <LiveQuoteValue quote={quote} />
            </KvRow>
          )}
          {vb.historical_lt && (
            <KvRow label="Historical">
              p50 {vb.historical_lt.p50}d · p75 {vb.historical_lt.p75}d · p90 {vb.historical_lt.p90}d{' '}
              <span className="text-slate">({vb.historical_lt.sample_count} orders)</span>
            </KvRow>
          )}
          <KvRow label="Inventory">{inventoryText(vb)}</KvRow>
        </dl>
        <RawMaterialSection vb={vb} />
        <AlternatesSection node={node} targetDate={targetDate} />
      </BandShell>
    );
  }

  // ── Internal manufacturing. ──
  if (node.internal_block) {
    const ib = node.internal_block;
    return (
      <BandShell
        header={
          <>
            <span className="font-semibold text-charcoal">Internal manufacturing</span>
            <span className="text-xs text-slate">line {lineRef}</span>
          </>
        }
      >
        <StockLead node={node} />
        <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-0.5 px-2.5 py-2 text-xs">
          <KvRow label="Standard lead time">
            <SpotCheckTooltip>{ib.standard_lt_days} days</SpotCheckTooltip>
          </KvRow>
          {ib.historical_lt && (
            <KvRow label="Historical">
              p50 {ib.historical_lt.p50}d · p90 {ib.historical_lt.p90}d{' '}
              <span className="text-slate">({ib.historical_lt.sample_count} runs)</span>
            </KvRow>
          )}
          <KvRow label="Live capacity">
            {ib.live_capacity ? (
              <>
                {ib.live_capacity.available_qty} units, earliest start{' '}
                {ib.live_capacity.earliest_start_date}
              </>
            ) : (
              <MesUnavailable />
            )}
          </KvRow>
        </dl>
      </BandShell>
    );
  }

  // ── Fallback (root assembly / no source block): never blank. ──
  return (
    <BandShell
      header={
        <>
          {node.component_sku && (
            <span className="font-mono text-sm text-charcoal">{node.component_sku}</span>
          )}
          <span className="font-semibold text-charcoal">{node.component_label}</span>
          <span className="text-xs text-slate">line {lineRef}</span>
        </>
      }
    >
      <StockLead node={node} />
      <AlternatesSection node={node} targetDate={targetDate} />
    </BandShell>
  );
}
