'use client';
import { useRouter } from 'next/navigation';
import type { SmProductDetail } from '@/lib/sourcing-map/contract';
import { ProductEditor } from './product-editor';
import { BomGrid } from './bom-grid';

/** Chooses the body by BOM source: the grid for workbench products; Task 25 adds the agent view. */
export function ProductEditorBody({ projectName, detail }: { projectName: string; detail: SmProductDetail }) {
  const router = useRouter();
  return (
    <ProductEditor projectName={projectName} detail={detail}>
      <BomGrid productId={detail.product_id} axis={detail.variant_axis} initialLines={detail.lines} classes={detail.classes} onSaved={() => router.refresh()} />
    </ProductEditor>
  );
}
