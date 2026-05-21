'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

/**
 * v.1.37 Request Management — filter bar.
 *
 * Replaces the v1.35 item-type pill strip (dropped as redundant against the
 * 3-tab direction nav). Surfaces 4 filters as a horizontal row of dropdowns,
 * URL-driven so refresh + back/forward preserve state:
 *
 *  - `item_type`  — nomination | obligation | all   (default: all)
 *  - `state`      — pending | accepted | declined | withdrawn | outstanding |
 *                   resolved   (UX buckets that collapse the protocol's two
 *                   per-branch status enums; default: not-resolved = the
 *                   un-set sentinel, matching prior queue behavior)
 *  - `counterparty` — participant UUID   (default: All)
 *  - `age_bucket` — today | this_week | this_month | older   (default: All)
 *
 * When at least one filter is active, a row of dismissible chips renders
 * directly below the dropdowns; if 2+ filters are active, a "Clear all
 * filters" link appears at the end.
 *
 * Layout note: horizontal row (matches working-list `FilterPills`) rather
 * than a pop-up — surfaces all four selectors at a glance, which is the
 * neighbouring convention and avoids a second click for the most common
 * filter actions.
 *
 * State="Declined" handling: when the user selects state=declined the
 * filter bar redirects to /account/sonar/requests/declined (preserving the
 * other URL params via the query string). The declined view is a separate
 * page so this keeps page concerns cleanly separated. Empty-state CTA on
 * the active queue therefore never has to show a "declined-only" empty.
 */

interface CounterpartyOption {
  id: string;
  label: string;
}

interface FilterBarProps {
  counterpartyOptions: CounterpartyOption[];
}

// Shared UX-state bucket vocab — kept in sync with the BFF route.
const STATE_BUCKETS = [
  'pending',
  'accepted',
  'declined',
  'withdrawn',
  'outstanding',
  'resolved',
] as const;
type StateBucket = (typeof STATE_BUCKETS)[number];

const STATE_LABELS: Record<StateBucket, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  outstanding: 'Outstanding',
  resolved: 'Resolved',
};

const AGE_BUCKETS = ['today', 'this_week', 'this_month', 'older'] as const;
type AgeBucket = (typeof AGE_BUCKETS)[number];

const AGE_LABELS: Record<AgeBucket, string> = {
  today: 'Today',
  this_week: 'This week',
  this_month: 'This month',
  older: 'Older',
};

const ITEM_TYPES = ['nomination', 'obligation'] as const;
type ItemTypeValue = (typeof ITEM_TYPES)[number];
const ITEM_TYPE_LABELS: Record<ItemTypeValue, string> = {
  nomination: 'Nomination',
  obligation: 'Obligation',
};

function isStateBucket(v: string): v is StateBucket {
  return (STATE_BUCKETS as readonly string[]).includes(v);
}
function isAgeBucket(v: string): v is AgeBucket {
  return (AGE_BUCKETS as readonly string[]).includes(v);
}
function isItemType(v: string): v is ItemTypeValue {
  return (ITEM_TYPES as readonly string[]).includes(v);
}

