import { Pill } from '@/components/pill';

type Color = 'green' | 'yellow' | 'red';
type Label = 'normal' | 'elevated' | 'critical';

interface Props {
  color: Color;
  label: Label;
}

const TONE: Record<Color, 'success' | 'warn' | 'problem'> = {
  green: 'success',
  yellow: 'warn',
  red: 'problem',
};

export function RiskPill({ color, label }: Props) {
  return (
    <Pill category="risk" value={label} tone={TONE[color]}>
      {label}
    </Pill>
  );
}
