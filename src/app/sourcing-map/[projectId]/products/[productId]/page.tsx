import { notFound } from 'next/navigation';
import { fetchBffJson } from '@/lib/server-fetch';
import type { SmProductDetail, SmProject } from '@/lib/sourcing-map/contract';
import { smPageId } from '@/lib/sourcing-map/page-id';
import { ProductEditorBody } from './_components/product-editor-body';

export default async function ProductPage({ params }: { params: Promise<{ projectId: string; productId: string }> }) {
  const ids = await params;
  // A5-M2: each segment is bound into a BFF path, so anything but an id is a 404 before any fetch.
  const projectId = smPageId(ids.projectId);
  const productId = smPageId(ids.productId);
  const [project, product] = await Promise.all([
    fetchBffJson<SmProject>(`/api/account/sourcing-map/projects/${projectId}`),
    fetchBffJson<SmProductDetail>(`/api/account/sourcing-map/products/${productId}`),
  ]);
  if (product.kind === 'error') {
    if (product.status === 404) notFound();
    throw new Error(`product fetch failed: ${product.status}`);
  }
  // P1 (the run page's rule, F5): a URL pairing one project with another project's product is a 404.
  if (product.data.project_id !== projectId) notFound();
  // Keyed by the product alone (LW-b): the editor holds the product it last saved, so a re-read never remounts it
  // and never discards unsaved edits in the other pane; another product mounts a fresh editor.
  return (
    <ProductEditorBody key={product.data.product_id} projectName={project.kind === 'ok' ? project.data.name : 'Project'} detail={product.data} />
  );
}
