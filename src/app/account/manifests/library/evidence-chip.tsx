import type { LibraryElement, LibraryArtifactRow } from '@/lib/library-types';
import { Pill } from '@/components/pill';

interface EvidenceChipProps {
  element: LibraryElement;
  onAdd: () => void;
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

export function EvidenceChip({ element, onAdd }: EvidenceChipProps) {
  const artifact =
    element.artifacts.find((a) => a.status !== 'superseded') ?? element.artifacts[0] ?? null;
  const attribute = element.attribute;

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
      {(attribute ?? artifact) && (
        <Pill category="library_status" value={(attribute ?? artifact)!.status} />
      )}
      {artifact?.validUntil && (
        <span className="text-xs text-slate">
          valid until {new Date(artifact.validUntil).toLocaleDateString()}
        </span>
      )}
    </span>
  );
}
