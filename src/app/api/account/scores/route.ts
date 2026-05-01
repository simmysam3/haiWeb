import { withHaiCore } from "@/lib/with-hai-core";
import {
  MOCK_SCORES,
  MOCK_SCORE_COMPOSITE,
  MOCK_SCORE_HISTORY,
} from "@/lib/mock-data";

/**
 * GET /api/account/scores
 *
 * Returns behavioral scores from haiCore in the dashboard's expected shape.
 * haiCore returns a flat BehavioralScoreResponse with 0-1 scaled fields; the
 * dashboard expects a `{composite, components}` envelope on a 0-100 scale, so
 * we transform here. History is still mocked until haiCore exposes the
 * 30d/60d/90d windows the dashboard slices on.
 */
const COMPONENT_FIELDS: Array<{ key: string; label: string; src: string }> = [
  { key: "fulfillment", label: "Fulfillment Reliability", src: "fulfillment_reliability" },
  { key: "response_time", label: "Response Time", src: "response_time_score" },
  { key: "price_adherence", label: "Price Adherence", src: "price_adherence" },
  { key: "agent_uptime", label: "Agent Uptime", src: "agent_uptime_score" },
  { key: "network_activity", label: "Network Activity", src: "network_activity_score" },
  { key: "demand_verifiability", label: "Demand Verifiability", src: "demand_verifiability" },
];

function toPct(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export const GET = withHaiCore(
  async ({ client, session }) => {
    const score = (await client.getScore(session.participant.id)) as Record<string, unknown>;
    return {
      composite: toPct(score.overall_score),
      components: COMPONENT_FIELDS
        .filter((f) => score[f.src] !== null && score[f.src] !== undefined)
        .map((f) => ({
          key: f.key,
          label: f.label,
          value: toPct(score[f.src]),
          trend: 0, // haiCore doesn't yet expose period-over-period delta
        })),
      history: MOCK_SCORE_HISTORY,
    };
  },
  {
    fallback: {
      composite: MOCK_SCORE_COMPOSITE,
      components: MOCK_SCORES,
      history: MOCK_SCORE_HISTORY,
    },
  },
);
