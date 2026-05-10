import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountNav } from '../account-nav';

// next/navigation is used by AccountNav for usePathname
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// next/image mocked so JSDOM doesn't choke on Image
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// next/link renders an <a> in tests
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('AccountNav', () => {
  it('Phantom Demand sidebar entry links to /account/sonar/templates?modality=phantom_demand', () => {
    render(<AccountNav userName="Test User" userEmail="test@example.com" />);
    const link = screen.getByRole('link', { name: 'Phantom Demand' });
    expect(link.getAttribute('href')).toBe('/account/sonar/templates?modality=phantom_demand');
  });
});
