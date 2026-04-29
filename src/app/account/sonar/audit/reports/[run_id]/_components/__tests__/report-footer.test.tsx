import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportFooter } from '../report-footer';

describe('ReportFooter', () => {
  it('renders generated_at, contact email, and disclaimer', () => {
    render(
      <ReportFooter
        footer={{
          generated_at: '2026-04-29T12:34:56.000Z',
          contact_email: 'audits@acme.com',
          disclaimer: 'For informational purposes only.',
        }}
      />,
    );
    expect(screen.getByText(/audits@acme.com/)).toBeInTheDocument();
    expect(screen.getByText(/informational purposes/i)).toBeInTheDocument();
    expect(screen.getByText(/Generated/i)).toBeInTheDocument();
  });

  it('renders fallback text when contact_email is null', () => {
    render(
      <ReportFooter
        footer={{
          generated_at: '2026-04-29T12:34:56.000Z',
          contact_email: null,
          disclaimer: 'D',
        }}
      />,
    );
    expect(screen.getByText(/No contact configured/i)).toBeInTheDocument();
  });
});
