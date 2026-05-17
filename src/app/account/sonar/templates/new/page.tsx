// src/app/account/sonar/templates/new/page.tsx
import { TemplateWizard } from '../_components/template-wizard';
import { configNoun } from '../_lib/config-noun';

interface NewTemplatePageProps {
  searchParams: Promise<{ observation_class?: string }>;
}

function isObservationClass(
  v: unknown,
): v is 'audit' | 'watcher' | 'phantom_demand' {
  return v === 'audit' || v === 'watcher' || v === 'phantom_demand';
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
      <h1 className="text-xl font-semibold text-charcoal mb-4">{heading}</h1>
      <TemplateWizard defaultObservationClass={defaultClass} />
    </div>
  );
}
