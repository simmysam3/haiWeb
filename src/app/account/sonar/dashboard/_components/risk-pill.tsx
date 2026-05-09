type Color = 'green' | 'yellow' | 'red';
type Label = 'normal' | 'elevated' | 'critical';

interface Props {
  color: Color;
  label: Label;
}

const COLOR_CLASSES: Record<Color, string> = {
  green: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  yellow: 'bg-amber-100 text-amber-900 border-amber-300',
  red: 'bg-rose-100 text-rose-900 border-rose-300',
};

export function RiskPill({ color, label }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${COLOR_CLASSES[color]}`}
      aria-label={`risk: ${label}`}
      role="status"
    >
      {label}
    </span>
  );
}
