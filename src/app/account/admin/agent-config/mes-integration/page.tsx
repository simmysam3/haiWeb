import { MesForm } from './_components/mes-form';

export default function MesIntegrationPage() {
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold">MES integration</h2>
      <p className="mb-4 text-sm text-slate-600">
        When enabled, internal-mfg lines fetch live capacity from the configured MES.
      </p>
      <MesForm />
    </div>
  );
}
