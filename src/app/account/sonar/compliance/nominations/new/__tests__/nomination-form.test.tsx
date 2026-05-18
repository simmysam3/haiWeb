import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Capture props handed to each child step.
const vendorPickerProps: Array<{ onAdvance: (v: { id: string; legal_name: string }) => void }> = [];
const catalogStepProps: Array<{
  vendor: { id: string; legal_name: string };
  selections: { classes: Set<string>; products: Set<string> };
  onChange: (next: { classes: Set<string>; products: Set<string> }) => void;
  onAdvance: () => void;
  onBack: () => void;
}> = [];
const confirmStepProps: Array<{
  vendor: { id: string; legal_name: string };
  selections: { classes: Set<string>; products: Set<string> };
  onSubmitted: () => void;
  onBack: () => void;
}> = [];

vi.mock('../vendor-picker-step', () => ({
  VendorPickerStep: (props: { onAdvance: (v: { id: string; legal_name: string }) => void }) => {
    vendorPickerProps.push(props);
    return <button onClick={() => props.onAdvance({ id: 'v1', legal_name: 'Apex' })}>pick-apex</button>;
  },
}));
vi.mock('../catalog-step', () => ({
  CatalogStep: (props: typeof catalogStepProps[number]) => {
    catalogStepProps.push(props);
    return (
      <div>
        <button onClick={() => props.onChange({ classes: new Set(['c1']), products: new Set() })}>
          select-c1
        </button>
        <button onClick={props.onAdvance}>continue</button>
        <button onClick={props.onBack}>back</button>
      </div>
    );
  },
}));
vi.mock('../confirm-step', () => ({
  ConfirmStep: (props: typeof confirmStepProps[number]) => {
    confirmStepProps.push(props);
    return (
      <div>
        <button onClick={props.onSubmitted}>submit</button>
        <button onClick={props.onBack}>back-from-confirm</button>
      </div>
    );
  },
}));

import { NominationForm } from '../nomination-form';

describe('NominationForm', () => {
  it('renders vendor picker for cold start', () => {
    render(<NominationForm initialState={{ kind: 'cold' }} />);
    expect(screen.getByText('pick-apex')).toBeInTheDocument();
  });

  it('renders error banner alongside vendor picker on cold-with-error', () => {
    render(
      <NominationForm initialState={{ kind: 'cold', error: 'Vendor not found' }} />,
    );
    expect(screen.getByText(/vendor not found/i)).toBeInTheDocument();
    expect(screen.getByText('pick-apex')).toBeInTheDocument();
  });

  it('skips to catalog step when initialState is vendor', () => {
    render(
      <NominationForm
        initialState={{
          kind: 'vendor',
          vendor: { id: 'v1', legal_name: 'Apex' },
        }}
      />,
    );
    expect(screen.getByText('continue')).toBeInTheDocument();
    expect(screen.queryByText('pick-apex')).not.toBeInTheDocument();
  });

  it('skips directly to confirm when initialState is vendor+product', () => {
    render(
      <NominationForm
        initialState={{
          kind: 'vendor+product',
          vendor: { id: 'v1', legal_name: 'Apex' },
          product: {
            external_product_id: 'p1',
            product_name: '6201 Bearing',
            primary_class_slug: 'bearings',
          },
          classId: 'c1',
        }}
      />,
    );
    expect(screen.getByText('submit')).toBeInTheDocument();
  });

  it('skips directly to confirm when initialState is vendor+class', () => {
    render(
      <NominationForm
        initialState={{
          kind: 'vendor+class',
          vendor: { id: 'v1', legal_name: 'Apex' },
          class: { class_id: 'c1', class_slug: 'b', class_name: 'Bearings', product_count: 2 },
        }}
      />,
    );
    expect(screen.getByText('submit')).toBeInTheDocument();
  });

  it('advances cold start through all three steps', async () => {
    render(<NominationForm initialState={{ kind: 'cold' }} />);
    await userEvent.click(screen.getByText('pick-apex'));     // vendor picker → step 1
    await userEvent.click(screen.getByText('select-c1'));      // catalog selects c1
    await userEvent.click(screen.getByText('continue'));        // catalog → step 2
    expect(screen.getByText('submit')).toBeInTheDocument();
  });

  it('back button on catalog step returns to vendor picker', async () => {
    render(
      <NominationForm
        initialState={{ kind: 'vendor', vendor: { id: 'v1', legal_name: 'Apex' } }}
      />,
    );
    expect(screen.getByText('continue')).toBeInTheDocument();
    await userEvent.click(screen.getByText('back'));
    expect(screen.getByText('pick-apex')).toBeInTheDocument();
  });
});
