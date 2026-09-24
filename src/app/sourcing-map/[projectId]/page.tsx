import { notFound } from 'next/navigation';
import { fetchBffJson } from '@/lib/server-fetch';
import type { SmProject, SmProductListResponse, SmRunListResponse } from '@/lib/sourcing-map/contract';
import { ProjectView } from './_components/project-view';

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const base = `/api/account/sourcing-map/projects/${projectId}`;
  const [project, runs, products] = await Promise.all([
    fetchBffJson<SmProject>(base),
    fetchBffJson<SmRunListResponse>(`${base}/runs`),
    fetchBffJson<SmProductListResponse>(`${base}/products`),
  ]);
  // spec §8.10: another participant's project is a haiCore 404, never 403.
  if (project.kind === 'error') {
    if (project.status === 404) notFound();
    throw new Error(`project fetch failed: ${project.status}`);
  }
  return (
    <ProjectView
      project={project.data}
      runs={runs.kind === 'ok' ? runs.data.runs : []}
      products={products.kind === 'ok' ? products.data.products : []}
    />
  );
}
