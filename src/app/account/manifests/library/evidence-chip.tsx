import type { LibraryElement, LibraryArtifactRow } from '@/lib/library-types';
import { Pill } from '@/components/pill';

interface EvidenceChipProps {
  element: LibraryElement;
  onAdd: () => void;
  onDraftAction?: (itemId: string, action: 'affirm' | 'reject') => void;
}

function ArtifactLink({ artifact }: { artifact: LibraryArtifactRow }) {
  if (artifact.origin === 'upload') {
    return (
      <a
        href={`/api/account/library/artifacts/${artifact.id}/file`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-teal underline hover:text-navy"
      >
        {artifact.title}
      </a>
    );
  }
  if (artifact.origin === 'url' || (artifact.origin === 'auto_gathered' && artifact.sourceUrl)) {
    return (
      <a
        href={artifact.sourceUrl ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="text-teal underline hover:text-navy"
      >
        {artifact.title}
      </a>
    );
  }
  return <span>{artifact.title}</span>;
}

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .slice(0, 2)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }
  return String(value);
}

export function EvidenceChip({ element, onAdd, onDraftAction }: EvidenceChipProps) {
  const artifact =
    element.artifacts.find((a) => a.status !== 'superseded') ?? element.artifacts[0] ?? null;
  const attribute = element.attribute;
  const displayed = attribute ?? artifact;

  if (!artifact && !attribute) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="text-xs text-teal underline hover:text-navy"
      >
        + Add
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {attribute && <span className="text-sm">{formatValue(attribute.valueJson)}</span>}
      {artifact && <ArtifactLink artifact={artifact} />}
      {displayed && <Pill category="library_status" value={displayed.status} />}
      {displayed && displayed.status === 'draft' && onDraftAction && (
        <>
          <button
            type="button"
            onClick={() => onDraftAction(displayed.id, 'affirm')}
            className="rounded border border-teal px-1.5 py-0.5 text-xs text-teal hover:bg-teal/10"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => onDraftAction(displayed.id, 'reject')}
            className="rounded border border-slate/30 px-1.5 py-0.5 text-xs text-slate hover:bg-light-gray/40"
          >
            Reject
          </button>
        </>
      )}
      {artifact?.validUntil && (
        <span className="text-xs text-slate">
          valid until {new Date(artifact.validUntil).toLocaleDateString()}
        </span>
      )}
    </span>
  );
}
