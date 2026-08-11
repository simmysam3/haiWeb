import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WatcherRunStatusSchema } from '@haiwave/protocol';
import { Pill, definitionFor } from '../pill';

afterEach(() => vi.restoreAllMocks());

describe('Pill', () => {
  it('renders the value as the label by default', () => {
    render(<Pill category="run_status" value="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('resolves the definition from the embedded map and exposes it via aria-describedby', () => {
    render(<Pill category="run_status" value="failed" />);
    const pill = screen.getByTestId('pill');
    const describedby = pill.getAttribute('aria-describedby');
    expect(describedby).toBeTruthy();
    expect(document.getElementById(describedby as string)).toHaveTextContent(
      /run (stopped|terminated) before completing/i,
    );
  });

  it('appends "Reason:" with the dynamic detail for error states', () => {
    render(
      <Pill
        category="run_status"
        value="failed"
        detail='duplicate key value violates unique constraint "idx_x"'
      />,
    );
    const tip = document.getElementById(
      screen.getByTestId('pill').getAttribute('aria-describedby') as string,
    );
    expect(tip).toHaveTextContent(/Reason:/);
    expect(tip).toHaveTextContent('idx_x');
  });

  it('uses an explicit definition override and skips the map', () => {
    render(<Pill definition="Inbound probe limit">Limit</Pill>);
    const tip = document.getElementById(
      screen.getByTestId('pill').getAttribute('aria-describedby') as string,
    );
    expect(tip).toHaveTextContent('Inbound probe limit');
    expect(screen.getByText('Limit')).toBeInTheDocument();
  });

  it('dev-warns when no definition resolves', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Pill category="run_status" value="not_a_real_status" />);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[Pill] no definition'),
      expect.anything(),
    );
  });

  it('shows tooltip on focus and hides on Escape', async () => {
    const user = userEvent.setup();
    render(<Pill category="run_status" value="failed" />);
    const pill = screen.getByTestId('pill');
    await user.tab();
    expect(pill).toHaveFocus();
    expect(screen.getByRole('tooltip')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders risk_tier pills with resolved definitions (no missing-definition warn)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <>
        <Pill category="risk_tier" value="standard" />
        <Pill category="risk_tier" value="elevated" />
        <Pill category="risk_tier" value="blocked" />
      </>,
    );
    // exact-case labels (TITLE_CASE) — won't collide with the lowercase tooltip copy
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Elevated')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    // every tier resolves a definition → no "[Pill] no definition" warning
    expect(warn).not.toHaveBeenCalled();
  });

  it('risk_tier tones are severity-coded (info / warn / problem), never orange', () => {
    const { container } = render(
      <>
        <Pill category="risk_tier" value="standard" />
        <Pill category="risk_tier" value="elevated" />
        <Pill category="risk_tier" value="blocked" />
      </>,
    );
    const pills = container.querySelectorAll('[data-testid="pill"]');
    expect(pills[0].className).toContain('text-teal-dark'); // standard → info
    expect(pills[1].className).toContain('text-warning'); // elevated → warn
    expect(pills[2].className).toContain('text-problem'); // blocked → problem
    // orange is nav-only — never on a severity pill
    [...pills].forEach((p) => expect(p.className).not.toMatch(/orange/i));
  });

  it('probe_verdict resolves its static definition (not only the dynamic detail)', () => {
    render(
      <Pill
        category="probe_verdict"
        value="no_answer"
        detail="dynamic reason here"
        tone="neutral"
      >
        No answer
      </Pill>,
    );
    expect(screen.getByText('No answer')).toBeInTheDocument();
    const tip = document.getElementById(
      screen.getByTestId('pill').getAttribute('aria-describedby') as string,
    );
    // 'not a decline' appears ONLY in the PILL_DEFINITIONS entry for probe_verdict.no_answer,
    // never in the dynamic detail — so this assertion is vacuous-proof.
    expect(tip).toHaveTextContent('not a decline');
  });

  // Entity Approvals — eval_status pill category (per-requirement scorecard status).
  describe('eval_status category', () => {
    it.each([
      ['met', 'bg-success/10'],
      ['claimed', 'bg-warning/10'],
      ['insufficient', 'bg-warning/10'],
      ['expired', 'bg-problem/10'],
      ['missing', 'bg-problem/10'],
      ['waived', 'bg-slate/10'],
      ['not_shared', 'bg-slate/10'],
    ])('%s resolves a definition and a tone class', (value, toneClass) => {
      render(<Pill category="eval_status" value={value} />);
      const pill = screen.getByTestId('pill');
      expect(pill.className).toContain(toneClass);
      const tip = document.getElementById(pill.getAttribute('aria-describedby') as string);
      expect(tip?.textContent).toBeTruthy();
    });

    it('claimed definition mentions Artifact Missing', () => {
      render(<Pill category="eval_status" value="claimed" />);
      const tip = document.getElementById(
        screen.getByTestId('pill').getAttribute('aria-describedby') as string,
      );
      expect(tip?.textContent).toMatch(/Artifact Missing/i);
    });

    it('insufficient passes the amounts line through as detail', () => {
      render(<Pill category="eval_status" value="insufficient" detail="$3,000,000 held · $5,000,000 required" />);
      const tip = document.getElementById(
        screen.getByTestId('pill').getAttribute('aria-describedby') as string,
      );
      expect(tip?.textContent).toMatch(/\$3,000,000 held/);
    });
  });

  // Entity Approvals — approval_status pill category (pending warn / approved success / revoked problem).
  describe('approval_status category', () => {
    it.each([
      ['pending', 'warn', 'bg-warning/10'],
      ['approved', 'success', 'bg-success/10'],
      ['revoked', 'problem', 'bg-problem/10'],
    ])('%s resolves a definition and derives the %s tone', (value, _tone, toneClass) => {
      render(<Pill category="approval_status" value={value} />);
      const pill = screen.getByTestId('pill');
      expect(pill.className).toContain(toneClass);
      const tip = document.getElementById(pill.getAttribute('aria-describedby') as string);
      expect(tip?.textContent).toBeTruthy();
    });
  });

  it('run_status has a definition for every WatcherRunStatus member (retry-immune)', () => {
    for (const s of WatcherRunStatusSchema.options) {
      expect(definitionFor('run_status', s), `missing run_status definition: ${s}`).toBeDefined();
    }
  });
});

