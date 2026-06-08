interface DownloadCardProps {
  title: string;
  subtitle: string;
  href: string;
  available: boolean;
}

export function DownloadCard({ title, subtitle, href, available }: DownloadCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate/15 bg-white p-4">
      <div>
        <div className="font-medium text-charcoal">{title}</div>
        <div className="text-sm text-slate">{subtitle}</div>
      </div>
      {available ? (
        <a
          href={href}
          className="inline-flex items-center justify-center rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-charcoal"
        >
          Download
        </a>
      ) : (
        <span className="rounded-lg bg-light-gray px-4 py-2 text-sm text-slate">
          Not yet published
        </span>
      )}
    </div>
  );
}
