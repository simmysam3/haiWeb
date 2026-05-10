export const MISSING_WEIGHT = 0.25;

const AUDIT_COEF = 0.4;
const PD_COEF = 0.3;
const WATCHER_COEF = 0.3;

const GREEN_CUTOFF = 0.33;
const RED_CUTOFF = 0.67;

export type RiskColor = 'green' | 'yellow' | 'red';
export type RiskLabel = 'normal' | 'elevated' | 'critical';

export interface RiskWeights {
  audit: number | null;
  phantom_demand: number | null;
  watcher: number | null;
}

export interface RiskScoreResult {
  score: number;
  color: RiskColor;
  label: RiskLabel;
}

/** Spec §7.7 — PD risk weight derived from probe response rate.
 *  Zero-probe counterparties receive the floor (0.25 = MISSING_WEIGHT).
 *  Otherwise: pd_weight = 1 − response_rate. */
export function computePdWeight(pd: { totalProbes: number; directResponses: number }): number {
  if (pd.totalProbes === 0) return MISSING_WEIGHT;
  const responseRate = pd.directResponses / pd.totalProbes;
  return 1 - responseRate;
}

export interface PdProbeInput {
  pd: { totalProbes: number; directResponses: number };
  audit: { ratio: number };
  watcher: { ratio: number };
}

export interface PdWeightedResult {
  pdWeight: number;
  total: number;
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

/** Overload 1 — legacy flat weights (used by cross-modality table). */
export function computeRiskScore(weights: RiskWeights): RiskScoreResult;
/** Overload 2 — spec §7.7 probe-based PD input; returns pdWeight + total (0.4/0.3/0.3 formula). */
export function computeRiskScore(input: PdProbeInput): PdWeightedResult;
export function computeRiskScore(arg: RiskWeights | PdProbeInput): RiskScoreResult | PdWeightedResult {
  if ('pd' in arg) {
    const pdWeight = computePdWeight(arg.pd);
    const total = AUDIT_COEF * arg.audit.ratio + PD_COEF * pdWeight + WATCHER_COEF * arg.watcher.ratio;
    return { pdWeight, total };
  }

  const audit_w = weightOrFloor(arg.audit);
  const pd_w = weightOrFloor(arg.phantom_demand);
  const watcher_w = weightOrFloor(arg.watcher);

  const score = audit_w * AUDIT_COEF + pd_w * PD_COEF + watcher_w * WATCHER_COEF;

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
