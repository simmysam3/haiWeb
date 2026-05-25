'use client';

import type { ManifestSkuRow } from '@haiwave/protocol';
import { AccordionLeafRow } from '@/components/grouped-accordion';
import { ManifestRecencyChip } from './manifest-recency-chip';

interface Props {
  sku: ManifestSkuRow;
  onInspect: (sku: ManifestSkuRow) => void;
}

export function ManifestsSkuRow({ sku, onInspect }: Props) {
  return (
    <AccordionLeafRow
      label={sku.product_name ?? '(unnamed product)'}
      metaSlot={
        <>
          <span className="text-xs font-mono text-slate truncate">{sku.external_product_id}</span>
          <ManifestRecencyChip updatedAt={sku.updated_at} />
          <span className="text-teal text-lg font-bold">›</span>
        </>
      }
      onClick={() => onInspect(sku)}
    />
  );
}
