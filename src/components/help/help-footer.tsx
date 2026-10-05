// src/components/help/help-footer.tsx
'use client';

import { useEffect, useState } from 'react';
import type { HelpLanguage } from '@haiwave/protocol';
import { HELP_STRINGS, t } from './strings';
import type { HelpWidgetState } from './help-storage';
import type { HelpSummaryState } from './help-context';

/** Renders a translated sentence whose `{contact}` placeholder becomes a mailto link. */
export function ContactSentence({ template, contact }: { template: string; contact: string }) {
  const [before, after = ''] = template.split('{contact}');
  return (
    <>
      {before}
      <a href={`mailto:${contact}`} className="font-medium text-teal-dark underline">
        {contact}
      </a>
      {after}
    </>
  );
}

interface HelpFooterProps {
  language: HelpLanguage;
  pack: HelpWidgetState['pack'];
  canSummarize: boolean;
  summary: HelpSummaryState;
  onSummarize(): void;
}

export function HelpFooter({ language, pack, canSummarize, summary, onSummarize }: HelpFooterProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copySummary = (text: string) => {
    const pending = typeof navigator !== 'undefined' ? navigator.clipboard?.writeText(text) : undefined;
    pending?.then(
      () => setCopied(true),
      () => undefined,
    );
  };

  return (
    <footer className="space-y-2 border-t border-slate/15 px-4 py-2 text-[11px] text-slate">
      {summary.status === 'ready' && (
        <div className="space-y-1 rounded-md border border-slate/15 bg-light-gray/60 p-2 text-xs text-charcoal">
          <p>
            <ContactSentence template={HELP_STRINGS[language].summaryIntro} contact={summary.contact} />
          </p>
          <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-sans">{summary.summary}</pre>
          <button
            type="button"
            onClick={() => copySummary(summary.summary)}
            className="rounded border border-slate/20 bg-white px-2 py-0.5 text-[11px] text-charcoal hover:border-teal"
          >
            {copied ? t(language, 'copied') : t(language, 'copy')}
          </button>
        </div>
      )}
      {summary.status === 'failed' && (
        <p role="alert" className="text-problem">
          {t(language, 'summaryFailed')}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span>{pack ? t(language, 'footerEdition', { edition: pack.guideEdition, date: pack.packDate }) : null}</span>
        <button
          type="button"
          onClick={onSummarize}
          disabled={!canSummarize || summary.status === 'loading'}
          className="shrink-0 font-medium text-teal-dark hover:underline disabled:cursor-not-allowed disabled:text-light-slate disabled:no-underline"
        >
          {t(language, 'summarize')}
        </button>
      </div>
      {pack && !pack.servedMatches && (
        <p role="note" className="text-charcoal">
          <span aria-hidden="true">⚠ </span>
          {t(language, 'mismatch')}
        </p>
      )}
    </footer>
  );
}
