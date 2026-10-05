// src/components/help/help-widget.tsx
'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { HelpLanguage } from '@haiwave/protocol';
import { DEFAULT_SUPPORT_CONTACT, resolveDefaultLanguage, t } from './strings';
import { clearWidgetState, loadLanguage, loadWidgetState, saveLanguage, saveWidgetState, type HelpUiMessage } from './help-storage';
import { toRoutePattern } from './route-pattern';
import { useHelpStream } from './use-help-stream';
import { helpReducer, INITIAL_HELP_STATE, rehydrate, toStored } from './help-state';
import { requestCaseSummary, sendHelpFeedback } from './help-api';
import { HELP_PANEL_ID, HelpContext, useHelp, type HelpContextValue, type HelpSummaryState } from './help-context';
import { HelpPanel } from './help-panel';

/** Spec §7.5: one automatic retry, 6 s after the rate limiter answers 429. */
export const HELP_RATE_LIMIT_RETRY_MS = 6_000;

export function HelpProvider({ enabled, ownerKey, children }: { enabled: boolean; ownerKey: string | null; children: ReactNode }) {
  // Flag off: no context, so <HelpButton/> renders nothing and no help hooks run (spec §7.1).
  if (!enabled) return <>{children}</>;
  // Keyed by the owner: another signed-in user remounts the runtime with that user's own stored state (amendment P3-7).
  return (
    <HelpRuntime key={ownerKey ?? ''} ownerKey={ownerKey}>
      {children}
    </HelpRuntime>
  );
}

// The sourcing-map theme root's idiom (theme-root.tsx): storage is browser-only, so the
// server snapshot says "not client" and the first client render after hydration flips it.
const noSubscription = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}

