import { notFound } from 'next/navigation';
import { fetchBffJson } from '@/lib/server-fetch';
import type { SmExecutionDetail, SmExecutionSummary, SmProductListResponse, SmProject, SmRunTemplate } from '@/lib/sourcing-map/contract';
import { smPageId } from '@/lib/sourcing-map/page-id';
import { Workspace } from './_components/workspace';

export default async function RunWorkspacePage({ params }: { params: Promise<{ projectId: string; templateId: string }> }) {
  const ids = await params;
  const projectId = smPageId(ids.projectId);
  const templateId = smPageId(ids.templateId);
  const run = await fetchBffJson<{ template: SmRunTemplate }>(`/api/account/sourcing-map/runs/${templateId}`);
  if (run.kind === 'error') {
    if (run.status === 404) notFound();
    throw new Error(`run fetch failed: ${run.status}`);
  }
  const [project, products, executions] = await Promise.all([
    fetchBffJson<SmProject>(`/api/account/sourcing-map/projects/${projectId}`),
    fetchBffJson<SmProductListResponse>(`/api/account/sourcing-map/projects/${projectId}/products`),
    fetchBffJson<{ executions: SmExecutionSummary[] }>(`/api/account/sourcing-map/runs/${templateId}/executions`),
  ]);
  const list = executions.kind === 'ok' ? executions.data.executions : [];
  const newest = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const detail = newest ? await fetchBffJson<SmExecutionDetail>(`/api/account/sourcing-map/executions/${newest.execution_id}`) : null;
  // R1 (the [projectId]/page.tsx precedent): a failed read is shown, never a silent fallback.
  return (
    <Workspace
      projectName={project.kind === 'ok' ? project.data.name : 'Project'}
      projectError={project.kind === 'error' ? `The project could not be loaded (${project.status}). Try again in a moment.` : null}
      template={run.data.template}
      library={products.kind === 'ok' ? products.data.products : []}
      productsError={products.kind === 'error' ? `Products could not be loaded (${products.status}). Try again in a moment.` : null}
      executions={list}
      executionsError={executions.kind === 'error' ? `Results could not be loaded (${executions.status}). Try again in a moment.` : null}
      initialDetail={detail && detail.kind === 'ok' ? detail.data : null}
    />
  );
}
