import { ScopeForm } from './_components/scope-form';

export default function SkuPickerScopePage() {
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold">SKU picker scope</h2>
      <p className="mb-4 text-sm text-slate-600">
        Controls which SKUs appear in the SKU autocomplete throughout the portal.
      </p>
      <ScopeForm />
    </div>
  );
}
