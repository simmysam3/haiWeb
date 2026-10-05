// src/components/help/help-composer.tsx
'use client';

import { useState } from 'react';
import { HELP_MESSAGE_MAX_CHARS, type HelpLanguage } from '@haiwave/protocol';
import { t } from './strings';

interface HelpComposerProps {
  language: HelpLanguage;
  streaming: boolean;
  onSend(text: string): void;
  onStop(): void;
}

export function HelpComposer({ language, streaming, onSend, onStop }: HelpComposerProps) {
  const [text, setText] = useState('');

  const submit = () => {
    const value = text.trim();
    if (value === '' || streaming) return;
    onSend(value);
    setText('');
  };

  return (
    <form
      className="border-t border-slate/15 px-3 pb-2 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        aria-label={t(language, 'messageLabel')}
        placeholder={t(language, 'placeholder')}
        value={text}
        maxLength={HELP_MESSAGE_MAX_CHARS}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends; Shift+Enter is a new line; never send mid-IME composition
          // (Korean input commits with Enter — keyCode 229 covers Safari).
          if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
          e.preventDefault();
          submit();
        }}
        className="w-full resize-none rounded-lg border border-slate/20 px-3 py-2 text-sm text-charcoal focus:border-teal focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[11px] text-slate" data-testid="help-char-count">
          {t(language, 'charCount', { count: text.length, max: HELP_MESSAGE_MAX_CHARS })}
        </span>
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg border border-slate/20 bg-white px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-light-gray"
          >
            {t(language, 'stop')}
          </button>
        ) : (
          <button
            type="submit"
            disabled={text.trim() === ''}
            className="rounded-lg bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t(language, 'send')}
          </button>
        )}
      </div>
    </form>
  );
}
