interface SparklineProps {
  values: number[];                  // 0..1 scaled
  partialFromIndex?: number;         // index from which to render the partial segment dashed
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Tiny inline-SVG sparkline. Plots `values` as a polyline scaled to fit the
 * box. Anything from `partialFromIndex` onward is rendered dashed so the user
 * sees that the trailing segment is in-progress data.
 */
export function Sparkline({
  values,
  partialFromIndex,
  width = 96,
  height = 28,
  className,
}: SparklineProps) {
  if (values.length === 0) {
    return <svg width={width} height={height} className={className} aria-hidden />;
  }
  if (values.length === 1) {
    return (
      <svg width={width} height={height} className={className} aria-hidden>
        <circle cx={width / 2} cy={height / 2} r={2} fill="currentColor" />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1; // avoid div-by-zero
  const padding = 2;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 2 * padding) + padding;
    const y = height - padding - ((v - min) / span) * (height - 2 * padding);
    return [x, y] as const;
  });

  // Split into solid (complete) and dashed (partial) polylines so the partial
  // segment is visually distinct.
  const solidEnd = partialFromIndex ?? points.length;
  const solidPts = points.slice(0, solidEnd).map(([x, y]) => `${x},${y}`).join(' ');
  const dashedPts =
    partialFromIndex !== undefined && partialFromIndex > 0
      ? points
          .slice(partialFromIndex - 1)
          .map(([x, y]) => `${x},${y}`)
          .join(' ')
      : '';

  return (
    <svg width={width} height={height} className={className}>
      {solidPts && (
        <polyline
          points={solidPts}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {dashedPts && (
        <polyline
          points={dashedPts}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
        />
      )}
      {/* End-point dot */}
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={2}
        fill="currentColor"
      />
    </svg>
  );
}
