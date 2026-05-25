'use client';

interface Props {
  value: string;
  onChange: (next: string) => void;
}

export function ManifestsSearchBox({ value, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 rounded border border-slate/20 bg-white px-2 py-1.5">
      <span aria-hidden="true" className="text-slate">⌕</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search products by name or SKU…"
        className="flex-1 outline-none text-sm bg-transparent"
        aria-label="Search products"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-xs text-slate hover:text-charcoal"
        >
          Clear
        </button>
      )}
    </label>
  );
}