function HelpRuntime({ ownerKey, children }: { ownerKey: string | null; children: ReactNode }) {
  const pathname = usePathname();
  const isClient = useIsClient();
  // Lazy initial state straight from storage (no setState in an effect — react-hooks/set-state-in-effect).
  const [state, dispatch] = useReducer(helpReducer, undefined, () =>
    typeof window === 'undefined' ? INITIAL_HELP_STATE : rehydrate(loadWidgetState(ownerKey)),
  );
  const [language, setLanguageState] = useState<HelpLanguage>(() =>
    typeof window === 'undefined' ? 'en' : (loadLanguage() ?? resolveDefaultLanguage(navigator.languages)),
  );
  const [streaming, setStreaming] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [summary, setSummary] = useState<HelpSummaryState>({ status: 'idle' });
  const stream = useHelpStream();

  // Latest values for callbacks that outlive a render (stream callbacks, the retry timer).
  const stateRef = useRef(state);
  const languageRef = useRef(language);
  const pathnameRef = useRef(pathname);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRef = useRef<(text: string, autoRetry?: boolean) => Promise<void>>(async () => undefined);
  // The latest sendText call. A newer request aborts the one in flight (one help request at a time), and
  // the aborted call ends after the newer one began: only the latest may clear `streaming`.
  const latestRequest = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (state.view === 'closed' && state.messages.length === 0) clearWidgetState();
    else saveWidgetState(toStored(state), ownerKey);
  }, [state, ownerKey]);

  const cancelRetry = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  }, []);

  useEffect(() => cancelRetry, [cancelRetry]);

  const sendText = useCallback(
    async (text: string, autoRetry = false) => {
      const userId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();
      let answer = '';
      const request = ++latestRequest.current;
      dispatch({ type: 'send', userId, assistantId, text });
      setStreaming(true);
      const conversationId = stateRef.current.conversationId;
      const outcome = await stream.send(
        {
          ...(conversationId ? { conversation_id: conversationId } : {}),
          message: text,
          page_route: toRoutePattern(pathnameRef.current ?? '/'),
          language: languageRef.current,
        },
        {
          onMeta: (meta) => dispatch({ type: 'meta', userId, assistantId, meta }),
          onDelta: (chunk) => {
            answer += chunk;
            dispatch({ type: 'delta', assistantId, text: chunk });
          },
        },
      );
      if (request === latestRequest.current) setStreaming(false);

      switch (outcome.kind) {
        case 'done':
          dispatch({ type: 'done', assistantId, done: outcome.done });
          setAnnouncement(answer);
          return;
        case 'stream_error':
          dispatch({ type: 'stream_error', assistantId, code: outcome.error.code });
          return;
        case 'session_expired':
          dispatch({ type: 'failed', assistantId, notice: { kind: 'session_expired' } });
          return;
        case 'network_error':
          if (answer) dispatch({ type: 'interrupted', assistantId });
          else dispatch({ type: 'errored', assistantId });
          return;
        case 'aborted':
          dispatch({ type: 'interrupted', assistantId });
          return;
        case 'http_error':
          // HTTP error codes are haiCore's UPPER_SNAKE wire codes (master C.1); any other 429 is the
          // rate limiter (RATE_LIMIT_EXCEEDED). SSE error codes (withheld, model_error…) are separate.
          if (outcome.status === 429 && outcome.code === 'BUDGET_EXHAUSTED') {
            dispatch({
              type: 'failed',
              assistantId,
              notice: { kind: 'budget_exhausted', resetAt: outcome.resetAt, contact: outcome.contact ?? DEFAULT_SUPPORT_CONTACT },
            });
          } else if (outcome.status === 429 && !autoRetry) {
            dispatch({ type: 'remove_exchange', assistantId });
            dispatch({ type: 'notice', notice: { kind: 'rate_limited' } });
            retryTimer.current = setTimeout(() => {
              retryTimer.current = null;
              void sendRef.current(text, true);
            }, HELP_RATE_LIMIT_RETRY_MS);
          } else if (outcome.status === 429) {
            dispatch({ type: 'errored', assistantId });
            dispatch({ type: 'notice', notice: { kind: 'rate_limited' } });
          } else if (outcome.status === 404 || outcome.status === 503) {
            dispatch({ type: 'failed', assistantId, notice: { kind: 'unavailable' } });
          } else {
            dispatch({ type: 'errored', assistantId });
          }
          return;
      }
    },
    [stream],
  );

  useEffect(() => {
    sendRef.current = sendText;
  }, [sendText]);

  const send = useCallback(
    (text: string) => {
      cancelRetry();
      void sendText(text);
    },
    [cancelRetry, sendText],
  );
  const stop = useCallback(() => stream.stop(), [stream]);
  const retry = useCallback(
    (assistantId: string) => {
      const messages = stateRef.current.messages;
      const at = messages.findIndex((m) => m.id === assistantId);
      const question = at > 0 ? messages[at - 1] : undefined;
      if (!question || question.role !== 'user') return;
      cancelRetry();
      dispatch({ type: 'remove_exchange', assistantId });
      void sendText(question.text);
    },
    [cancelRetry, sendText],
  );
  const feedback = useCallback((message: HelpUiMessage, rating: 'up' | 'down', note?: string) => {
    if (!message.serverId) return;
    dispatch({ type: 'feedback', messageId: message.id, rating });
    void sendHelpFeedback(message.serverId, note ? { rating, note } : { rating });
  }, []);
  const summarize = useCallback(() => {
    const conversationId = stateRef.current.conversationId;
    if (!conversationId) return;
    setSummary({ status: 'loading' });
    void requestCaseSummary(conversationId).then((res) =>
      setSummary(res ? { status: 'ready', summary: res.summary, contact: res.contact } : { status: 'failed' }),
    );
  }, []);
  const setLanguage = useCallback((lang: HelpLanguage) => {
    setLanguageState(lang);
    saveLanguage(lang);
  }, []);
  const toggle = useCallback(() => {
    if (stateRef.current.view === 'open') dispatch({ type: 'minimize' });
    else dispatch({ type: 'open' });
  }, []);
  const minimize = useCallback(() => dispatch({ type: 'minimize' }), []);
  const endConversation = useCallback(
    (how: 'close' | 'reset') => {
      cancelRetry();
      stream.stop();
      setSummary({ status: 'idle' });
      setAnnouncement('');
      if (how === 'close') dispatch({ type: 'close' });
      else dispatch({ type: 'reset' });
    },
    [cancelRetry, stream],
  );
  const close = useCallback(() => endConversation('close'), [endConversation]);
  const reset = useCallback(() => endConversation('reset'), [endConversation]);

  // Until hydration completes, reproduce the server's markup exactly: closed, English.
  const shownState = isClient ? state : INITIAL_HELP_STATE;
  const shownLanguage: HelpLanguage = isClient ? language : 'en';

  const value = useMemo<HelpContextValue>(
    () => ({
      state: shownState,
      language: shownLanguage,
      streaming,
      announcement,
      summary,
      setLanguage,
      toggle,
      minimize,
      close,
      reset,
      send,
      stop,
      retry,
      feedback,
      summarize,
    }),
    [shownState, shownLanguage, streaming, announcement, summary, setLanguage, toggle, minimize, close, reset, send, stop, retry, feedback, summarize],
  );

  return (
    <HelpContext.Provider value={value}>
      {children}
      {shownState.view === 'open' && <HelpPanel />}
    </HelpContext.Provider>
  );
}

function HelpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8" />
      <path d="M7.75 7.5a2.25 2.25 0 1 1 3.1 2.08c-.53.22-.85.73-.85 1.3v.37" />
      <path d="M10 14.25h.01" />
    </svg>
  );
}

const BUTTON_CLASS: Record<'nav' | 'sm', string> = {
  nav: 'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate/20 text-navy transition-colors hover:border-teal hover:text-teal',
  sm: 'sm-btn sm-btn-ghost relative inline-flex items-center justify-center text-sm',
};

/** "?" entry point: AccountNav's logo strip ('nav') and SmHeader's action group ('sm'). */
export function HelpButton({ variant }: { variant: 'nav' | 'sm' }) {
  const help = useHelp();
  if (!help) return null;
  const { state, language, toggle } = help;
  const unread = state.unread && state.view !== 'open';
  const label = unread ? `${t(language, 'openHelp')} — ${t(language, 'newAnswer')}` : t(language, 'openHelp');
  return (
    <button type="button" aria-label={label} aria-expanded={state.view === 'open'} aria-controls={HELP_PANEL_ID} onClick={toggle} className={BUTTON_CLASS[variant]}>
      <HelpIcon />
      {unread && <span aria-hidden="true" data-testid="help-unread" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-orange" />}
    </button>
  );
}