describe('lead_time_col pill category', () => {
  it.each([
    ['soft_quoted', /phantom-demand traversal/i],
    ['published', /officially listed timeline/i],
    ['calibrated', /median.*order-experience/i],
    ['ship_delta', /quoted-vs-actual/i],
    ['capacity', /capacity utilization band/i],
    ['ask_quantity', /forward-demand quantity this run resolved/i],
  ])('%s resolves its definition tooltip', (value, expected) => {
    render(<Pill category="lead_time_col" value={value} />);
    const tip = document.getElementById(
      screen.getByTestId('pill').getAttribute('aria-describedby') as string,
    );
    expect(tip?.textContent).toMatch(expected);
  });

  it('pins the calibrated ruling: 180-day lookback, minimum 3 observations, anomalies discarded not clamped', () => {
    render(<Pill category="lead_time_col" value="calibrated" />);
    const tip = document.getElementById(
      screen.getByTestId('pill').getAttribute('aria-describedby') as string,
    );
    expect(tip?.textContent).toMatch(/180-day lookback/i);
    expect(tip?.textContent).toMatch(/minimum 3 observations/i);
    expect(tip?.textContent).toMatch(/discarded, not clamped/i);
    // Guards against the split regressing: calibrated must not silently pick
    // back up the ship_delta wording it was carved out of.
    expect(tip?.textContent).not.toMatch(/quoted-vs-actual/i);
  });

  it('ship_delta has a PILL_DEFINITIONS entry (retry-immune — independent of the console.warn dedup Set)', () => {
    // The warn test below renders every key and asserts console.warn was
    // never called. It is retry-poisoned under vitest.config's retry: 2: a
    // missing definition still fires console.warn AND permanently adds the
    // category:value pair to pill.tsx's module-scope `_warnedKeys` Set on
    // attempt 1, so a rerun on attempt 2 finds the key already "warned" and
    // silently skips the warn — attempt 2 passes even though the definition
    // is still missing. Asserting on the pure `definitionFor` lookup here
    // has no such statefulness, so it fails the same way on every retry.
    expect(definitionFor('lead_time_col', 'ship_delta')).toBeDefined();
  });

  it('renders every lead_time_col value without a missing-definition warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <>
        <Pill category="lead_time_col" value="published" />
        <Pill category="lead_time_col" value="calibrated" />
        <Pill category="lead_time_col" value="soft_quoted" />
        <Pill category="lead_time_col" value="capacity" />
        <Pill category="lead_time_col" value="ask_quantity" />
        <Pill category="lead_time_col" value="ship_delta" />
      </>,
    );
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('readiness pill', () => {
  it('renders a readiness verdict with a definition tooltip', () => {
    render(<Pill category="readiness" value="not_ready" />);
    expect(screen.getByText(/not ready/i)).toBeInTheDocument();
  });
  it('tones ready=success, at_risk=warn, not_ready=problem', () => {
    const { rerender } = render(<Pill category="readiness" value="ready" />);
    expect(document.querySelector('.text-success')).toBeTruthy();
    rerender(<Pill category="readiness" value="at_risk" />);
    expect(document.querySelector('.text-warning')).toBeTruthy();
    rerender(<Pill category="readiness" value="not_ready" />);
    expect(document.querySelector('.text-problem')).toBeTruthy();
  });
});
