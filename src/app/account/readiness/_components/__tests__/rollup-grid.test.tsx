import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { RollupGrid } from '../rollup-grid';

it('renders state only — no supplier, qty, lead, or price', () => {
  render(
    <RollupGrid
      colorways={[
        { sku_ref: 'VOMERO-IRONSTONE', colorway_name: 'Ironstone Fade', rolled_up_state: 'at_risk' },
        { sku_ref: 'VOMERO-SAILSTONE', colorway_name: 'Sail Stone', rolled_up_state: 'ready' },
      ]}
    />,
  );
  expect(screen.getByText('Ironstone Fade')).toBeInTheDocument();
  expect(screen.getByText(/at risk/i)).toBeInTheDocument();
  expect(screen.queryByText(/sq ?ft|sq_ft|days|León|Mekong|Arno|\$/i)).toBeNull();
});
