import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { formatRelative, formatRunLabel } from '../format';

describe('formatRelative', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for < 1 minute', () => {
    expect(formatRelative('2026-05-26T11:59:30Z')).toBe('just now');
  });
  it('returns "Nm ago" for minutes', () => {
    expect(formatRelative('2026-05-26T11:55:00Z')).toBe('5m ago');
  });
  it('returns "Nh ago" for hours', () => {
    expect(formatRelative('2026-05-26T10:00:00Z')).toBe('2h ago');
  });
  it('returns "Nd ago" for days', () => {
    expect(formatRelative('2026-05-24T12:00:00Z')).toBe('2d ago');
  });
  it('returns "unknown" for malformed input', () => {
    expect(formatRelative('not-a-date')).toBe('unknown');
  });
});

describe('formatRunLabel', () => {
  it('composes <template_name> — Run <hash> when template_name is present', () => {
    expect(
      formatRunLabel({
        run_id: 'abcdef1234567890',
        template_name: 'Apex daily sweep',
      }),
    ).toBe('Apex daily sweep — Run abcdef12');
  });
  it('falls back to Run + 8-char run_id slice when no template_name', () => {
    expect(formatRunLabel({ run_id: 'abcdef1234567890' })).toBe('Run abcdef12');
  });
  it('falls back when template_name is empty string', () => {
    expect(
      formatRunLabel({ run_id: 'abcdef1234567890', template_name: '' }),
    ).toBe('Run abcdef12');
  });
});
