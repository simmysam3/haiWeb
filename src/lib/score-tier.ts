// Shared helper for mapping a 0–100 score to a visual tier.
// Keeps color thresholds in one place across ScoreBar, score dashboards,
// partner cards, and company profile modal.

export type ScoreTier = "high" | "mid" | "low";

export function scoreTier(value: number): ScoreTier {
  if (value >= 90) return "high";
  if (value >= 70) return "mid";
  return "low";
}

const BG_CLASSES: Record<ScoreTier, string> = {
  high: "bg-success",
  mid: "bg-teal",
  low: "bg-problem",
};

const TEXT_CLASSES: Record<ScoreTier, string> = {
  high: "text-success",
  mid: "text-teal",
  low: "text-problem",
};

export function scoreBgClass(value: number): string {
  return BG_CLASSES[scoreTier(value)];
}

export function scoreTextClass(value: number): string {
  return TEXT_CLASSES[scoreTier(value)];
}
