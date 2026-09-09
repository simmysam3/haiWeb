/** Every sentence the scope-import panel says (spec §4), tested once here. */

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const SELECT_LABEL = 'Import products for';
export const SELECT_PLACEHOLDER = 'Choose a company…';
export const READING = (fileName: string) => `Reading ${fileName}…`;

export function parsedSummary(fileName: string, products: number, companies: number, skipped: number): string {
  const base = `${fileName}: ${products} ${plural(products, 'product', 'products')} across ${companies} ${plural(companies, 'company', 'companies')}.`;
  if (skipped === 0) return base;
  return `${base} ${skipped} ${plural(skipped, 'row', 'rows')} skipped (no company or no SKU).`;
}

export const MEMBERSHIP_LABELS = {
  not_on_network: 'Not on the HAIWAVE network',
  on_network_unconnected: 'On the network but not yet connected',
  unverified: 'Could not be verified',
} as const;

export function membershipLine(kind: keyof typeof MEMBERSHIP_LABELS, names: string[]): string | null {
  if (names.length === 0) return null;
  return `${MEMBERSHIP_LABELS[kind]}: ${names.join(', ')}.`;
}

export function companyOptionLabel(name: string, skuCount: number): string {
  return `${name} (${skuCount} ${plural(skuCount, 'SKU', 'SKUs')} in file)`;
}

export function matchSummary(name: string, matched: number, total: number): string {
  return `${matched} of ${total} ${plural(total, 'SKU', 'SKUs')} for ${name} matched and were checked below.`;
}

export function notInCatalogLine(name: string, skus: string[]): string | null {
  if (skus.length === 0) return null;
  return `Not in ${name}'s catalog: ${skus.join(', ')}.`;
}

export function notAcceptedLine(skus: string[]): string | null {
  if (skus.length === 0) return null;
  return `In the catalog but not in an accepted audit scope: ${skus.join(', ')}.`;
}

export function catalogFailureLine(name: string): string {
  return `Could not load ${name}'s catalog. Nothing was checked.`;
}
