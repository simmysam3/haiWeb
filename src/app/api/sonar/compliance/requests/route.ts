import { NextResponse } from 'next/server';
import {
  RequestManagementStateBucketSchema,
  obligationStatusToBucket,
  nominationStatusToBucket,
  type RequestManagementItem,
  type RequestManagementListResponse,
  type RequestManagementStateBucket,
} from '@haiwave/protocol';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/sonar/compliance/requests
 *
 * BFF passthrough to haiCore GET /sonar/compliance/requests. The haiCore
 * surface only knows about `awaiting` / `type` / `counterparty` filters; the
 * v.1.37 IA refactor adds two more UX filters (`state`, `age_bucket`) that
 * the BFF applies client-side to the fetched payload — this keeps the IA
 * change HaiWeb-only with no haiCore round-trip changes.
 *
 * Query params:
 *  - awaiting:   me | them | all
 *  - type:       nomination | obligation | all
 *  - counterparty: participant UUID
 *  - state:      comma-separated bucket list — pending | accepted | declined |
 *                withdrawn | outstanding | resolved | blocked   (UX-facing
 *                buckets that collapse the per-branch status enums; the
 *                vocabulary + mapping is owned by @haiwave/protocol)
 *  - age_bucket: today | this_week | this_month | older   (single value)
 *
 * Note: the BFF tree intentionally roots this surface at `/api/sonar/...` (no
 * `/account/` prefix) because the orchestrator + RequestRow already use that
 * contract — see request-management-client.tsx + request-row.tsx.
 */

/**
 * UX-facing state buckets the filter exposes. These collapse the protocol's
 * two per-branch status enums (AuditScopeAcceptanceStatus on nominations,
 * SkuObligationStatus on obligations) onto a small shared vocabulary the
 * user can reason about across both item kinds.
 *
 * The vocabulary lives in @haiwave/protocol (RequestManagementStateBucketSchema)
 * as the single source of truth — we derive the validation set from
 * `.options` so the BFF can never drift from the protocol again.
 */
type StateBucket = RequestManagementStateBucket;

const STATE_BUCKETS: ReadonlySet<StateBucket> = new Set(
  RequestManagementStateBucketSchema.options,
);

type AgeBucket = 'today' | 'this_week' | 'this_month' | 'older';
const AGE_BUCKETS: ReadonlySet<AgeBucket> = new Set([
  'today',
  'this_week',
  'this_month',
  'older',
]);

function statusBucket(item: RequestManagementItem): StateBucket {
  // Delegate to the protocol mappers (single source of truth). Obligations
  // collapse SkuObligationStatus (incl. blocked_non_participant → 'blocked');
  // nominations map AuditScopeAcceptanceStatus 1:1.
  return item.item_type === 'inbound_obligation'
    ? obligationStatusToBucket(item.status)
    : nominationStatusToBucket(item.status);
}

function ageBucket(item: RequestManagementItem): AgeBucket {
  // age_days is the canonical server-computed age — use it instead of
  // re-parsing created_at so the boundary lines up with whatever clock the
  // central service used.
  const d = item.age_days;
  if (d <= 0) return 'today';
  if (d <= 7) return 'this_week';
  if (d <= 30) return 'this_month';
  return 'older';
}

function parseStateParam(raw: string | null): Set<StateBucket> | null {
  if (!raw) return null;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is StateBucket => STATE_BUCKETS.has(s as StateBucket));
  if (parts.length === 0) return null;
  return new Set(parts);
}

function parseAgeParam(raw: string | null): AgeBucket | null {
  if (!raw) return null;
  return AGE_BUCKETS.has(raw as AgeBucket) ? (raw as AgeBucket) : null;
}

export const GET = withHaiCore(async ({ client, request }) => {
  const sp = new URL(request.url).searchParams;
  const awaitingRaw = sp.get('awaiting');
  const typeRaw = sp.get('type');
  const stateFilter = parseStateParam(sp.get('state'));
  const ageFilter = parseAgeParam(sp.get('age_bucket'));

  const raw = await client.listRequests({
    awaiting:
      awaitingRaw === 'me' || awaitingRaw === 'them' || awaitingRaw === 'all'
        ? awaitingRaw
        : undefined,
    type:
      typeRaw === 'nomination' || typeRaw === 'obligation' || typeRaw === 'all'
        ? typeRaw
        : undefined,
    counterparty: sp.get('counterparty') ?? undefined,
  });

  // No post-filtering needed → return as-is.
  if (!stateFilter && !ageFilter) {
    return NextResponse.json(raw);
  }

  // Server-side filtering on state / age buckets. We trim the items list but
  // keep the original counts (total / awaiting_me_count / awaiting_them_count)
  // intact — those drive the direction-tab badges and need to reflect the
  // unfiltered tab population, not the post-filter row count.
  const filtered = raw.items.filter((item) => {
    if (stateFilter && !stateFilter.has(statusBucket(item))) return false;
    if (ageFilter && ageBucket(item) !== ageFilter) return false;
    return true;
  });

  const response: RequestManagementListResponse = {
    ...raw,
    items: filtered,
  };
  return NextResponse.json(response);
});
