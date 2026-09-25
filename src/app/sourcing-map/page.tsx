import { fetchBffJson } from '@/lib/server-fetch';
import type { SmProjectListResponse } from '@/lib/sourcing-map/contract';
import { SmHeader } from './_components/sm-header';
import { ProjectsGrid } from './_components/projects-grid';

export default async function SourcingMapHome() {
  const result = await fetchBffJson<SmProjectListResponse>('/api/account/sourcing-map/projects');
  return (
    <>
      <SmHeader crumbs={[{ label: 'Projects' }]} />
      {result.kind === 'ok' ? (
        <ProjectsGrid initialProjects={result.data.projects} />
      ) : (
        <p role="alert" className="sm-error p-8">Projects could not be loaded ({result.status}). Try again in a moment.</p>
      )}
    </>
  );
}
