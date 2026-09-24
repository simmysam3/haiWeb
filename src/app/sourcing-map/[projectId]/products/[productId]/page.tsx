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
  // Keyed per product: the editor seeds its state from `detail` once, so another product must mount a fresh one.
  return (
    <ProductEditorBody key={product.data.product_id} projectName={project.kind === 'ok' ? project.data.name : 'Project'} detail={product.data} />
  );
}
