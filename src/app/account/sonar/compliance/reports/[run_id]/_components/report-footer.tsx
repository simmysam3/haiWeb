import type { ReportFooter as ReportFooterType } from '@/lib/haiwave-api';

export function ReportFooter({ footer }: { footer: ReportFooterType }) {
  return (
    <footer className="mt-8 border-t border-slate/20 pt-4 text-xs text-slate space-y-1">
      <div>Generated {new Date(footer.generated_at).toLocaleString()}</div>
      <div>
        Contact: {footer.contact_email ?? <span className="italic">No contact configured</span>}
      </div>
      <div className="italic">{footer.disclaimer}</div>
    </footer>
  );
}
