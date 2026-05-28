'use client';

interface VendorOption {
  participant_id: string;
  legal_name: string;
}

interface VendorExcludeMultiSelectProps {
  options: VendorOption[];
  value: string[];  // participant_ids currently excluded
  onChange: (value: string[]) => void;
}

export function VendorExcludeMultiSelect({ options, value, onChange }: VendorExcludeMultiSelectProps) {
  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    onChange(next);
  };
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Vendors to exclude</legend>
      {options.length === 0 ? (
        <p className="text-sm text-slate-500">No vendor counterparties available.</p>
      ) : (
        options.map((opt) => (
          <label key={opt.participant_id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.includes(opt.participant_id)}
              onChange={() => toggle(opt.participant_id)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            {opt.legal_name}
          </label>
        ))
      )}
    </fieldset>
  );
}
