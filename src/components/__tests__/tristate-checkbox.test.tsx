import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TristateCheckbox } from '../tristate-checkbox.js';

describe('<TristateCheckbox>', () => {
  it('shows indeterminate when state="partial"', () => {
    render(<TristateCheckbox state="partial" onChange={() => {}} ariaLabel="x" />);
    const cb = screen.getByLabelText('x') as HTMLInputElement;
    expect(cb.indeterminate).toBe(true);
    expect(cb.checked).toBe(false);
  });

  it('shows checked when state="all"', () => {
    render(<TristateCheckbox state="all" onChange={() => {}} ariaLabel="x" />);
    const cb = screen.getByLabelText('x') as HTMLInputElement;
    expect(cb.indeterminate).toBe(false);
    expect(cb.checked).toBe(true);
  });

  it('toggles "all" → "none" via onChange', () => {
    let next: 'all' | 'none' | null = null;
    render(<TristateCheckbox state="all" onChange={(v) => { next = v; }} ariaLabel="x" />);
    fireEvent.click(screen.getByLabelText('x'));
    expect(next).toBe('none');
  });

  it('toggles "partial" → "all" via onChange', () => {
    let next: 'all' | 'none' | null = null;
    render(<TristateCheckbox state="partial" onChange={(v) => { next = v; }} ariaLabel="x" />);
    fireEvent.click(screen.getByLabelText('x'));
    expect(next).toBe('all');
  });
});
