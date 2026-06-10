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
  value_type?: 'string' | 'boolean' | 'structured';
  validity: boolean;
  modal_fields: ('standard' | 'issuer' | 'cert_number' | 'scope')[];
  attribute: LibraryAttributeRow | null;
  artifacts: LibraryArtifactRow[];
  policies: { share: Record<LibraryTier, boolean>; require: Record<LibraryTier, boolean> };
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
};
