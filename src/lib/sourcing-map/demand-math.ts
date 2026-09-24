/**
 * Integer shares of `total` proportional to `weights`, summing exactly to
 * `total` (spec §8.2 largest remainder). Ties in the remainder go to the
 * earlier index. All-zero weights split evenly.
 */
export function largestRemainder(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const w = sum > 0 ? weights : weights.map(() => 1);
  const s = sum > 0 ? sum : weights.length;
  const raw = w.map((x) => (total * x) / s);
  const out = raw.map((r) => Math.floor(r));
  let rem = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rem > 0 && k < order.length; k++, rem--) out[order[k]![1]] += 1;
  return out;
}
