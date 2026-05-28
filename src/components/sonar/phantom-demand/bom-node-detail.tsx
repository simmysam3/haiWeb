import type { BomNode } from '@haiwave/protocol';
import { SpotCheckTooltip } from './spot-check-tooltip';
import { MesUnavailable } from './mes-unavailable';

const WALL_LABELS: Record<string, string> = {
  no_bilateral: 'No bilateral access',
  declined_by_seller: 'Declined by seller',
  excluded_by_buyer: 'Excluded by buyer',
  no_answer: 'No answer',
  depth_cap: 'Recursion depth cap',
  agent_error: 'Agent error',
};

/** Local shape for the qlt field (typed `unknown` in protocol; rendered defensively). */
interface QltDescriptor {
  probe_id: string;
  sku_id: string;
  quoted_quantity: number;
  quoted_timeline: string | null;
  confidence: string;
  completeness: string;
  free_text: string | null;
  inventory_disclosure: string;
  on_hand_qty: number | null;
}

function isQltDescriptor(v: unknown): v is QltDescriptor {
  return (
    typeof v === 'object' &&
    v !== null &&
    'probe_id' in v &&
    'quoted_timeline' in v &&
    'confidence' in v
  );
}

interface BomNodeDetailProps {
  node: BomNode;
}

export function BomNodeDetail({ node }: BomNodeDetailProps) {
  const qlt = isQltDescriptor(node.vendor_block?.qlt) ? node.vendor_block?.qlt : null;

  return (
    <div className="space-y-4 rounded border border-slate-200 bg-white p-4">
      <header>
        <h3 className="font-mono text-lg font-semibold text-slate-900">{node.component_sku}</h3>
        <p className="text-sm text-slate-600">{node.component_label}</p>
        <p className="mt-1 text-sm text-slate-500">
          {`Qty required: ${node.qty_required_total}`}
        </p>
      </header>

      {node.wall_block && (
        <section className="rounded border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-900">
            ⚠ {WALL_LABELS[node.wall_block.reason] ?? node.wall_block.reason}
          </p>
          {node.wall_block.detail && (
            <p className="mt-1 text-xs text-red-800">{node.wall_block.detail}</p>
          )}
        </section>
      )}

      {node.vendor_block && (
        <section className="space-y-2 text-sm">
          <h4 className="font-medium text-slate-700">Vendor</h4>
          <p>
            <span className="text-slate-500">SKU:</span>{' '}
            <span className="font-mono">{node.vendor_block.vendor_sku}</span>
          </p>
          {node.vendor_block.plt_days !== null && (
            <p>
              <span className="text-slate-500">PLT (published):</span>{' '}
              <SpotCheckTooltip>{node.vendor_block.plt_days} days</SpotCheckTooltip>
            </p>
          )}
          {qlt && (
            <p>
              <span className="text-slate-500">QLT (live probe):</span>{' '}
              <SpotCheckTooltip>{qlt.quoted_timeline}</SpotCheckTooltip>{' '}
              ({qlt.confidence} confidence)
            </p>
          )}
          {node.vendor_block.historical_lt && (
            <p>
              <span className="text-slate-500">Historical:</span>{' '}
              p50: {node.vendor_block.historical_lt.p50}d, p75: {node.vendor_block.historical_lt.p75}d, p90:{' '}
              {node.vendor_block.historical_lt.p90}d (n={node.vendor_block.historical_lt.sample_count})
            </p>
          )}
          <p>
            <span className="text-slate-500">Inventory disclosure:</span>{' '}
            {node.vendor_block.inventory_disclosure}
            {node.vendor_block.inventory_disclosure === 'exact' &&
              node.vendor_block.on_hand_qty_at_vendor !== null && (
                <>
                  {' '}
                  — <strong>{node.vendor_block.on_hand_qty_at_vendor}</strong> on hand
                </>
              )}
          </p>
          {qlt?.free_text && (
            <p className="mt-2 text-xs italic text-slate-600">
              &quot;{qlt.free_text}&quot;
            </p>
          )}
        </section>
      )}

      {node.internal_block && (
        <section className="space-y-2 text-sm">
          <h4 className="font-medium text-slate-700">Internal mfg</h4>
          <p>
            <span className="text-slate-500">Standard LT:</span>{' '}
            <SpotCheckTooltip>{node.internal_block.standard_lt_days} days</SpotCheckTooltip>
          </p>
          {node.internal_block.historical_lt && (
            <p>
              <span className="text-slate-500">Historical:</span> p50: {node.internal_block.historical_lt.p50}d,
              p90: {node.internal_block.historical_lt.p90}d (n={node.internal_block.historical_lt.sample_count})
            </p>
          )}
          {node.internal_block.live_capacity ? (
            <p>
              <span className="text-slate-500">Live capacity:</span>{' '}
              {node.internal_block.live_capacity.available_qty} units, earliest start{' '}
              {node.internal_block.live_capacity.earliest_start_date}
            </p>
          ) : (
            <p>
              <span className="text-slate-500">Live capacity:</span> <MesUnavailable />
            </p>
          )}
        </section>
      )}
    </div>
  );
}
