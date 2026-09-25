'use client';

export function FileStep({ onFile, error }: { onFile(f: File): void; error: string | null }) {
  return (
    <div>
      <p className="sm-muted text-sm">
        An .xlsx, .xls or .csv file, up to 10 MB and 5,000 rows. It is read in your browser; only the rows you map are sent.
      </p>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        aria-label="Spreadsheet file"
        className="mt-3 text-sm"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {error && <p role="alert" className="sm-error mt-3 text-sm">{error}</p>}
    </div>
  );
}
