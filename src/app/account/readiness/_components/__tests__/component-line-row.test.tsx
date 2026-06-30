import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { ComponentLineRow } from '../component-line-row';

it('renders both chips for a double-flagged leather line', () => {
  render(
    <ComponentLineRow
      line={{
        component: 'leather',
        color_code: 'TOLU-33',
        length_cm: null,
        holding_suppliers: ['2f4dcc8b-1234-5678-90ab-cdef01234567'],
        outcomes: ['quantity_short', 'shade_risk'],
      }}
    />,
  );
  expect(screen.getByText(/quantity short/i)).toBeInTheDocument();
  expect(screen.getByText(/shade risk/i)).toBeInTheDocument();
});
