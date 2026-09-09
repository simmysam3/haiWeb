/**
 * Scope-from-document (HaiWeb v1.90 PR 1, spec §7): the request the import
 * panel hands the scope tree, and the result the tree reports back. Lives in
 * its own module so the panel and the tree can be built independently.
 */

export interface ImportRequest {
  /** Monotonic per picker; each new id is handled exactly once by the tree. */
  id: number;
  counterpartyId: string;
  /** The file's SKUs for that company, file order, deduplicated. */
  skus: string[];
}

export interface ImportResult {
  id: number;
  counterpartyId: string;
  /** File SKUs found in the catalog (and accepted, under the audit universe) — checked. */
  matched: string[];
  /** File SKUs absent from the catalog. */
  notInCatalog: string[];
  /** Audit universe only: in the catalog but outside the accepted scope — not checked. */
  notAccepted: string[];
  /** Set when the catalog could not be loaded; nothing was checked. */
  error?: string;
}