export function FilterBar({ counterpartyOptions }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Legacy `type` alias still arrives from the v1.35 301 redirects (middleware).
  const itemTypeRaw = searchParams.get('item_type') ?? searchParams.get('type') ?? '';
  const stateRaw = searchParams.get('state') ?? '';
  const counterpartyRaw = searchParams.get('counterparty') ?? '';
  const ageRaw = searchParams.get('age_bucket') ?? '';

  const activeStates = stateRaw
    .split(',')
    .map((s) => s.trim())
    .filter(isStateBucket);

  function pushWithParams(targetPath: string, sp: URLSearchParams) {
    const qs = sp.toString();
    router.push(qs ? `${targetPath}?${qs}` : targetPath);
  }

  function setParam(key: string, value: string | null) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    pushWithParams(pathname, sp);
  }

  function setState(value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (!value) {
      sp.delete('state');
      pushWithParams(pathname, sp);
      return;
    }
    // State="Declined" redirects to the dedicated /declined surface, carrying
    // the other filter params with it so the redirect doesn't lose context.
    if (value === 'declined' && pathname === '/account/sonar/requests') {
      sp.delete('state');
      pushWithParams('/account/sonar/requests/declined', sp);
      return;
    }
    setParam('state', value);
  }

  function clearAll() {
    router.push(pathname);
  }

  // Filter is considered "active" when it's set to something other than the
  // implicit default (all / not-resolved). Counterparty + age + item_type
  // all default to unset; state defaults to unset (which the queue already
  // interprets as "not-resolved" via the existing surface).
  const activeChips: { key: string; label: string; onClear: () => void }[] = [];
  if (itemTypeRaw && isItemType(itemTypeRaw)) {
    activeChips.push({
      key: 'item_type',
      label: `Item type: ${ITEM_TYPE_LABELS[itemTypeRaw]}`,
      onClear: () => setParam('item_type', null),
    });
  }
  for (const s of activeStates) {
    activeChips.push({
      key: `state:${s}`,
      label: `State: ${STATE_LABELS[s]}`,
      onClear: () => {
        const next = activeStates.filter((x) => x !== s);
        setParam('state', next.length ? next.join(',') : null);
      },
    });
  }
  if (counterpartyRaw) {
    const match = counterpartyOptions.find((o) => o.id === counterpartyRaw);
    activeChips.push({
      key: 'counterparty',
      label: `Counterparty: ${match?.label ?? counterpartyRaw.slice(0, 8)}`,
      onClear: () => setParam('counterparty', null),
    });
  }
  if (ageRaw && isAgeBucket(ageRaw)) {
    activeChips.push({
      key: 'age_bucket',
      label: `Age: ${AGE_LABELS[ageRaw]}`,
      onClear: () => setParam('age_bucket', null),
    });
  }

  // For the State dropdown <select>, surface the first active bucket so the
  // visible selection mirrors the URL when a single state is picked. (Multi-
  // select state is only reachable today via chip-stacking — the dropdown
  // itself is single-pick to match the CounterpartyFilter convention.)
  const stateDropdownValue = activeStates[0] ?? '';

  return (
    <div className="mb-4 space-y-3">
      {/*
       * v.1.37 mobile pass: on small screens the filter row stacks each
       * label above its full-width <select> (2-column grid). On ≥md it
       * returns to the inline flex-wrap row that mirrors the working-list
       * FilterPills convention. Touch targets ≥44px via `py-2` on mobile.
       */}
      <div
        role="group"
        aria-label="Filters"
        className="grid grid-cols-2 gap-x-3 gap-y-2 md:flex md:flex-wrap md:items-center"
      >
        <label className="flex flex-col gap-1 md:contents">
          <span className="text-xs uppercase tracking-wider text-slate md:self-center">
            Item type:
          </span>
          <select
            value={itemTypeRaw}
            onChange={(e) => setParam('item_type', e.target.value || null)}
            title="Filter the queue to nominations or obligations only. Default: both."
            className="w-full rounded-md border border-slate/30 px-2 py-2 text-sm md:w-auto md:py-1 md:text-xs"
          >
            <option value="">All</option>
            {ITEM_TYPES.map((v) => (
              <option key={v} value={v}>
                {ITEM_TYPE_LABELS[v]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 md:contents">
          <span className="text-xs uppercase tracking-wider text-slate md:self-center md:pl-2">
            State:
          </span>
          <select
            value={stateDropdownValue}
            onChange={(e) => setState(e.target.value)}
            title="Filter by item state. Selecting Declined opens the dedicated declined history view."
            className="w-full rounded-md border border-slate/30 px-2 py-2 text-sm md:w-auto md:py-1 md:text-xs"
          >
            <option value="">All</option>
            {STATE_BUCKETS.map((v) => (
              <option key={v} value={v}>
                {STATE_LABELS[v]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 md:contents">
          <span className="text-xs uppercase tracking-wider text-slate md:self-center md:pl-2">
            Counterparty:
          </span>
          <select
            value={counterpartyRaw}
            onChange={(e) => setParam('counterparty', e.target.value || null)}
            title="Filter to requests involving a single counterparty."
            className="w-full rounded-md border border-slate/30 px-2 py-2 text-sm md:w-auto md:py-1 md:text-xs"
          >
            <option value="">All counterparties</option>
            {counterpartyOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 md:contents">
          <span className="text-xs uppercase tracking-wider text-slate md:self-center md:pl-2">
            Age:
          </span>
          <select
            value={ageRaw}
            onChange={(e) => setParam('age_bucket', e.target.value || null)}
            title="Filter by item age. Today = 0 days; This week = up to 7 days; This month = up to 30 days; Older = beyond 30 days."
            className="w-full rounded-md border border-slate/30 px-2 py-2 text-sm md:w-auto md:py-1 md:text-xs"
          >
            <option value="">All</option>
            {AGE_BUCKETS.map((v) => (
              <option key={v} value={v}>
                {AGE_LABELS[v]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onClear}
              title="Click to remove this filter."
              // v.1.37 mobile pass: chip tap target eased slightly on mobile.
              className="inline-flex items-center gap-1 rounded-full border border-teal/40 bg-teal/10 px-3 py-1 text-xs text-navy hover:bg-teal/20 md:px-2.5 md:py-0.5"
            >
              <span>{chip.label}</span>
              <span aria-hidden="true" className="text-slate">
                &times;
              </span>
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          {activeChips.length >= 2 && (
            <button
              type="button"
              onClick={clearAll}
              // v.1.37 mobile pass: easier-to-tap clear-all link on phones.
              className="px-2 py-1 text-xs text-teal underline hover:text-navy md:px-0 md:py-0"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
