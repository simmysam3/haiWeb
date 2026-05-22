'use client';

interface ForkIndicatorProps {
  sourceName: string;
  onRevert: () => void;
}

/**
 * Inline hint shown in the Identity step when the user has renamed a source
 * run's template, signalling that submitting will create a brand-new audit
 * definition rather than reusing the existing one.
 */
export function ForkIndicator({ sourceName, onRevert }: ForkIndicatorProps) {
  return (
    <div
      role="status"
      className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-orange/30 bg-orange/5 px-3 py-2"
    >
      <p className="text-xs text-orange leading-snug">
        <span className="font-semibold">Forking</span> — name differs from
        source{' '}
        <span className="font-mono text-[11px]">
          &ldquo;{sourceName}&rdquo;
        </span>
        . Submitting will create a new audit definition.
      </p>
      <button
        type="button"
        onClick={onRevert}
        className="flex-none text-xs font-medium text-orange hover:underline whitespace-nowrap"
      >
        Revert name
      </button>
    </div>
  );
}
