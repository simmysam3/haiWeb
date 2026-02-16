"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { ScoreBar } from "@/components/score-bar";
import { Tabs } from "@/components/tabs";
import { useApi } from "@/lib/use-api";
import {
  MOCK_SCORES,
  MOCK_SCORE_COMPOSITE,
  MOCK_SCORE_HISTORY,
  MOCK_VENDOR_SCORES,
  MOCK_BUYER_SCORES,
  type MockScore,
} from "@/lib/mock-data";

interface ScoresApiResponse {
  composite: number;
  components: MockScore[];
  history: typeof MOCK_SCORE_HISTORY;
}

const SCORES_FALLBACK: ScoresApiResponse = {
  composite: MOCK_SCORE_COMPOSITE,
  components: MOCK_SCORES,
  history: MOCK_SCORE_HISTORY,
};

function compositeColor(score: number): string {
  if (score >= 90) return "text-success";
  if (score >= 70) return "text-teal";
  return "text-problem";
}

function compositeRingColor(score: number): string {
  if (score >= 90) return "border-success";
  if (score >= 70) return "border-teal";
  return "border-problem";
}

const TREND_TABS = [
  { key: "30d", label: "30 Days" },
  { key: "60d", label: "60 Days" },
  { key: "90d", label: "90 Days" },
];

export function ScoreDashboard() {
  const [trendPeriod, setTrendPeriod] = useState("30d");

  const { data } = useApi<ScoresApiResponse>({
    url: "/api/account/scores",
    fallback: SCORES_FALLBACK,
  });

  const history = data.history[trendPeriod as keyof typeof data.history];
  const maxHistory = Math.max(...history);
  const minHistory = Math.min(...history);

  return (
    <div className="space-y-8">
      {/* Composite Score */}
      <Card>
        <div className="flex items-center gap-8">
          <div className={`w-32 h-32 rounded-full border-8 ${compositeRingColor(data.composite)} flex items-center justify-center shrink-0`}>
            <div className="text-center">
              <p className={`text-3xl font-bold ${compositeColor(data.composite)}`}>{data.composite}</p>
              <p className="text-xs text-slate">/ 100</p>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-1">Composite Score</h3>
            <p className="text-sm text-slate mb-4">
              Overall performance across all behavioral dimensions.
            </p>
            <div className="space-y-3">
              {data.components.map((s) => (
                <ScoreBar key={s.key} label={s.label} value={s.value} />
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Trend */}
      <Card title="Score Trend">
        <Tabs tabs={TREND_TABS} active={trendPeriod} onChange={setTrendPeriod} />
        <div className="flex items-end gap-1 h-32">
          {history.map((val, i) => {
            const height = ((val - minHistory + 5) / (maxHistory - minHistory + 10)) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end">
                <div
                  className="w-full bg-teal/60 rounded-t"
                  style={{ height: `${height}%` }}
                  title={`${val}`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-slate">
            {trendPeriod === "30d" ? "30" : trendPeriod === "60d" ? "60" : "90"} days ago
          </span>
          <span className="text-xs text-slate">Today</span>
        </div>
      </Card>

      {/* Vendor / Buyer Breakdown */}
      <div className="grid grid-cols-2 gap-6">
        <Card title="Vendor Score">
          <div className="flex items-center gap-4 mb-4">
            <div className={`text-2xl font-bold ${compositeColor(MOCK_VENDOR_SCORES.composite)}`}>
              {MOCK_VENDOR_SCORES.composite}
            </div>
            <p className="text-sm text-slate">Overall vendor performance</p>
          </div>
          <div className="space-y-3">
            {MOCK_VENDOR_SCORES.components.map((c) => (
              <ScoreBar key={c.label} label={c.label} value={c.value} />
            ))}
          </div>
        </Card>

        <Card title="Buyer Score">
          <div className="flex items-center gap-4 mb-4">
            <div className={`text-2xl font-bold ${compositeColor(MOCK_BUYER_SCORES.composite)}`}>
              {MOCK_BUYER_SCORES.composite}
            </div>
            <p className="text-sm text-slate">Overall buyer performance</p>
          </div>
          <div className="space-y-3">
            {MOCK_BUYER_SCORES.components.map((c) => (
              <ScoreBar key={c.label} label={c.label} value={c.value} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
