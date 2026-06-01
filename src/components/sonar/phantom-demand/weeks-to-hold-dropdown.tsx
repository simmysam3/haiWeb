'use client';

interface WeeksToHoldDropdownProps {
  value: number;
  onChange: (weeks: number) => void;
  disabled?: boolean;
  ariaLabelledBy?: string;
}

export function WeeksToHoldDropdown({ value, onChange, disabled, ariaLabelledBy }: WeeksToHoldDropdownProps) {
  return (
    <select
      aria-labelledby={ariaLabelledBy}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
    >
      {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
        <option key={w} value={w}>
          {w} week{w === 1 ? '' : 's'}
        </option>
      ))}
    </select>
  );
}
