/**
 * Scope-from-document membership classification (spec §6). Pure over injected
 * lookups so it is unit-tested without React or fetch.
 *
 * Rules, per distinct normalized company name, in file order:
 *  1. one of selfNames                          → 'self' (omitted from every line)
 *  2. a universe counterparty's legal name      → 'pickable'
 *  3. a directory hit's company_name, legal_name
 *     or dba_name equals it                     → 'on_network_unconnected'
 *  4. otherwise                                 → 'not_on_network'
 *  5. the lookup threw, or the file has more
 *     lookup-needing names than the ceiling    → 'unverified' (never a false claim)
 * Owner ruling R3 (2026-09-09): haiCore's search returns active participants
 * only, so a suspended participant reads as not_on_network. Accepted.
 */
import { normalizeCompanyName, type ParsedDocument } from './parse-workbook';

export type Membership = 'pickable' | 'on_network_unconnected' | 'not_on_network' | 'unverified' | 'self';

export interface CompanyClassification {
  name: string;
  membership: Membership;
  counterpartyId?: string;
  skus: string[];
}

export interface UniverseOption {
  counterparty_id: string;
  counterparty_legal_name: string;
}

/**
 * One participant-directory search result. `company_name` is the BFF's display
 * name (`dba_name ?? legal_name`), so a participant found by the OTHER of its
 * two names would fail an equality against it alone — hence both are carried.
 */
export interface DirectoryHit {
  company_name: string;
  legal_name?: string;
  dba_name?: string;
}

export type DirectoryLookup = (name: string) => Promise<DirectoryHit[]>;

export function groupByCompany(doc: ParsedDocument): Array<{ name: string; skus: string[] }> {
  const groups = new Map<string, { name: string; skus: string[]; seen: Set<string> }>();
  for (const r of doc.rows) {
    const key = normalizeCompanyName(r.company);
    let g = groups.get(key);
    if (!g) {
      g = { name: r.company, skus: [], seen: new Set() };
      groups.set(key, g);
    }
    if (!g.seen.has(r.sku)) {
      g.seen.add(r.sku);
      g.skus.push(r.sku);
    }
  }
  return Array.from(groups.values()).map(({ name, skus }) => ({ name, skus }));
}

/** The directory route needs q ≥ 2 characters; shorter names skip the lookup. */
const MIN_LOOKUP_LENGTH = 2;

/**
 * The most directory lookups one file may issue (spec §5.4). One request per
 * distinct non-self, non-pickable company was uncapped: a 5,000-row file with
 * 4,000 distinct suppliers would have fired 4,000 requests at the BFF. The
 * first MAX_DIRECTORY_LOOKUPS such names in file order are checked; the rest
 * are `unverified` — never checked, so never claimed either way.
 */
export const MAX_DIRECTORY_LOOKUPS = 100;

/** One company's decided fate: settled outright, or awaiting its directory lookup. */
type Plan =
  | { kind: 'settled'; result: CompanyClassification }
  | { kind: 'lookup'; name: string; skus: string[]; key: string };

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function classifyCompanies(
  doc: ParsedDocument,
  ctx: { universe: UniverseOption[]; selfNames: string[]; lookup: DirectoryLookup; concurrency?: number },
): Promise<CompanyClassification[]> {
  const self = new Set(ctx.selfNames.map(normalizeCompanyName));
  const byName = new Map(ctx.universe.map((u) => [normalizeCompanyName(u.counterparty_legal_name), u]));

  // First pass, in file order: settle every name that needs no lookup and hand
  // out the lookup budget. Deciding this BEFORE the concurrent pass is what
  // makes "the first MAX_DIRECTORY_LOOKUPS in file order" exact rather than a
  // race between workers, and it spends the budget only on names that really
  // issue a request — a pickable, self or too-short name burns no slot.
  let budget = MAX_DIRECTORY_LOOKUPS;
  const plans = groupByCompany(doc).map(({ name, skus }): Plan => {
    const key = normalizeCompanyName(name);
    if (self.has(key)) return { kind: 'settled', result: { name, membership: 'self', skus } };
    const cp = byName.get(key);
    if (cp) {
      return {
        kind: 'settled',
        result: { name, membership: 'pickable', counterpartyId: cp.counterparty_id, skus },
      };
    }
    if (name.trim().length < MIN_LOOKUP_LENGTH) {
      return { kind: 'settled', result: { name, membership: 'not_on_network', skus } };
    }
    if (budget <= 0) return { kind: 'settled', result: { name, membership: 'unverified', skus } };
    budget -= 1;
    return { kind: 'lookup', name, skus, key };
  });

  return mapWithConcurrency(plans, ctx.concurrency ?? 4, async (plan) => {
    if (plan.kind === 'settled') return plan.result;
    try {
      const hits = await ctx.lookup(plan.name);
      // ANY of the hit's names, not just the display one. Deliberately still an
      // equality: the directory search is similarity-based, so "any hit at all"
      // would swallow the not-on-network line.
      const found = hits.some((h) =>
        [h.company_name, h.legal_name, h.dba_name].some(
          (n) => typeof n === 'string' && normalizeCompanyName(n) === plan.key,
        ),
      );
      return {
        name: plan.name,
        membership: found ? 'on_network_unconnected' : 'not_on_network',
        skus: plan.skus,
      };
    } catch {
      return { name: plan.name, membership: 'unverified', skus: plan.skus };
    }
  });
}
