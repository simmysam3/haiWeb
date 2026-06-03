import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RegisterPage from '../page';

describe('/register (activation landing)', () => {
  it('no longer renders the open self-signup form', () => {
    render(<RegisterPage />);
    // the retired multi-step signup had password + company inputs
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.queryByLabelText(/company name/i)).toBeNull();
    expect(screen.queryByText(/company profile/i)).toBeNull();
    expect(screen.queryByText(/platform fee/i)).toBeNull();
  });

  it('renders post-approval activation content with a path to sign in', () => {
    render(<RegisterPage />);
    expect(screen.getByText(/activate/i)).toBeInTheDocument();
    const login = screen.getByRole('link', { name: /sign in|log ?in/i });
    expect(login).toHaveAttribute('href', '/login');
  });
});
