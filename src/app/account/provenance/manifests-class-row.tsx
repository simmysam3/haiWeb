'use client';

import type { ManifestSkuRow, ClassSummary } from '@haiwave/protocol';
import {
  AccordionGroupRow,
  AccordionLoading,
  AccordionError,
} from '@/components/grouped-accordion';
import type { SkusCell } from './_lib/types';
import { ManifestsSkuRow } from './manifests-sku-row';

interface Props {
  klass: ClassSummary;
  cell: SkusCell | undefined;
  expanded: boolean;
  onToggle: () => void;
  onInspect: (sku: ManifestSkuRow) => void;
  onRetry: () => void;
}

export function ManifestsClassRow({ klass, cell, expanded, onToggle, onInspect, onRetry }: Props) {
  return (
    <AccordionGroupRow
      groupKey={klass.class_slug}
      label={klass.class_name}
      count={klass.sku_count}
      expanded={expanded}
      onToggle={onToggle}
    >
      {cell === undefined || cell === 'loading' ? (
        <AccordionLoading>Loading…</AccordionLoading>
      ) : 'error' in cell ? (
        <AccordionError>
          {cell.error}{' '}
          <button type="button" onClick={onRetry} className="underline">
            Retry
          </button>
        </AccordionError>
      ) : (
        cell.map((sku) => (
          <ManifestsSkuRow key={sku.origin_manifest_id} sku={sku} onInspect={onInspect} />
        ))
      )}
    </AccordionGroupRow>
  );
}
