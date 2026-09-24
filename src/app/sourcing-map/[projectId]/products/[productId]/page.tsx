import { createHash } from 'node:crypto';
import { notFound } from 'next/navigation';
import { fetchBffJson } from '@/lib/server-fetch';
import type { SmProductDetail, SmProject } from '@/lib/sourcing-map/contract';
import { ProductEditorBody } from './_components/product-editor-body';

/**
 * The editor's key: the product plus a digest of the whole detail as read. The editor seeds its state from
 * `detail` once, so a different product, or the same product changed by a save (header PATCH, BOM PUT, agent
 * import, upload) and re-read by `router.refresh()`, mounts a fresh editor. An unchanged re-read keeps it.
 * `fetchBffJson` reads with `cache: 'no-store'` (src/lib/server-fetch.ts:45), so a refresh sees the saved detail.
 */
function editorKey(detail: SmProductDetail): string {
  return `${detail.product_id}:${createHash('sha1').update(JSON.stringify(detail)).digest('base64url')}`;
}

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
  return (
    <ProductEditorBody key={editorKey(product.data)} projectName={project.kind === 'ok' ? project.data.name : 'Project'} detail={product.data} />
  );
}
