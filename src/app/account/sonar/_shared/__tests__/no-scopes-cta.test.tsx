import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoScopesCTA } from '../no-scopes-cta';

describe('NoScopesCTA (QUA-web-sonar-1-05)', () => {
  it('links "Add your first scope" to the nomination flow, where scopes are actually created', () => {
    render(<NoScopesCTA context="dashboard" />);
    const link = screen.getByRole('link', { name: /add your first scope/i });
    expect(link).toHaveAttribute('href', '/account/sonar/requests/new-nomination');
  });
});
