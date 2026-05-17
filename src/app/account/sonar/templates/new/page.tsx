import { TemplateForm } from '../_components/template-form';
import { configNoun } from '../_lib/config-noun';

interface NewTemplatePageProps {
  searchParams: Promise<{ observation_class?: string }>;
}

function isObservationClass(v: unknown): v is 'audit' | 'watcher' | 'phantom_demand' {
  return v === 'audit' || v === 'watcher' || v === 'phantom_demand';
}

export default async function NewTemplatePage({ searchParams }: NewTemplatePageProps) {
  const params = await searchParams;
  const defaultClass = isObservationClass(params.observation_class)
    ? params.observation_class
    : undefined;
  // With a known modality (Save-as… deep link) use its concrete noun;
  // the generic entry point keeps the neutral umbrella wording.
  const heading = defaultClass ? `New ${configNoun(defaultClass)}` : 'New configuration';
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-charcoal mb-4">{heading}</h1>
      <div className="bg-white rounded-xl border border-slate/15 p-6 max-w-2xl">
        <TemplateForm defaultObservationClass={defaultClass} />
      </div>
    </div>
  );
}
