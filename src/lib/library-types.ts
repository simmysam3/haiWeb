export type LibraryTier = 'premier' | 'trading_pair' | 'connection' | 'qualified';
export const LIBRARY_TIERS: LibraryTier[] = ['premier', 'trading_pair', 'connection', 'qualified'];
export const TIER_LABELS: Record<LibraryTier, string> = {
  premier: 'Premier', trading_pair: 'Trading Pair', connection: 'Connection', qualified: 'Qualified',
};
export type PolicyContext = 'share' | 'require';

export interface LibraryArtifactRow {
  id: string; elementKey: string; title: string; status: string;
  origin: 'upload' | 'url' | 'auto_gathered'; sourceTier: string;
  sourceUrl: string | null; mimeType: string | null;
  validFrom: string | null; validUntil: string | null;
  /** Explicit never-expires (PO 2026-06-11); optional — absent on pre-migration rows. */
  noExpiry?: boolean;
  affirmedBy: string | null; affirmedAt: string | null;
}
export interface LibraryAttributeRow {
  id: string; elementKey: string; valueJson: unknown; status: string;
  sourceTier: string; evidenceArtifactId: string | null;
  validUntil: string | null; affirmedBy: string | null;
}
export interface LibraryElement {
  key: string; label: string;
  kind: 'artifact' | 'attribute' | 'attribute_with_evidence';
  value_type?: 'string' | 'boolean' | 'structured' | 'amount';
  validity: boolean;
  modal_fields: ('standard' | 'issuer' | 'cert_number' | 'scope')[];
  attribute: LibraryAttributeRow | null;
  artifacts: LibraryArtifactRow[];
  policies: { share: Record<LibraryTier, boolean>; require: Record<LibraryTier, boolean> };
  /** Per-element required minimum (Entity Approvals 2026-06-11); meaningful for require context on 'amount' elements. */
  required_value?: { min_amount_usd: number } | null;
  gap: boolean;
}
export interface LibraryView {
  sections: { section: string; elements: LibraryElement[] }[];
}
export const SECTION_LABELS: Record<string, string> = {
  legal_commercial: 'Legal & Commercial Terms',
  quality: 'Quality Certifications',
  infosec_compliance: 'Information Security & Compliance',
  origin_trade_financial: 'Origin, Trade & Financial',
  insurance: 'Insurance',
};

// Amount values (Entity Approvals 2026-06-11) — the 7 insurance limit elements
// store { amount_usd, detail? }. Shared formatters keep the modal/chip/matrix
// renderings consistent.
export interface AmountValue {
  amount_usd: number;
  detail?: string;
}

const USD_NO_CENTS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** Narrows an unknown value_json to an AmountValue, or null when it doesn't conform. */
export function asAmountValue(value: unknown): AmountValue | null {
  if (value && typeof value === 'object' && typeof (value as AmountValue).amount_usd === 'number') {
    const v = value as AmountValue;
    return typeof v.detail === 'string' ? { amount_usd: v.amount_usd, detail: v.detail } : { amount_usd: v.amount_usd };
  }
  return null;
}

/** "$3,000,000" (no cents). */
export function formatUsd(amount: number): string {
  return USD_NO_CENTS.format(amount);
}

/** Compact requirement badge, e.g. "≥ $5M" / "≥ $750K". */
export function compactUsd(amount: number): string {
  if (amount >= 1_000_000) return `$${+(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (amount >= 1_000) return `$${+(amount / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return `$${amount}`;
}

// Entity Approvals (spec 2026-06-11) — local mirror of the @haiwave/protocol
// scorecard shape. Mirrored here (not value-imported) because client components
// can't resolve the CJS protocol package through the file: symlink on Windows.
export type EvalStatus =
  | 'met' | 'insufficient' | 'expired' | 'claimed' | 'waived' | 'missing' | 'not_shared';

export interface ScorecardEvidence {
  artifact_id: string | null;
  title: string;
  source_url: string | null;
  has_file: boolean;
  valid_until: string | null;
  no_expiry?: boolean;
}

export interface ScorecardRow {
  element_key: string;
  label: string;
  kind: 'artifact' | 'attribute' | 'attribute_with_evidence';
  status: EvalStatus;
  required_min_amount_usd: number | null;
  held_amount_usd: number | null;
  held_value: unknown;
  evidence: ScorecardEvidence[];
  waiver_reason: string | null;
}

export interface Scorecard {
  tier: LibraryTier;
  rows: ScorecardRow[];
  gap_count: number;
  counts: Record<string, number>;
}
