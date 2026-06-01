import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DriftThresholdsFields } from '../drift-thresholds-fields';
import { DEFAULT_WATCHER_DRIFT_THRESHOLDS } from '@haiwave/protocol';

describe('<DriftThresholdsFields>', () => {
  it('collapses the knobs by default behind an "Alter" toggle, showing a plain-English summary', () => {
    render(
      <DriftThresholdsFields
        value={DEFAULT_WATCHER_DRIFT_THRESHOLDS}
        onChange={vi.fn()}
        locked={false}
      />,
    );
    // Inputs hidden until the section is expanded.
    expect(screen.queryByLabelText(/Noise floor/i)).not.toBeInTheDocument();
    // The natural-language summary is always visible.
    expect(
      screen.getByText(/Drift detection decides which lead-time changes/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Alter drift thresholds/i }),
    ).toBeInTheDocument();
  });

  it('reveals four numeric inputs pre-filled from value when expanded', async () => {
    render(
      <DriftThresholdsFields
        value={DEFAULT_WATCHER_DRIFT_THRESHOLDS}
        onChange={vi.fn()}
        locked={false}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Alter drift thresholds/i }),
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
    await userEvent.click(
      screen.getByRole('button', { name: /Alter drift thresholds/i }),
    );
    const noise = screen.getByLabelText(/Noise floor/i);
    await userEvent.clear(noise);
    await userEvent.type(noise, '5');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ noise_floor_days: 5 }),
    );
  });

  it('resets to defaults when the value is customized', async () => {
    const onChange = vi.fn();
    render(
      <DriftThresholdsFields
        value={{ ...DEFAULT_WATCHER_DRIFT_THRESHOLDS, noise_floor_days: 9 }}
        onChange={onChange}
        locked={false}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Alter drift thresholds/i }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Reset to defaults/i }),
    );
    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_WATCHER_DRIFT_THRESHOLDS);
  });

  it('renders a locked-state explainer and hides the editor when locked=true', () => {
    render(
      <DriftThresholdsFields
        value={DEFAULT_WATCHER_DRIFT_THRESHOLDS}
        onChange={vi.fn()}
        locked={true}
      />,
    );
    expect(
      screen.getByText(/Drift detection requires a scheduled cadence/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Alter drift thresholds/i }),
    ).not.toBeInTheDocument();
  });

  it('auto-expands and shows an inline validation error when critical <= warning', () => {
    render(
      <DriftThresholdsFields
        value={{ ...DEFAULT_WATCHER_DRIFT_THRESHOLDS, severity_warning_pct: 25, severity_critical_pct: 25 }}
        onChange={vi.fn()}
        locked={false}
      />,
    );
    // Invalid saved values force the section open so the error is visible.
    expect(screen.getByLabelText(/Critical %/i)).toBeInTheDocument();
    expect(
      screen.getByText(/critical % must exceed warning %/i),
    ).toBeInTheDocument();
  });
});
