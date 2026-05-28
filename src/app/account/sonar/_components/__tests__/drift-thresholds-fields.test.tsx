import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DriftThresholdsFields } from '../drift-thresholds-fields';
import { DEFAULT_WATCHER_DRIFT_THRESHOLDS } from '@haiwave/protocol';

describe('<DriftThresholdsFields>', () => {
  it('renders four numeric inputs pre-filled from value', () => {
    render(
      <DriftThresholdsFields
        value={DEFAULT_WATCHER_DRIFT_THRESHOLDS}
        onChange={vi.fn()}
        locked={false}
      />,
    );
    expect(screen.getByLabelText(/Short baseline threshold/i)).toHaveValue(20);
    expect(screen.getByLabelText(/Noise floor/i)).toHaveValue(3);
    expect(screen.getByLabelText(/Warning %/i)).toHaveValue(12);
    expect(screen.getByLabelText(/Critical %/i)).toHaveValue(20);
  });

  it('calls onChange when a value is edited', async () => {
    const onChange = vi.fn();
    render(
      <DriftThresholdsFields
        value={DEFAULT_WATCHER_DRIFT_THRESHOLDS}
        onChange={onChange}
        locked={false}
      />,
    );
    const noise = screen.getByLabelText(/Noise floor/i);
    await userEvent.clear(noise);
    await userEvent.type(noise, '5');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ noise_floor_days: 5 }),
    );
  });

  it('renders a locked-state explainer when locked=true', () => {
    render(
      <DriftThresholdsFields
        value={DEFAULT_WATCHER_DRIFT_THRESHOLDS}
        onChange={vi.fn()}
        locked={true}
      />,
    );
    expect(screen.getByText(/Drift detection requires a scheduled cadence/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Noise floor/i)).toBeDisabled();
  });

  it('shows an inline validation error when critical <= warning', () => {
    render(
      <DriftThresholdsFields
        value={{ ...DEFAULT_WATCHER_DRIFT_THRESHOLDS, severity_warning_pct: 25, severity_critical_pct: 25 }}
        onChange={vi.fn()}
        locked={false}
      />,
    );
    expect(screen.getByText(/critical % must exceed warning %/i)).toBeInTheDocument();
  });
});
