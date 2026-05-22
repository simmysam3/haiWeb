'use client';

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
