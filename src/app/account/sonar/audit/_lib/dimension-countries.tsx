import type { AuditRunResult } from '@haiwave/protocol';
import { FLAG_COMPONENTS } from './country-flags';
import {
  DIMENSION_LABEL,
  countryName,
  resolvedCountriesOf,
  rollupFor,
  type Dimension,
} from '@/app/account/sonar/_lib/origin-dimension';

const CHIP_DIMENSIONS: readonly Dimension[] = ['design', 'firmware'];

/** One country chip: the curated flag when an asset exists, else the ISO-2 code; the title is the sentence. */
function CountryChip({ country, title }: { country: string; title: string }) {
  const Flag = FLAG_COMPONENTS[country];
  return (
    <span className="inline-flex items-center rounded border border-slate/15 bg-white px-1 py-0.5" title={title} aria-label={title}>
      {Flag ? <Flag className="h-3 w-auto rounded-sm" /> : <span className="font-mono text-[10px] text-charcoal">{country}</span>}
    </span>
  );
}

/**
 * D-219 (2026-09-08): the SKU's design and firmware countries beside its id. A dimension with no
 * resolved country renders no group (undeclared is a state, not a chip — spec R3); no row at all
 * when neither has one, the D-207 "no node when all absent" convention.
 */
export function DimensionCountryChips({ result }: { result: AuditRunResult }) {
  const groups = CHIP_DIMENSIONS
    .map((d) => ({ d, countries: resolvedCountriesOf(rollupFor(result, d)) }))
    .filter((g) => g.countries.length > 0);
  if (groups.length === 0) return null;
  return (
    <span data-testid="dimension-countries" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate">
      {groups.map(({ d, countries }) => (
        <span key={d} className="inline-flex items-center gap-1">
          <span>{DIMENSION_LABEL[d]}</span>
          {countries.map((c) => (
            <CountryChip key={c} country={c} title={`${DIMENSION_LABEL[d]} origin: ${countryName(c)} (${c})`} />
          ))}
        </span>
      ))}
    </span>
  );
}
