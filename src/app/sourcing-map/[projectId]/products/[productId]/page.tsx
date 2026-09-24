import { notFound } from 'next/navigation';
import { fetchBffJson } from '@/lib/server-fetch';
import type { SmProductDetail, SmProject } from '@/lib/sourcing-map/contract';
import { ProductEditorBody } from './_components/product-editor-body';

export default async function ProductPage({ params }: { params: Promise<{ projectId: string; productId: string }> }) {
  const { projectId, productId } = await params;
  const [project, product] = await Promise.all([
    fetchBffJson<SmProject>(`/api/account/sourcing-map/projects/${projectId}`),
    fetchBffJson<SmProductDetail>(`/api/account/sourcing-map/products/${productId}`),
  ]);
  if (product.kind === 'error') {
    if (product.status === 404) notFound();
    throw new Error(`product fetch failed: ${product.status}`);
  }
  // Keyed by the product alone (LW-b): the editor holds the product it last saved, so a re-read never remounts it
  // and never discards unsaved edits in the other pane; another product mounts a fresh editor.
  return (
    <ProductEditorBody key={product.data.product_id} projectName={project.kind === 'ok' ? project.data.name : 'Project'} detail={product.data} />
  );
}
