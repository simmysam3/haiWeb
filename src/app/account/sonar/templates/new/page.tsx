import { TemplateForm } from '../_components/template-form';

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
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-charcoal mb-4">New run template</h1>
      <div className="bg-white rounded-xl border border-slate/15 p-6 max-w-2xl">
        <TemplateForm defaultObservationClass={defaultClass} />
      </div>
    </div>
  );
}
