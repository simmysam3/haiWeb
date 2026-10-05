// src/components/help/help-messages.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { HELP_FEEDBACK_NOTE_MAX_CHARS, type HelpLanguage } from '@haiwave/protocol';
import { t } from './strings';
import type { HelpUiMessage } from './help-storage';
import { HelpMarkdown } from './help-markdown';

interface HelpMessagesProps {
  messages: HelpUiMessage[];
  language: HelpLanguage;
  onRetry(assistantId: string): void;
  onFeedback(message: HelpUiMessage, rating: 'up' | 'down', note?: string): void;
  onSummarize(): void;
}

export function HelpMessages({ messages, language, onRetry, onFeedback, onSummarize }: HelpMessagesProps) {
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    // jsdom has no scrollIntoView; browsers do.
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages]);

  if (messages.length === 0) {
    return <div className="flex-1 overflow-y-auto px-4 py-3 text-sm text-slate">{t(language, 'intro')}</div>;
  }

  return (
    <ol className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {messages.map((m) => (
        <li key={m.id}>
          {m.role === 'user' ? (
            <UserMessage message={m} language={language} />
          ) : (
            <AssistantMessage message={m} language={language} onRetry={onRetry} onFeedback={onFeedback} onSummarize={onSummarize} />
          )}
        </li>
      ))}
      <li ref={endRef} aria-hidden="true" />
    </ol>
  );
}

function UserMessage({ message, language }: { message: HelpUiMessage; language: HelpLanguage }) {
  return (
    <div className="ml-8 rounded-lg bg-navy px-3 py-2 text-sm text-white">
      <p className="whitespace-pre-wrap break-words">{message.text}</p>
      {message.redactionCount ? (
        <p className="mt-1 text-[11px] text-light-slate">{t(language, 'masked', { count: message.redactionCount })}</p>
      ) : null}
    </div>
  );
}

function RetryButton({ language, onClick }: { language: HelpLanguage; onClick(): void }) {
  return (
    <button type="button" onClick={onClick} className="mt-1 text-xs font-medium text-teal-dark hover:underline">
      {t(language, 'retry')}
    </button>
  );
}

function AssistantMessage({
  message,
  language,
  onRetry,
  onFeedback,
  onSummarize,
}: {
  message: HelpUiMessage;
  language: HelpLanguage;
  onRetry(assistantId: string): void;
  onFeedback(message: HelpUiMessage, rating: 'up' | 'down', note?: string): void;
  onSummarize(): void;
}) {
  const markdown = (text: string) => <HelpMarkdown text={text} copyLabel={t(language, 'copy')} copiedLabel={t(language, 'copied')} />;
  return (
    <div className="mr-4 rounded-lg border border-slate/15 bg-light-gray/40 px-3 py-2">
      {message.status === 'streaming' &&
        (message.text === '' ? <p className="text-sm text-slate">{t(language, 'thinking')}</p> : markdown(message.text))}
      {message.status === 'complete' && markdown(message.text)}
      {message.status === 'withheld' && (
        <>
          <p className="text-sm text-charcoal">{t(language, 'withheld')}</p>
          <button type="button" onClick={onSummarize} className="mt-1 text-xs font-medium text-teal-dark hover:underline">
            {t(language, 'summarize')}
          </button>
        </>
      )}
      {message.status === 'error' && (
        <>
          {message.text !== '' && markdown(message.text)}
          <p className="text-sm text-problem">{t(language, 'error')}</p>
          <RetryButton language={language} onClick={() => onRetry(message.id)} />
        </>
      )}
      {message.status === 'interrupted' && (
        <>
          {message.text !== '' && markdown(message.text)}
          <p className="text-sm text-slate">{t(language, 'interrupted')}</p>
          <RetryButton language={language} onClick={() => onRetry(message.id)} />
        </>
      )}
      {message.status === 'complete' && message.serverId && (
        <FeedbackControls message={message} language={language} onFeedback={onFeedback} />
      )}
    </div>
  );
}

function FeedbackControls({
  message,
  language,
  onFeedback,
}: {
  message: HelpUiMessage;
  language: HelpLanguage;
  onFeedback(message: HelpUiMessage, rating: 'up' | 'down', note?: string): void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const thumb = 'rounded px-1.5 py-0.5 text-sm hover:bg-light-gray aria-pressed:bg-light-gray';

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        <button
          type="button"
          aria-label={t(language, 'helpful')}
          aria-pressed={message.feedback === 'up'}
          onClick={() => {
            setNoteOpen(false);
            onFeedback(message, 'up');
          }}
          className={thumb}
        >
          <span aria-hidden="true">👍</span>
        </button>
        <button
          type="button"
          aria-label={t(language, 'notHelpful')}
          aria-pressed={message.feedback === 'down'}
          onClick={() => {
            setNoteOpen(true);
            onFeedback(message, 'down');
          }}
          className={thumb}
        >
          <span aria-hidden="true">👎</span>
        </button>
      </div>
      {noteOpen && !sent && (
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = note.trim();
            onFeedback(message, 'down', trimmed === '' ? undefined : trimmed);
            setSent(true);
          }}
        >
          <textarea
            aria-label={t(language, 'feedbackNote')}
            placeholder={t(language, 'feedbackNote')}
            value={note}
            maxLength={HELP_FEEDBACK_NOTE_MAX_CHARS}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            className="w-full resize-none rounded border border-slate/20 px-2 py-1 text-xs text-charcoal focus:border-teal focus:outline-none"
          />
          <button type="submit" className="rounded border border-slate/20 bg-white px-2 py-0.5 text-[11px] text-charcoal hover:border-teal">
            {t(language, 'feedbackSend')}
          </button>
        </form>
      )}
      {sent && <p className="text-[11px] text-slate">{t(language, 'feedbackThanks')}</p>}
    </div>
  );
}
