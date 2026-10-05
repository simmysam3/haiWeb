import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SmHeader } from '../sm-header';
import { SmThemeRoot } from '../theme-root';
import { OpenRisksProvider } from '../open-risks';
import { SM_THEME_TOKENS } from '@/lib/sourcing-map/theme';
import { HelpProvider } from '@/components/help';

afterEach(() => {
  window.localStorage.clear();
});

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));
// next/link renders an <a> in tests (the house idiom, account-nav.test.tsx:16-20)
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/sourcing-map' }));

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

  it('renders the breadcrumb Projects › project › run with the current page marked', () => {
    render(
      <SmHeader
        crumbs={[{ label: 'Projects', href: '/sourcing-map' }, { label: 'Spring 2027', href: '/sourcing-map/p1' }, { label: 'Line A base' }]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toHaveTextContent('Projects›Spring 2027›Line A base');
    expect(screen.getByRole('link', { name: 'Spring 2027' })).toHaveAttribute('href', '/sourcing-map/p1');
    expect(screen.getByText('Line A base')).toHaveAttribute('aria-current', 'page');
  });

  it('stays dark inside the header even when the light theme is chosen, so the ghost Console link and toggle stay legible (controller ruling, Tasks 15-16 review, Important 1)', () => {
    window.localStorage.setItem('sm.theme', 'light');
    const { container } = render(
      <SmThemeRoot>
        <SmHeader crumbs={[{ label: 'Projects' }]} />
      </SmThemeRoot>,
    );
    // Present control: the root itself really did switch to light.
    const root = screen.getByTestId('sm-root');
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(root.style.getPropertyValue('--sm-ink')).toBe(SM_THEME_TOKENS.light.ink);
    // The header, inside that light root, still carries the dark ink token.
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect((header as HTMLElement).style.getPropertyValue('--sm-ink')).toBe(SM_THEME_TOKENS.dark.ink);
  });

  it('carries the dark --sm-line-control under the light theme, so its ghost buttons keep a 3:1 border on the dark ground (OWNER-4)', () => {
    window.localStorage.setItem('sm.theme', 'light');
    const { container } = render(
      <SmThemeRoot>
        <SmHeader crumbs={[{ label: 'Projects' }]} />
      </SmThemeRoot>,
    );
    // Present control: the light root carries the light value (literal hex values, so an unset token cannot pass).
    expect(screen.getByTestId('sm-root').style.getPropertyValue('--sm-line-control')).toBe('#788BA6');
    // The header's own style sets the dark value; without it, its ghost buttons would inherit the light one.
    expect((container.querySelector('header') as HTMLElement).style.getPropertyValue('--sm-line-control')).toBe('#5D71A6');
  });

  it('links "Supply Risks (3 open)" to the supply-risk backlog when the layout supplied a count', () => {
    render(
      <OpenRisksProvider count={3}>
        <SmHeader crumbs={[{ label: 'Projects' }]} />
      </OpenRisksProvider>,
    );
    expect(screen.getByRole('link', { name: 'Supply Risks (3 open)' })).toHaveAttribute('href', '/account/sonar/supply-risks');
  });

  it('shows "(0 open)" for a count of zero, not the plain link', () => {
    render(
      <OpenRisksProvider count={0}>
        <SmHeader crumbs={[{ label: 'Projects' }]} />
      </OpenRisksProvider>,
    );
    expect(screen.getByRole('link', { name: 'Supply Risks (0 open)' })).toBeInTheDocument();
  });

  it('shows the plain "Supply Risks" link with no provider, never "(0 open)"', () => {
    render(<SmHeader crumbs={[{ label: 'Projects' }]} />);
    expect(screen.getByRole('link', { name: 'Supply Risks' })).toHaveAttribute('href', '/account/sonar/supply-risks');
  });
});

describe('SmHeader — HAIWAVE Help entry point', () => {
  it('carries the Help button in the action group when the help agent is enabled', () => {
    render(
      <HelpProvider enabled ownerKey="owner-test">
        <SmHeader crumbs={[{ label: 'Projects' }]} />
      </HelpProvider>,
    );
    const button = screen.getByRole('button', { name: 'Help' });
    expect(button.closest('div.ml-auto')).not.toBeNull();
  });

  it('draws the Help button in the Sourcing Map variant, never the navy nav one (Task 3.9 review)', () => {
    render(
      <HelpProvider enabled ownerKey="owner-test">
        <SmHeader crumbs={[{ label: 'Projects' }]} />
      </HelpProvider>,
    );
    // The header is always navy, so the nav variant's text-navy icon would vanish on it.
    const button = screen.getByRole('button', { name: 'Help' });
    expect(button).toHaveClass('sm-btn');
    expect(button).not.toHaveClass('text-navy');
  });

  it('places the Help button before the theme toggle (Task 3.9 review)', () => {
    render(
      <HelpProvider enabled ownerKey="owner-test">
        <SmHeader crumbs={[{ label: 'Projects' }]} />
      </HelpProvider>,
    );
    const button = screen.getByRole('button', { name: 'Help' });
    const toggle = screen.getByRole('button', { name: 'Light theme' });
    expect(button.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no Help button without an enabled help provider', () => {
    render(<SmHeader crumbs={[{ label: 'Projects' }]} />);
    expect(screen.queryByRole('button', { name: 'Help' })).toBeNull();
  });
});
