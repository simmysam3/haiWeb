/**
 * Scope-from-document membership classification (spec §6). Pure over injected
 * lookups so it is unit-tested without React or fetch.
 *
 * Rules, per distinct normalized company name, in file order:
 *  1. one of selfNames                          → 'self' (omitted from every line)
 *  2. a universe counterparty's legal name      → 'pickable'
 *  3. directory lookup returns an exact name    → 'on_network_unconnected'
 *  4. otherwise                                 → 'not_on_network'
 *  5. the lookup threw                          → 'unverified' (never a false claim)
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

export type DirectoryLookup = (name: string) => Promise<Array<{ company_name: string }>>;

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

  return mapWithConcurrency(groupByCompany(doc), ctx.concurrency ?? 4, async ({ name, skus }) => {
    const key = normalizeCompanyName(name);
    if (self.has(key)) return { name, membership: 'self', skus };
    const cp = byName.get(key);
    if (cp) return { name, membership: 'pickable', counterpartyId: cp.counterparty_id, skus };
    if (name.trim().length < MIN_LOOKUP_LENGTH) return { name, membership: 'not_on_network', skus };
    try {
      const hits = await ctx.lookup(name);
      const found = hits.some((h) => normalizeCompanyName(h.company_name) === key);
      return { name, membership: found ? 'on_network_unconnected' : 'not_on_network', skus };
    } catch {
      return { name, membership: 'unverified', skus };
    }
  });
}
