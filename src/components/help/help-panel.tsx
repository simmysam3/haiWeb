// src/components/help/help-panel.tsx
'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { HELP_LANGUAGES, type HelpLanguage } from '@haiwave/protocol';
import { HELP_LANGUAGE_LABELS, HELP_STRINGS, isHelpLanguage, t } from './strings';
import { HELP_PANEL_ID, useHelp } from './help-context';
import type { HelpNotice } from './help-state';
import { HelpMessages } from './help-messages';
import { HelpComposer } from './help-composer';
import { ContactSentence, HelpFooter } from './help-footer';

function NoticeBanner({ notice, language }: { notice: HelpNotice; language: HelpLanguage }) {
  const base = 'mx-4 mt-2 rounded-md border px-3 py-2 text-xs';
  const problem = `${base} border-problem/20 bg-problem/5 text-problem`;
  switch (notice.kind) {
    case 'budget_exhausted':
      return (
        <div role="alert" className={problem}>
          {t(language, 'budget')} <ContactSentence template={HELP_STRINGS[language].contact} contact={notice.contact} />
        </div>
      );
    case 'rate_limited':
      return (
        <div role="status" className={`${base} border-slate/15 bg-light-gray text-charcoal`}>
          {t(language, 'rateLimited')}
        </div>
      );
    case 'unavailable':
      return (
        <div role="alert" className={problem}>
          {t(language, 'unavailable')}
        </div>
      );
    case 'session_expired':
      return (
        <div role="alert" className={problem}>
          {t(language, 'sessionExpired')}
        </div>
      );
  }
}

function HeaderButton({ label, onClick, children }: { label: string; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-slate hover:bg-light-gray hover:text-charcoal"
    >
      {children}
    </button>
  );
}

function ResetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10a6 6 0 1 0 1.76-4.24" />
      <path d="M4 4v3.5h3.5" />
    </svg>
  );
}

/** Non-modal floating panel (spec §7.2): no overlay, no scroll lock; Escape minimizes. */
export function HelpPanel() {
  const help = useHelp();
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    composerRef.current?.focus();
  }, []);

  if (!help) return null;
  const { state, language } = help;
  const hasAnswer = state.messages.some((m) => m.role === 'assistant' && m.status !== 'streaming');

  return (
    <section
      id={HELP_PANEL_ID}
      role="dialog"
      aria-modal="false"
      aria-label={t(language, 'title')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          help.minimize();
        }
      }}
      className="fixed inset-x-0 bottom-0 z-40 flex h-[80vh] flex-col border-t border-slate/15 bg-white shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[min(640px,80vh)] sm:w-[400px] sm:rounded-xl sm:border"
    >
      <header className="flex items-center gap-1 border-b border-slate/15 px-3 py-2">
        <h2 className="flex-1 truncate font-[family-name:var(--font-display)] text-sm font-semibold text-navy">{t(language, 'title')}</h2>
        <select
          aria-label={t(language, 'language')}
          value={language}
          onChange={(e) => {
            if (isHelpLanguage(e.target.value)) help.setLanguage(e.target.value);
          }}
          className="rounded border border-slate/20 bg-white px-1.5 py-1 text-xs text-charcoal"
        >
          {HELP_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {HELP_LANGUAGE_LABELS[l]}
            </option>
          ))}
        </select>
        <HeaderButton label={t(language, 'reset')} onClick={help.reset}>
          <ResetIcon />
        </HeaderButton>
        <HeaderButton label={t(language, 'minimize')} onClick={help.minimize}>
          <span aria-hidden="true" className="text-base leading-none">
            –
          </span>
        </HeaderButton>
        <HeaderButton label={t(language, 'close')} onClick={help.close}>
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </HeaderButton>
      </header>
      {state.notice && <NoticeBanner notice={state.notice} language={language} />}
      <HelpMessages messages={state.messages} language={language} onRetry={help.retry} onFeedback={help.feedback} onSummarize={help.summarize} />
      <HelpComposer ref={composerRef} language={language} streaming={help.streaming} onSend={help.send} onStop={help.stop} />
      <HelpFooter
        language={language}
        pack={state.pack}
        canSummarize={state.conversationId !== null && hasAnswer}
        summary={help.summary}
        onSummarize={help.summarize}
      />
      <div aria-live="polite" className="sr-only" data-testid="help-live">
        {help.announcement}
      </div>
    </section>
  );
}
