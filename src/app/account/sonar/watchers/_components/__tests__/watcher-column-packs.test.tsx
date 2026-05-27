import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SignalType, WatcherRun } from '@haiwave/protocol';
import {
  buildWatcherHistoryColumnPack,
  type EnrichedWatcherRun,
} from '../watcher-column-packs';

// v.1.43 Plan 3 Task E4 — covers the watcher-history column pack's `signals`
// cell: PLT/QLT chips plus the 4+ count-with-tooltip collapse behaviour.

function makeRun(signals: SignalType[]): EnrichedWatcherRun {
  // Cast the tuple-shape requirement away — tests only exercise the cell
  // renderer, which only reads run.signal_types as a flat array.
  const signal_types = signals as WatcherRun['signal_types'];
  return {
    run_id: 'run-1',
    initiator_participant_id: 'me',
    status: 'complete',
    signal_types,
    counterparty_filter: null,
    cadence: 'on_demand',
    observation_class: 'continuous',
    triggered_at: '2026-05-27T10:00:00.000Z',
    completed_at: '2026-05-27T10:01:00.000Z',
    cancelled_at: null,
    transformation_chain: null,
    depth_limit: 1,
    template_name: 'Test watcher',
  };
}

function renderSignalsCell(signals: SignalType[]) {
  const pack = buildWatcherHistoryColumnPack();
  const col = pack.columns.find((c) => c.key === 'signals');
  if (!col) throw new Error('signals column missing from history pack');
  const run = makeRun(signals);
  return render(<>{col.render(run)}</>);
}

describe('watcher-history column pack — signals cell', () => {
  it('renders an LT chip for lead_time_distribution', () => {
    renderSignalsCell(['lead_time_distribution']);
    expect(screen.getByText('LT')).toBeInTheDocument();
  });

  it('renders a PLT chip when scope includes published_lead_time', () => {
    renderSignalsCell(['published_lead_time']);
    expect(screen.getByText('PLT')).toBeInTheDocument();
  });

  it('renders a QLT chip when scope includes quoted_lead_time', () => {
    renderSignalsCell(['quoted_lead_time']);
    expect(screen.getByText('QLT')).toBeInTheDocument();
  });

  it('renders three individual chips at the boundary below the collapse threshold', () => {
    renderSignalsCell([
      'lead_time_distribution',
      'capacity_utilization_band',
      'delivery_event',
    ]);
    expect(screen.getByText('LT')).toBeInTheDocument();
    expect(screen.getByText('CAP')).toBeInTheDocument();
    expect(screen.getByText('DEL')).toBeInTheDocument();
    // No collapsed count summary at 3 signals.
    expect(screen.queryByText(/^3 signals$/)).not.toBeInTheDocument();
  });

  it('collapses to a count + tooltip when scope carries 4+ signal types', () => {
    renderSignalsCell([
      'lead_time_distribution',
      'capacity_utilization_band',
      'delivery_event',
      'published_lead_time',
    ]);
    const count = screen.getByText('4 signals');
    expect(count).toBeInTheDocument();
    // Tooltip lists each chip label so power users can still see the full set.
    expect(count).toHaveAttribute('title', 'LT, CAP, DEL, PLT');
    // No individual chip nodes when collapsed.
    expect(screen.queryByText(/^LT$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^PLT$/)).not.toBeInTheDocument();
  });

  it('collapses the full 5-signal catalogue with all labels in the tooltip', () => {
    renderSignalsCell([
      'lead_time_distribution',
      'capacity_utilization_band',
      'delivery_event',
      'published_lead_time',
      'quoted_lead_time',
    ]);
    const count = screen.getByText('5 signals');
    expect(count).toBeInTheDocument();
    expect(count).toHaveAttribute('title', 'LT, CAP, DEL, PLT, QLT');
  });
});

describe('watcher-history column pack — name cell', () => {
  function renderNameCell(run: EnrichedWatcherRun) {
    const pack = buildWatcherHistoryColumnPack();
    const col = pack.columns.find((c) => c.key === 'name');
    if (!col) throw new Error('name column missing from history pack');
    return render(<>{col.render(run)}</>);
  }

  it('shows the watcher template_name as the link text', () => {
    renderNameCell(makeRun(['lead_time_distribution']));
    expect(screen.getByRole('link', { name: 'Test watcher' })).toBeInTheDocument();
  });

  it('falls back to the run hash when template_name is missing', () => {
    const run = makeRun(['lead_time_distribution']);
    run.template_name = undefined;
    renderNameCell(run);
    // formatRunLabel uses the first 8 chars of the run id.
    expect(screen.getByRole('link', { name: 'Run run-1' })).toBeInTheDocument();
  });
});

describe('watcher-history column pack — actions cell', () => {
  function renderActionsCell(run: EnrichedWatcherRun) {
    const pack = buildWatcherHistoryColumnPack();
    const col = pack.columns.find((c) => c.key === 'actions');
    if (!col) throw new Error('actions column missing from history pack');
    return render(<>{col.render(run)}</>);
  }

  it('renders a chevron-circle link labelled by the watcher name', () => {
    renderActionsCell(makeRun(['lead_time_distribution']));
    const link = screen.getByRole('link', { name: 'Open Test watcher' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/account/sonar/watchers/run-1');
  });

  it('uses the fallback label when the run has no template_name', () => {
    const run = makeRun(['lead_time_distribution']);
    run.template_name = undefined;
    renderActionsCell(run);
    expect(
      screen.getByRole('link', { name: 'Open Run run-1' }),
    ).toBeInTheDocument();
  });
});
