import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '../page-header';
import { groundToken, ratioOn } from '@/test/contrast';

describe('PageHeader contrast on the console ground (account/layout.tsx:26)', () => {
  it('the title clears 4.5:1 on the console ground (account/layout.tsx:26; was teal, 2.27:1)', () => {
    render(
      <main className="bg-light-gray">
        <PageHeader title="Supply Risks" />
      </main>,
    );
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(groundToken(h1)).toBe('light-gray');
    expect(ratioOn(h1)).toBeGreaterThanOrEqual(4.5);
  });
});
