// src/app/account/sonar/phantom-demand/new/page.tsx
// v.1.44 refined-PD: wizard entry point for /account/sonar/phantom-demand/new.
// Mounts the shared TemplateWizard pre-set to the phantom_demand observation class,
// which now emits the phantom_demand_bom scope shape.
import { TemplateWizard } from '../../templates/_components/template-wizard';
import { PageHeader } from '@/components';

export default function NewPhantomDemandPage() {
  return (
    <div>
      <PageHeader eyebrow="Phantom Demand" title="New demand request" />
      <TemplateWizard />
    </div>
  );
}
