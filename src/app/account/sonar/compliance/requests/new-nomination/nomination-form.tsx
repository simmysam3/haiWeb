'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProgressSteps } from '@/components/progress-steps';
import type { FormSelections, FormStep, InitialState, PartnerSummary } from './types';
import { VendorPickerStep } from './vendor-picker-step';
import { CatalogStep } from './catalog-step';
import { ConfirmStep } from './confirm-step';

const STEP_LABELS = ['Pick vendor', 'Pick scopes', 'Confirm'];

function deriveInitial(initialState: InitialState): {
  step: FormStep;
  vendor: PartnerSummary | null;
  selections: FormSelections;
  classLabels: Record<string, string>;
  productLabels: Record<string, string>;
  initialError?: string;
} {
  switch (initialState.kind) {
    case 'cold':
      return {
        step: 0,
        vendor: null,
        selections: { classes: new Set(), products: new Set() },
        classLabels: {},
        productLabels: {},
        initialError: initialState.error,
      };
    case 'vendor':
      return {
        step: 1,
        vendor: initialState.vendor,
        selections: { classes: new Set(), products: new Set() },
        classLabels: {},
        productLabels: {},
        initialError: initialState.error,
      };
    case 'vendor+product':
      return {
        step: 2,
        vendor: initialState.vendor,
        selections: {
          classes: new Set(),
          products: new Set([initialState.product.external_product_id]),
        },
        classLabels: {},
        productLabels: {
          [initialState.product.external_product_id]:
            initialState.product.product_name ?? initialState.product.external_product_id,
        },
      };
    case 'vendor+class':
      return {
        step: 2,
        vendor: initialState.vendor,
        selections: {
          classes: new Set([initialState.class.class_id]),
          products: new Set(),
        },
        classLabels: { [initialState.class.class_id]: initialState.class.class_name },
        productLabels: {},
      };
  }
}

export function NominationForm({ initialState }: { initialState: InitialState }) {
  const router = useRouter();
  const initial = useMemo(() => deriveInitial(initialState), [initialState]);
  const [step, setStep] = useState<FormStep>(initial.step);
  const [vendor, setVendor] = useState<PartnerSummary | null>(initial.vendor);
  const [selections, setSelections] = useState<FormSelections>(initial.selections);
  const [classLabels, setClassLabels] = useState<Record<string, string>>(initial.classLabels);
  const [productLabels, setProductLabels] = useState<Record<string, string>>(initial.productLabels);

  function onVendorAdvance(v: PartnerSummary) {
    setVendor(v);
    setStep(1);
  }

  function onCatalogChange(next: FormSelections, labels?: { classLabels?: Record<string, string>; productLabels?: Record<string, string> }) {
    setSelections(next);
    if (labels?.classLabels) setClassLabels((prev) => ({ ...prev, ...labels.classLabels }));
    if (labels?.productLabels) setProductLabels((prev) => ({ ...prev, ...labels.productLabels }));
  }

  function onCatalogAdvance() {
    setStep(2);
  }

  function onSubmitted() {
    router.push('/account/sonar/observations?tab=audit');
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-charcoal mb-2">New nomination</h1>
      <p className="text-sm text-slate mb-6">
        Pick a vendor, choose what to audit, then confirm. You&apos;ll land back on My Nomination Requests.
      </p>

      <ProgressSteps steps={STEP_LABELS} current={step} />

      {initial.initialError && step === initial.step && (
        <div className="rounded border border-problem/30 bg-problem/5 px-3 py-2 text-sm text-problem mb-4">
          {initial.initialError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate/15 p-6">
        {step === 0 && <VendorPickerStep onAdvance={onVendorAdvance} />}
        {step === 1 && vendor && (
          <CatalogStep
            vendor={vendor}
            selections={selections}
            onChange={(next) => onCatalogChange(next)}
            onAdvance={onCatalogAdvance}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && vendor && (
          <ConfirmStep
            vendor={vendor}
            selections={selections}
            classLabels={classLabels}
            productLabels={productLabels}
            onSubmitted={onSubmitted}
            onBack={() => setStep(1)}
          />
        )}
      </div>
    </div>
  );
}
