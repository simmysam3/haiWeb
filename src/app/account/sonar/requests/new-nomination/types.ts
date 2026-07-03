import type { CatalogClass, CatalogProduct } from '@/lib/haiwave-api';

export interface PartnerSummary {
  id: string;
  legal_name: string;
}

export type InitialState =
  | { kind: 'cold'; error?: string }
  | { kind: 'vendor'; vendor: PartnerSummary; error?: string }
  | { kind: 'vendor+product'; vendor: PartnerSummary; product: CatalogProduct; classId: string }
  | { kind: 'vendor+class'; vendor: PartnerSummary; class: CatalogClass };

export type FormStep = 0 | 1 | 2;

export interface FormSelections {
  classes: Set<string>;   // class_id
  products: Set<string>;  // external_product_id
}
