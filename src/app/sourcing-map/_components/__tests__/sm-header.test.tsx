import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SmHeader } from '../sm-header';

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));
// next/link renders an <a> in tests (the house idiom, account-nav.test.tsx:16-20)
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('SmHeader', () => {
  it('shows the reversed logo, the app title, Console back to /account, the theme toggle and the page actions', () => {
    render(<SmHeader crumbs={[{ label: 'Projects' }]} actions={<button type="button">Run</button>} />);
    expect(screen.getByRole('img', { name: 'HAIWAVE' })).toHaveAttribute('src', '/img/haiwave-logo-reversed.svg');
    expect(screen.getByText('Sourcing Map')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Console' })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('button', { name: 'Light theme' })).toBeInTheDocument();
    // The workspace passes the result picker and Run as actions.
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument();
  });
});
