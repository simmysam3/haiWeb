// src/app/account/sonar/templates/new/page.tsx
import { redirect } from 'next/navigation';
import { TemplateWizard } from '../_components/template-wizard';
import { configNoun } from '../_lib/config-noun';
import { PageHeader } from '@/components';

interface NewTemplatePageProps {
  searchParams: Promise<{ observation_class?: string }>;
}

// Audit definitions are created only via the dedicated /audit/new wizard
// (v.1.40); watchers via the dedicated /watchers/new wizard (v.1.43 Plan 2),
// so the Configurations wizard accepts only phantom_demand.
function isObservationClass(
  v: unknown,
): v is 'watcher' | 'phantom_demand' {
  return v === 'watcher' || v === 'phantom_demand';
}

export default async function NewTemplatePage({
  searchParams,
}: NewTemplatePageProps) {
  const params = await searchParams;
  if (params.observation_class === 'watcher') {
    redirect('/account/sonar/watchers/new');
  }
  const defaultClass = isObservationClass(params.observation_class)
    ? params.observation_class
    : undefined;
  const heading = defaultClass
    ? `New ${configNoun(defaultClass)}`
    : 'New configuration';
  return (
    <div>
      <PageHeader
        eyebrow={defaultClass ? configNoun(defaultClass) : 'Configurations'}
        title={heading}
      />
      <TemplateWizard defaultObservationClass={defaultClass} />
    </div>
  );
}
