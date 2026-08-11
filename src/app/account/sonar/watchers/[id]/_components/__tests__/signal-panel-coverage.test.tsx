import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
// TEST value-import: enumerate the protocol's signal types so a 9th signal
// type minted without a panel fails HERE, not in a user's run detail.
import { SignalTypeSchema } from '@haiwave/protocol';
import type { SignalType } from '@haiwave/protocol';
import { CounterpartiesGrid } from '../counterparties-grid';
import { makeResult } from './counterparties-grid.test-fixtures'; // extract the existing factory if it lives inline — see Step 3

// Which rendered panel heading proves each signal type is visible. The three
// lead-time signals roll up into the one Lead time panel by design.
const PANEL_PROOF: Record<SignalType, RegExp> = {
  lead_time_distribution: /Lead time/,
  published_lead_time: /Lead time/,
  quoted_lead_time: /Lead time/,
  capacity_utilization_band: /Available capacity/,
  delivery_event: /Delivery events/,
  order_promise_schedule: /Order promises/,
  order_fulfillment_history: /Order fulfilment/,
  soft_quoted_lead_time: /Soft-quoted lead time/,
};

describe('every scoring signal type has a visible panel', () => {
  for (const signalType of SignalTypeSchema.options) {
    it(`${signalType} renders a panel (gap row form)`, () => {
      const { unmount } = render(
        <CounterpartiesGrid
          results={[
            makeResult({
              signal_type: signalType,
              synthesis_mode: 'redacted_gap',
              payload: null,
              counterparty_name: 'Arno Industrial',
            }),
          ]}
          defaultExpanded
        />,
      );
      expect(screen.getByText(PANEL_PROOF[signalType])).toBeInTheDocument();
      unmount();
    });
  }
});
