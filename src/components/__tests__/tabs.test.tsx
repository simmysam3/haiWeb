import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Tabs } from '../tabs';

const tabs = [{ key: 'inbound', label: 'Inbound' }, { key: 'outbound', label: 'Outbound', count: 3 }];

describe('Tabs', () => {
  it('renders a tablist whose tabs carry role="tab" and aria-selected', () => {
    render(<Tabs tabs={tabs} active="inbound" onChange={vi.fn()} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: /Inbound/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Outbound/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('still calls onChange with the clicked tab key, and still renders the count badge', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} active="inbound" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /Outbound/ }));
    expect(onChange).toHaveBeenCalledWith('outbound');
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
