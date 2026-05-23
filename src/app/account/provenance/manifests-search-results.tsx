'use client';

import type { ManifestSearchMatch, ManifestSkuRow } from '@haiwave/protocol';
import { AccordionLeafRow } from '@/components/grouped-accordion';
import { ManifestRecencyChip } from './manifest-recency-chip';

interface Props {
  loading: boolean;
  error: string | null;
  query: string;
  matches: ManifestSearchMatch[];
  onInspect: (sku: ManifestSkuRow) => void;
  onClassPillClick: (classSlug: string) => void;
  onClearSearch: () => void;
}

function ClassPills({ slugs, onClick }: { slugs: string[]; onClick: (slug: string) => void }) {
  const visible = slugs.slice(0, 3);
  const remainder = slugs.length - visible.length;
  return (
    <span className="flex flex-wrap gap-1 mt-0.5">
      {visible.map((slug) => (
        <button
          key={slug}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick(slug);
          }}
          className="rounded-full border border-slate/20 px-1.5 py-0.5 text-[10px] text-slate hover:bg-gray-50"
        >
          {slug}
        </button>
      ))}
      {remainder > 0 && (
        <span
          className="rounded-full border border-slate/20 px-1.5 py-0.5 text-[10px] text-slate"
          title={slugs.slice(3).join(', ')}
        >
          +{remainder} more
        </span>
      )}
    </span>
  );
}

export function ManifestsSearchResults({
  loading,
  error,
  query,
  matches,
  onInspect,
  onClassPillClick,
  onClearSearch,
}: Props) {
  if (loading) return <p className="text-sm text-slate py-4">Searching…</p>;
  if (error) {
    return (
      <p className="text-sm text-problem py-4">
        {error}{' '}
        <button type="button" onClick={onClearSearch} className="underline">
          Clear search
        </button>
      </p>
    );
  }
  if (matches.length === 0) {
    return (
      <p className="text-sm text-slate py-4">
        No products match &lsquo;{query}&rsquo;.{' '}
        <button type="button" onClick={onClearSearch} className="underline">
          Clear search
        </button>
      </p>
    );
  }
  return (
    <div className="space-y-0.5 rounded border border-slate/20 bg-white">
      {matches.map((m) => (
        <AccordionLeafRow
          key={m.origin_manifest_id}
          label={
            <span className="flex flex-col">
              <span className="truncate">{m.product_name ?? '(unnamed product)'}</span>
              <ClassPills slugs={m.class_slugs} onClick={onClassPillClick} />
            </span>
          }
          metaSlot={
            <>
              <span className="text-xs font-mono text-slate truncate">{m.external_product_id}</span>
              <ManifestRecencyChip updatedAt={m.updated_at} />
              <span className="text-teal text-lg font-bold">›</span>
            </>
          }
          onClick={() => onInspect(m)}
        />
      ))}
    </div>
  );
}
