'use client';

interface MatrixCellProps {
  enabled: boolean;
  context: 'share' | 'require';
  label: string;
  disabled?: boolean;
  onToggle: () => void;
}

export function MatrixCell({ enabled, context, label, disabled, onToggle }: MatrixCellProps) {
  const onTone = context === 'share' ? 'bg-teal border-teal' : 'bg-orange border-orange';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`h-6 w-10 rounded border transition-colors ${
        enabled ? onTone : 'bg-light-gray border-slate/30'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-navy'}`}
    />
  );
}
