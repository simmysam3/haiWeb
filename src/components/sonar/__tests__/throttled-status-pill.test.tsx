import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThrottledStatusPill } from '../throttled-status-pill';

afterEach(() => {
  vi.useRealTimers();
});

describe('ThrottledStatusPill', () => {
  it('renders countdown text containing "Resumes in" for a future ISO date', () => {
    const future = new Date(Date.now() + 45 * 60_000).toISOString(); // 45 min from now
    render(<ThrottledStatusPill nextResumeAt={future} />);
    expect(screen.getByText(/Throttled · Resumes in/)).toBeInTheDocument();
    expect(screen.getByText(/Resumes in 45 min/)).toBeInTheDocument();
  });

  it('renders "Resuming now" when nextResumeAt is in the past', () => {
    const past = new Date(Date.now() - 5000).toISOString();
    render(<ThrottledStatusPill nextResumeAt={past} />);
    expect(screen.getByText('Throttled · Resuming now')).toBeInTheDocument();
  });

  it('formats hours correctly for times more than 60 minutes away', () => {
    const future = new Date(Date.now() + 90 * 60_000).toISOString(); // 90 min → "1h 30m"
    render(<ThrottledStatusPill nextResumeAt={future} />);
    expect(screen.getByText(/Resumes in 1h 30m/)).toBeInTheDocument();
  });

  it('sets up a 30s interval that updates the countdown display', async () => {
    vi.useFakeTimers();
    // With fake timers, Date.now() is fixed. Set a future date relative to
    // the fake-timer clock (which starts at the real time of test execution).
    const now = Date.now();
    // 30 min in the future
    const future = new Date(now + 30 * 60_000).toISOString();
    render(<ThrottledStatusPill nextResumeAt={future} />);

    // Initial render: should show something in the component
    expect(screen.getByText(/Throttled · Resumes in/)).toBeInTheDocument();

    // Advance 30 seconds — interval fires once
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    // After 30 fake seconds, 29.5 min remain → ceil = 30 min still
    // The important thing: the component still renders the countdown without crashing
    expect(screen.getByText(/Throttled · Resumes in/)).toBeInTheDocument();

    // Advance 30 minutes — interval fires many times, countdown approaches 0
    await act(async () => {
      vi.advanceTimersByTime(30 * 60_000);
    });
    // After 30+ min elapsed against a 30-min window, should show "Resuming now"
    expect(screen.getByText('Throttled · Resuming now')).toBeInTheDocument();
  });
});
