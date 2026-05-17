'use client';

import { useState } from 'react';

export function NameField({
  noun,
  value,
  onChange,
}: {
  noun: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm text-charcoal">
      <span className="block mb-1 font-medium">{noun} name</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-slate-300 px-2 py-1 text-sm w-full max-w-md"
        required
      />
    </label>
  );
}

export function LifecycleFields({
  enabled,
  retentionDays,
  onEnabledChange,
  onRetentionChange,
}: {
  enabled: boolean;
  retentionDays: number;
  onEnabledChange: (v: boolean) => void;
  onRetentionChange: (v: number) => void;
}) {
  const [retentionRaw, setRetentionRaw] = useState(String(retentionDays));

  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          aria-label="Enabled"
        />
        Enabled
      </label>
      <label className="flex items-center gap-2 text-sm text-charcoal">
        <span>Retention (days)</span>
        <input
          type="number"
          aria-label="Retention (days)"
          value={retentionRaw}
          min={30}
          max={365}
          onChange={(e) => {
            setRetentionRaw(e.target.value);
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n)) onRetentionChange(n);
          }}
          className="rounded border border-slate-300 px-2 py-1 text-sm w-20"
        />
      </label>
    </div>
  );
}
