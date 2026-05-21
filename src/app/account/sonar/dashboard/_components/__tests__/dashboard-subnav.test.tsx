import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DashboardSubNav } from '../dashboard-subnav';

/**
 * v1.37 polish item 3 — sticky dashboard sub-nav.
 *
 * jsdom doesn't ship with `IntersectionObserver`; we install a hand-rolled
 * mock that captures the observer callback so each test can drive entry
 * notifications and verify the active-state highlight tracks the
 * most-visible section.
 */
type IOCallback = (entries: IntersectionObserverEntry[]) => void;

interface MockIO {
  observe: (el: Element) => void;
  unobserve: (el: Element) => void;
  disconnect: () => void;
  trigger: (entries: Array<{ id: string; isIntersecting: boolean; intersectionRatio: number }>) => void;
}

let lastObserver: MockIO | null = null;

class MockIntersectionObserver {
  private observed: Element[] = [];
  constructor(private callback: IOCallback) {
    lastObserver = {
      observe: (el) => { this.observed.push(el); },
      unobserve: (el) => { this.observed = this.observed.filter((e) => e !== el); },
      disconnect: () => { this.observed = []; },
      trigger: (entries) => {
        // Build minimally-shaped IntersectionObserverEntry objects from
        // the section ids the test wants to drive.
        const ioEntries = entries.map(({ id, isIntersecting, intersectionRatio }) => {
          const target = document.getElementById(id);
          if (!target) throw new Error(`Test setup: no element with id="${id}"`);
          return {
            target,
            isIntersecting,
            intersectionRatio,
          } as unknown as IntersectionObserverEntry;
        });
        this.callback(ioEntries);
      },
    };
  }
  observe(el: Element) { lastObserver!.observe(el); }
  unobserve(el: Element) { lastObserver!.unobserve(el); }
  disconnect() { lastObserver!.disconnect(); }
}

function installSectionSentinels() {
  // Build sentinel section divs via safe DOM APIs (textContent / setAttribute)
  // — no innerHTML — so `document.getElementById` can locate the observer
  // targets when DashboardSubNav's effect runs.
  for (const id of ['section-coverage', 'section-cross-modality', 'section-activity']) {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
}

function tearDownSentinels() {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
}

beforeEach(() => {
  lastObserver = null;
  (globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
  installSectionSentinels();
});

afterEach(() => {
  tearDownSentinels();
  // Restore: delete our mock so test pollution doesn't leak.
  delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
});

describe('DashboardSubNav', () => {
  it('renders all three section anchor links with stable hrefs', () => {
    render(<DashboardSubNav />);
    const nav = screen.getByTestId('dashboard-subnav');
    expect(nav.querySelector('a[href="#section-coverage"]')).toBeTruthy();
    expect(nav.querySelector('a[href="#section-cross-modality"]')).toBeTruthy();
    expect(nav.querySelector('a[href="#section-activity"]')).toBeTruthy();
  });

  it('starts with Coverage as the active section', () => {
    render(<DashboardSubNav />);
    const coverageLink = screen.getByRole('link', { name: 'Coverage' });
    expect(coverageLink).toHaveAttribute('data-active', 'true');
  });

  it('highlights the most-visible section when the observer fires', () => {
    render(<DashboardSubNav />);
    // The effect has installed the observer.
    expect(lastObserver).not.toBeNull();

    // Cross-modality is most-visible (ratio 0.8 > coverage's 0.1).
    act(() => {
      lastObserver!.trigger([
        { id: 'section-coverage', isIntersecting: true, intersectionRatio: 0.1 },
        { id: 'section-cross-modality', isIntersecting: true, intersectionRatio: 0.8 },
        { id: 'section-activity', isIntersecting: false, intersectionRatio: 0 },
      ]);
    });

    const crossLink = screen.getByRole('link', { name: 'Cross-modality' });
    expect(crossLink).toHaveAttribute('data-active', 'true');
    const coverageLink = screen.getByRole('link', { name: 'Coverage' });
    expect(coverageLink).toHaveAttribute('data-active', 'false');
  });

  it('keeps the prior active section when nothing is intersecting (avoids flicker)', () => {
    render(<DashboardSubNav />);
    expect(lastObserver).not.toBeNull();

    // First drive Activity to active.
    act(() => {
      lastObserver!.trigger([
        { id: 'section-activity', isIntersecting: true, intersectionRatio: 0.9 },
      ]);
    });
    expect(screen.getByRole('link', { name: 'Activity' })).toHaveAttribute('data-active', 'true');

    // Then fire an empty intersection (e.g. scrolling past the bottom).
    // Active stays on Activity — we don't reset to a "none" state.
    act(() => {
      lastObserver!.trigger([
        { id: 'section-coverage', isIntersecting: false, intersectionRatio: 0 },
        { id: 'section-cross-modality', isIntersecting: false, intersectionRatio: 0 },
        { id: 'section-activity', isIntersecting: false, intersectionRatio: 0 },
      ]);
    });
    expect(screen.getByRole('link', { name: 'Activity' })).toHaveAttribute('data-active', 'true');
  });

  it('does not throw in environments without IntersectionObserver', () => {
    delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
    expect(() => render(<DashboardSubNav />)).not.toThrow();
  });
});
