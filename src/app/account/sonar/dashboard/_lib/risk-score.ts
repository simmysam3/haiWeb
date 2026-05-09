export const MISSING_WEIGHT = 0.25;

const AUDIT_COEF = 0.4;
const PD_COEF = 0.3;
const TYPE2_COEF = 0.3;

const GREEN_CUTOFF = 0.33;
const RED_CUTOFF = 0.67;

export type RiskColor = 'green' | 'yellow' | 'red';
export type RiskLabel = 'normal' | 'elevated' | 'critical';

export interface RiskWeights {
  audit: number | null;
  phantom_demand: number | null;
  type2: number | null;
}

export interface RiskScoreResult {
  score: number;
  color: RiskColor;
  label: RiskLabel;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function weightOrFloor(n: number | null): number {
  if (n === null || n === undefined || Number.isNaN(n)) return MISSING_WEIGHT;
  return clamp01(n);
}

export function computeRiskScore(weights: RiskWeights): RiskScoreResult {
  const audit_w = weightOrFloor(weights.audit);
  const pd_w = weightOrFloor(weights.phantom_demand);
  const t2_w = weightOrFloor(weights.type2);

  const score = audit_w * AUDIT_COEF + pd_w * PD_COEF + t2_w * TYPE2_COEF;

  let color: RiskColor;
  let label: RiskLabel;
  if (score < GREEN_CUTOFF) {
    color = 'green';
    label = 'normal';
  } else if (score < RED_CUTOFF) {
    color = 'yellow';
    label = 'elevated';
  } else {
    color = 'red';
    label = 'critical';
  }

  return { score, color, label };
}
