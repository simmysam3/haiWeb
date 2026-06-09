import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DownloadCard } from '../download-card';

describe('DownloadCard', () => {
  it('renders a Download link when available', () => {
    render(<DownloadCard title="Guide" subtitle="sub" href="/api/x" available />);
    const link = screen.getByRole('link', { name: 'Download' });
    expect(link.getAttribute('href')).toBe('/api/x');
  });

  it('renders a disabled "Not yet published" state when unavailable', () => {
    render(<DownloadCard title="Guide" subtitle="sub" href="/api/x" available={false} />);
    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull();
    expect(screen.getByText('Not yet published')).toBeTruthy();
  });
});
