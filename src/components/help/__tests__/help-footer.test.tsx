// src/components/help/__tests__/help-footer.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HelpFooter } from '../help-footer';

const PACK = { guideEdition: '1.7', packDate: '2026-10-07', servedMatches: true };

describe('HelpFooter', () => {
  it('shows the guide edition and pack date', () => {
    render(<HelpFooter language="en" pack={PACK} canSummarize={false} summary={{ status: 'idle' }} onSummarize={vi.fn()} />);
    expect(screen.getByText('Guide 1.7 · help pack 2026-10-07')).toBeInTheDocument();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('warns when the served guide differs from the pack (Q1: flag only)', () => {
    render(<HelpFooter language="en" pack={{ ...PACK, servedMatches: false }} canSummarize={false} summary={{ status: 'idle' }} onSummarize={vi.fn()} />);
    expect(screen.getByRole('note')).toHaveTextContent('Help may be ahead of or behind the guide you downloaded.');
  });

  it('Summarize is disabled until there is an answer, then calls onSummarize', () => {
    const onSummarize = vi.fn();
    const { rerender } = render(<HelpFooter language="en" pack={undefined} canSummarize={false} summary={{ status: 'idle' }} onSummarize={onSummarize} />);
    expect(screen.getByRole('button', { name: 'Summarize for support' })).toBeDisabled();
    rerender(<HelpFooter language="en" pack={undefined} canSummarize summary={{ status: 'idle' }} onSummarize={onSummarize} />);
    fireEvent.click(screen.getByRole('button', { name: 'Summarize for support' }));
    expect(onSummarize).toHaveBeenCalled();
  });

  it('shows a ready summary with a mailto contact and Copy', () => {
    render(
      <HelpFooter
        language="en"
        pack={PACK}
        canSummarize
        summary={{ status: 'ready', summary: 'Problem: docker build fails at COPY.', contact: 'support@haiwave.ai' }}
        onSummarize={vi.fn()}
      />,
    );
    expect(screen.getByText('Problem: docker build fails at COPY.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'support@haiwave.ai' })).toHaveAttribute('href', 'mailto:support@haiwave.ai');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('shows the failure line', () => {
    render(<HelpFooter language="es" pack={PACK} canSummarize summary={{ status: 'failed' }} onSummarize={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo crear el resumen; inténtelo de nuevo.');
  });
});

// Implementer's pins (Task 3.8): listing lines that no case above drives, each red first.
describe('HelpFooter (implementer pins)', () => {
  it('Summarize is disabled while a summary is loading', () => {
    render(<HelpFooter language="en" pack={PACK} canSummarize summary={{ status: 'loading' }} onSummarize={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Summarize for support' })).toBeDisabled();
  });

  it('Copy puts the summary on the clipboard and says Copied for 1.5 s', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      render(
        <HelpFooter
          language="en"
          pack={PACK}
          canSummarize
          summary={{ status: 'ready', summary: 'Problem: docker build fails at COPY.', contact: 'support@haiwave.ai' }}
          onSummarize={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
      expect(writeText).toHaveBeenCalledWith('Problem: docker build fails at COPY.');
      await act(async () => {}); // the clipboard promise settles
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1_499));
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    } finally {
      delete (window.navigator as { clipboard?: unknown }).clipboard;
      vi.useRealTimers();
    }
  });
});
