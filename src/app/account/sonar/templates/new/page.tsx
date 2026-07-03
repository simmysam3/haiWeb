import { redirect } from 'next/navigation';
import { TemplateWizard } from '../_components/template-wizard';
import { configNoun } from '../_lib/config-noun';
import { PageHeader } from '@/components';

interface NewTemplatePageProps {
  searchParams: Promise<{ observation_class?: string }>;
}

// Audit definitions are created only via the dedicated /audit/new wizard
// (v.1.40); watchers via the dedicated /watchers/new wizard (v.1.43 Plan 2).
// This wizard is therefore phantom-demand-only — any watcher entry point is
// redirected to its own wizard, and there is no modality choice in the form.
export default async function NewTemplatePage({
  searchParams,
}: NewTemplatePageProps) {
  const params = await searchParams;
  if (params.observation_class === 'watcher') {
    redirect('/account/sonar/watchers/new');
  }
  const noun = configNoun('phantom_demand');
  return (
    <div>
      <PageHeader eyebrow={noun} title={`New ${noun}`} />
      <TemplateWizard />
    </div>
  );
}
