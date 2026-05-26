// src/app/account/sonar/templates/new/page.tsx
import { TemplateWizard } from '../_components/template-wizard';
import { configNoun } from '../_lib/config-noun';
import { PageHeader } from '@/components';

interface NewTemplatePageProps {
  searchParams: Promise<{ observation_class?: string }>;
}

// Audit definitions are created only via the dedicated /audit/new wizard
// (v.1.40), so the Configurations wizard accepts only watcher / phantom_demand.
function isObservationClass(
  v: unknown,
): v is 'watcher' | 'phantom_demand' {
  return v === 'watcher' || v === 'phantom_demand';
}

export default async function NewTemplatePage({
  searchParams,
}: NewTemplatePageProps) {
  const params = await searchParams;
  const defaultClass = isObservationClass(params.observation_class)
    ? params.observation_class
    : undefined;
  const heading = defaultClass
    ? `New ${configNoun(defaultClass)}`
    : 'New configuration';
  return (
    <div className="p-6">
      <PageHeader
        eyebrow={defaultClass ? configNoun(defaultClass) : 'Configurations'}
        title={heading}
      />
      <TemplateWizard defaultObservationClass={defaultClass} />
    </div>
  );
}
