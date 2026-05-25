'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type {
  QuarterlyScore,
  PeerAggregateResponse,
  VendorRiskResponse,
  VendorRiskEntry,
  VendorRiskDimension,
} from '@haiwave/protocol';
import { Card } from '@/components/card';
import { Drawer } from '@/components/drawer';
import { Sparkline } from '@/components/sparkline';
import { ScoreBar } from '@/components/score-bar';

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
};

function pct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${Math.round(v * 100)}`;
}

function deltaTone(delta: number): string {
  if (delta > 0.5) return 'text-success';
  if (delta < -0.5) return 'text-problem';
  return 'text-slate';
}

function trajectoryTone(values: number[]): string {
  if (values.length < 2) return 'text-slate';
  const last = values[values.length - 1];
  const first = values[0];
  if (last - first > 0.02) return 'text-success';
  if (last - first < -0.02) return 'text-problem';
  return 'text-slate';
}

const COMPONENT_FIELDS: Array<{ key: keyof QuarterlyScore; label: string }> = [
  { key: 'fulfillment_reliability', label: 'Fulfillment Reliability' },
  { key: 'response_time_score', label: 'Response Time' },
  { key: 'price_adherence', label: 'Price Adherence' },
  { key: 'agent_uptime_score', label: 'Agent Uptime' },
  { key: 'network_activity_score', label: 'Network Activity' },
  { key: 'demand_verifiability', label: 'Demand Verifiability' },
];

export function ScoreDashboard() {
  const myQuarters = useSWR<{ quarters: QuarterlyScore[] }>(
    '/api/account/scores/quarterly?n=5',
    fetcher,
  );
  const peer = useSWR<PeerAggregateResponse>(
    '/api/account/scores/peer-aggregate?n=5',
    fetcher,
  );

  const myHistory = myQuarters.data?.quarters ?? [];
  const myCurrent = myHistory[myHistory.length - 1];
  const peerCurrent = peer.data?.quarters?.[peer.data.quarters.length - 1];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MyScoreCard current={myCurrent} loading={myQuarters.isLoading} />
        <PeerBenchmarkCard
          peerCurrent={peerCurrent}
          myCurrent={myCurrent}
          cohortSize={peer.data?.cohort_size ?? 0}
          loading={peer.isLoading}
        />
      </div>

      <MyTrendCard history={myHistory} peerHistory={peer.data?.quarters ?? []} />

      <VendorRiskRegister />
    </div>
  );
}

function MyScoreCard({
  current,
  loading,
}: {
  current: QuarterlyScore | undefined;
  loading: boolean;
}) {
  return (
    <Card>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy">
          Your score
        </h2>
        {current && (
          <span className="text-xs text-slate">{current.period_label}</span>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : !current ? (
        <p className="text-sm text-slate">No score available yet.</p>
      ) : (
        <div className="flex items-center gap-6">
          <div className="text-center shrink-0">
            <p className="text-4xl font-bold text-navy leading-none">{pct(current.overall_score)}</p>
            <p className="text-xs text-slate mt-1">/ 100</p>
          </div>
          <div className="flex-1 space-y-2">
            {COMPONENT_FIELDS.map((f) => {
              const v = current[f.key] as number | null | undefined;
              if (v === null || v === undefined) return null;
              return (
                <div key={f.key as string}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-charcoal">{f.label}</span>
                    <span className="text-charcoal font-medium">{pct(v)}</span>
                  </div>
                  <ScoreBar value={Math.round(v * 100)} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

function PeerBenchmarkCard({
  peerCurrent,
  myCurrent,
  cohortSize,
  loading,
}: {
  peerCurrent: PeerAggregateResponse['quarters'][number] | undefined;
  myCurrent: QuarterlyScore | undefined;
  cohortSize: number;
  loading: boolean;
}) {
  const delta =
    peerCurrent && myCurrent
      ? Math.round(myCurrent.overall_score * 100) - Math.round(peerCurrent.composite_avg * 100)
      : 0;

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy">
          Vendor cohort benchmark
        </h2>
        <span className="text-xs text-slate">
          {cohortSize} vendor{cohortSize === 1 ? '' : 's'}
        </span>
      </div>
      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : !peerCurrent ? (
        <p className="text-sm text-slate">
          No vendor cohort yet. Add trading partners with origin manifests to populate this benchmark.
        </p>
      ) : (
        <div className="flex items-center gap-6">
          <div className="text-center shrink-0">
            <p className="text-4xl font-bold text-navy leading-none">{pct(peerCurrent.composite_avg)}</p>
            <p className="text-xs text-slate mt-1">cohort avg</p>
          </div>
          <div className="flex-1">
            {myCurrent && (
              <p className="text-sm mb-3">
                Your score is{' '}
                <span className={`font-semibold ${deltaTone(delta)}`}>
                  {delta >= 0 ? `+${delta}` : delta}
                </span>{' '}
                vs the vendor cohort.
              </p>
            )}
            <div className="space-y-1.5 text-xs">
              {[
                { label: 'Fulfillment Reliability', v: peerCurrent.fulfillment_reliability_avg },
                { label: 'Response Time', v: peerCurrent.response_time_avg },
                { label: 'Price Adherence', v: peerCurrent.price_adherence_avg },
                { label: 'Agent Uptime', v: peerCurrent.agent_uptime_avg },
                { label: 'Network Activity', v: peerCurrent.network_activity_avg },
                { label: 'Demand Verifiability', v: peerCurrent.demand_verifiability_avg },
              ].map((c) => (
                <div key={c.label} className="flex items-center justify-between">
                  <span className="text-slate">{c.label}</span>
                  <span className="text-charcoal font-medium">{pct(c.v)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function MyTrendCard({
  history,
  peerHistory,
}: {
  history: QuarterlyScore[];
  peerHistory: PeerAggregateResponse['quarters'];
}) {
  const myValues = history.map((q) => q.overall_score);
  const partialIdx = history.findIndex((q) => q.partial);

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy">
          Your trend, last {history.length} quarters
        </h2>
      </div>
      {history.length === 0 ? (
        <p className="text-sm text-slate">No history.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <Sparkline
              values={myValues}
              partialFromIndex={partialIdx >= 0 ? partialIdx : undefined}
              width={400}
              height={64}
              className={trajectoryTone(myValues)}
            />
          </div>
          <table className="w-full text-xs">
            <thead className="text-slate">
              <tr>
                <th className="text-left font-medium pb-1">Quarter</th>
                <th className="text-right font-medium pb-1">You</th>
                <th className="text-right font-medium pb-1">Cohort</th>
                <th className="text-right font-medium pb-1">Δ</th>
              </tr>
            </thead>
            <tbody>
              {history.map((q, i) => {
                const peer = peerHistory[i];
                const delta =
                  peer !== undefined
                    ? Math.round(q.overall_score * 100) - Math.round(peer.composite_avg * 100)
                    : null;
                return (
                  <tr key={q.period_start} className="border-t border-slate/10">
                    <td className="py-1.5 text-charcoal">{q.period_label}</td>
                    <td className="py-1.5 text-right text-charcoal font-medium">
                      {pct(q.overall_score)}
                    </td>
                    <td className="py-1.5 text-right text-charcoal">
                      {peer ? pct(peer.composite_avg) : '—'}
                    </td>
                    <td className={`py-1.5 text-right font-medium ${delta != null ? deltaTone(delta) : 'text-slate'}`}>
                      {delta != null ? (delta >= 0 ? `+${delta}` : delta) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] italic text-slate leading-relaxed">
            The trailing quarter is in progress and shown as the dashed segment of the
            sparkline. It&apos;s included in the trajectory display but excluded from any
            quarter-over-quarter acceleration math (see vendor risk register), which
            compares only the four completed quarters so partial-quarter volume
            doesn&apos;t skew the slope.
          </p>
        </div>
      )}
    </Card>
  );
}

function VendorRiskRegister() {
  const [dim, setDim] = useState<VendorRiskDimension>('current');
  const [drawerVendor, setDrawerVendor] = useState<VendorRiskEntry | null>(null);

  const risk = useSWR<VendorRiskResponse>(
    `/api/account/scores/vendor-risk?dimension=${dim}&n=5`,
    fetcher,
  );

  const vendors = risk.data?.vendors ?? [];

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy">
          Vendor risk register
        </h2>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setDim('current')}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
              dim === 'current'
                ? 'bg-navy text-white'
                : 'bg-white text-slate border border-slate/20 hover:bg-slate/5'
            }`}
          >
            Lowest current score
          </button>
          <button
            onClick={() => setDim('decline_acceleration')}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
              dim === 'decline_acceleration'
                ? 'bg-navy text-white'
                : 'bg-white text-slate border border-slate/20 hover:bg-slate/5'
            }`}
          >
            Accelerating decline
          </button>
        </div>
      </div>

      {risk.isLoading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : vendors.length === 0 ? (
        <p className="text-sm text-slate">No vendors in your cohort yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate border-b border-slate/15">
                <th className="pb-3 font-medium">Rank</th>
                <th className="pb-3 font-medium">Vendor</th>
                <th className="pb-3 font-medium text-right">Current</th>
                <th className="pb-3 font-medium text-right">5Q trend</th>
                <th className="pb-3 font-medium text-right">QoQ accel.</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {vendors.map((v, i) => (
                <tr
                  key={v.vendor_id}
                  onClick={() => setDrawerVendor(v)}
                  className="border-b border-slate/10 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="py-3 text-slate">{i + 1}</td>
                  <td className="py-3 text-navy font-medium">{v.vendor_name}</td>
                  <td className="py-3 text-right text-charcoal font-medium">
                    {pct(v.current_score)}
                  </td>
                  <td className="py-3 text-right">
                    <Sparkline
                      values={v.history.map((h) => h.overall_score)}
                      partialFromIndex={v.history.findIndex((h) => h.partial)}
                      className={`inline-block ${trajectoryTone(v.history.map((h) => h.overall_score))}`}
                    />
                  </td>
                  <td
                    className={`py-3 text-right font-medium ${
                      v.decline_acceleration < -0.005
                        ? 'text-problem'
                        : v.decline_acceleration > 0.005
                          ? 'text-success'
                          : 'text-slate'
                    }`}
                  >
                    {v.decline_acceleration === 0
                      ? '—'
                      : `${(v.decline_acceleration * 100).toFixed(1)} pts/Q`}
                  </td>
                  <td className="py-3 text-right text-teal text-xs pr-2">
                    View <span className="text-lg font-bold align-middle">›</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] italic text-slate leading-relaxed">
        QoQ acceleration is the change in slope across your four completed quarters
        (recent-half average delta minus older-half average delta). Negative values
        flag vendors whose decline is getting steeper. The trailing partial quarter
        is shown in each sparkline for trajectory but excluded from this calculation
        so in-progress data doesn&apos;t distort the rank.
      </p>

      <VendorDetailDrawer vendor={drawerVendor} onClose={() => setDrawerVendor(null)} />
    </Card>
  );
}

function VendorDetailDrawer({
  vendor,
  onClose,
}: {
  vendor: VendorRiskEntry | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={vendor !== null}
      onClose={onClose}
      title={vendor?.vendor_name ?? 'Vendor'}
      width="max-w-2xl"
    >
      {vendor && (
        <div className="space-y-6">
          <section>
            <dl className="grid grid-cols-[max-content,1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate">Current score</dt>
              <dd className="text-charcoal">{pct(vendor.current_score)}</dd>
              <dt className="text-slate">QoQ acceleration</dt>
              <dd className="text-charcoal">
                {vendor.decline_acceleration === 0
                  ? 'Insufficient history'
                  : `${(vendor.decline_acceleration * 100).toFixed(1)} pts/Q`}
              </dd>
            </dl>
          </section>

          <section>
            <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-navy mb-3">
              Composite trajectory
            </h3>
            <Sparkline
              values={vendor.history.map((h) => h.overall_score)}
              partialFromIndex={vendor.history.findIndex((h) => h.partial)}
              width={400}
              height={48}
              className={trajectoryTone(vendor.history.map((h) => h.overall_score))}
            />
          </section>

          <section>
            <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-navy mb-3">
              Per-component history
            </h3>
            <table className="w-full text-xs">
              <thead className="text-slate">
                <tr>
                  <th className="text-left font-medium pb-1">Component</th>
                  {vendor.history.map((h) => (
                    <th key={h.period_start} className="text-right font-medium pb-1">
                      {h.period_label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Composite', key: 'overall_score' },
                  { label: 'Fulfillment Reliability', key: 'fulfillment_reliability' },
                  { label: 'Response Time', key: 'response_time_score' },
                  { label: 'Price Adherence', key: 'price_adherence' },
                  { label: 'Agent Uptime', key: 'agent_uptime_score' },
                  { label: 'Network Activity', key: 'network_activity_score' },
                  { label: 'Demand Verifiability', key: 'demand_verifiability' },
                ].map((row) => (
                  <tr key={row.key} className="border-t border-slate/10">
                    <td className="py-1.5 text-charcoal">{row.label}</td>
                    {vendor.history.map((h) => {
                      const v = h[row.key as keyof QuarterlyScore] as
                        | number
                        | null
                        | undefined;
                      return (
                        <td
                          key={h.period_start}
                          className="py-1.5 text-right text-charcoal"
                        >
                          {pct(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </Drawer>
  );
}
