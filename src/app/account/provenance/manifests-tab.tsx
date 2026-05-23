'use client';

import { useEffect, useState } from 'react';
import type { ManifestSkuRow } from '@haiwave/protocol';
import { GroupedAccordion } from '@/components/grouped-accordion';
import { useGroupedManifests } from './_lib/use-grouped-manifests';
import { useManifestSearch } from './_lib/use-manifest-search';
import { ManifestsSearchBox } from './manifests-search-box';
import { ManifestsClassRow } from './manifests-class-row';
import { ManifestsSearchResults } from './manifests-search-results';
import { ManifestDetailDrawer } from './manifest-detail-drawer';

export function ManifestsTab() {
  const groups = useGroupedManifests();
  const search = useManifestSearch();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<{ productId: string; productName: string | null } | null>(
    null,
  );

  // Tier-aware default-expansion: when the small tier finishes loading
  // (and expanded is still empty because nothing has been clicked yet),
  // seed expanded with all class slugs so the small catalog renders
  // fully open as soon as classes resolve.
  useEffect(() => {
    if (groups.tier === 'small' && expanded.size === 0 && groups.classes.length > 0) {
      setExpanded(new Set(groups.classes.map((c) => c.class_slug)));
    }
  }, [groups.tier, groups.classes, expanded.size]);

  const toggle = (slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
        if (groups.tier === 'large' && !groups.skusByClass.has(slug)) {
          void groups.loadClass(slug);
        }
      }
      return next;
    });
  };

  const onInspect = (sku: ManifestSkuRow) => {
    setDrawer({ productId: sku.external_product_id, productName: sku.product_name });
  };

  const onClassPillClick = (classSlug: string) => {
    search.setQuery('');
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(classSlug);
      if (groups.tier === 'large' && !groups.skusByClass.has(classSlug)) {
        void groups.loadClass(classSlug);
      }
      return next;
    });
  };

  if (groups.error) {
    return <p className="text-sm text-problem py-8 text-center">{groups.error}</p>;
  }
  if (groups.tier === null) {
    return <p className="text-sm text-slate py-8 text-center">Loading manifests…</p>;
  }
  if (groups.totalSkus === 0) {
    return <p className="text-sm text-slate py-8 text-center">No products registered yet.</p>;
  }

  const showAccordion = search.query.trim().length < 2;

  return (
    <div className="space-y-3">
      <ManifestsSearchBox value={search.query} onChange={search.setQuery} />

      {showAccordion ? (
        <GroupedAccordion initialExpanded={groups.tier === 'small' ? 'all' : 'none'}>
          {groups.classes.map((c) => (
            <ManifestsClassRow
              key={c.class_slug}
              klass={c}
              cell={groups.skusByClass.get(c.class_slug)}
              expanded={expanded.has(c.class_slug)}
              onToggle={() => toggle(c.class_slug)}
              onInspect={onInspect}
              onRetry={() => void groups.loadClass(c.class_slug)}
            />
          ))}
        </GroupedAccordion>
      ) : (
        <ManifestsSearchResults
          loading={search.state.loading}
          error={search.state.error}
          query={search.query}
          matches={search.state.matches}
          onInspect={onInspect}
          onClassPillClick={onClassPillClick}
          onClearSearch={() => search.setQuery('')}
        />
      )}

      <ManifestDetailDrawer
        productId={drawer?.productId ?? null}
        productName={drawer?.productName ?? null}
        onClose={() => setDrawer(null)}
      />
    </div>
  );
}
