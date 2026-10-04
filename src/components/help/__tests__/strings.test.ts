// src/components/help/__tests__/strings.test.ts
import { describe, it, expect } from 'vitest';
import { HELP_LANGUAGES } from '@haiwave/protocol';
import {
  HELP_STRINGS,
  HELP_STRING_KEYS,
  type HelpStringKey,
  HELP_LANGUAGE_LABELS,
  t,
  resolveDefaultLanguage,
  isHelpLanguage,
  DEFAULT_SUPPORT_CONTACT,
} from '../strings';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('help panel strings', () => {
  it('has every key, non-empty, in every language', () => {
    for (const lang of HELP_LANGUAGES) {
      for (const key of HELP_STRING_KEYS) {
        expect(HELP_STRINGS[lang][key], `${lang}.${key}`).toEqual(expect.any(String));
        expect(HELP_STRINGS[lang][key].trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
      expect(Object.keys(HELP_STRINGS[lang]).sort()).toEqual([...HELP_STRING_KEYS].sort());
    }
  });

  it('keeps exactly the English {placeholders} in every translation', () => {
    for (const lang of HELP_LANGUAGES) {
      for (const key of HELP_STRING_KEYS) {
        expect(placeholders(HELP_STRINGS[lang][key]), `${lang}.${key}`).toEqual(placeholders(HELP_STRINGS.en[key]));
      }
    }
  });

  it('carries placeholders in exactly five templates', () => {
    const expected: Partial<Record<HelpStringKey, string[]>> = {
      charCount: ['count', 'max'],
      masked: ['count'],
      summaryIntro: ['contact'],
      footerEdition: ['date', 'edition'],
      contact: ['contact'],
    };
    for (const key of HELP_STRING_KEYS) {
      expect(placeholders(HELP_STRINGS.en[key]), key).toEqual(expected[key] ?? []);
    }
  });

  it('really translates: the title differs from English in es, ko and pt-BR', () => {
    expect(HELP_STRINGS.es.title).not.toBe(HELP_STRINGS.en.title);
    expect(HELP_STRINGS.ko.title).not.toBe(HELP_STRINGS.en.title);
    expect(HELP_STRINGS['pt-BR'].title).not.toBe(HELP_STRINGS.en.title);
  });

  it('gives each language its own title, the English one being the product name', () => {
    expect(HELP_LANGUAGES.map((l) => [l, HELP_STRINGS[l].title])).toEqual([
      ['en', 'HAIWAVE Help'],
      ['es', 'Ayuda de HAIWAVE'],
      ['ko', 'HAIWAVE 도움말'],
      ['pt-BR', 'Ajuda HAIWAVE'],
    ]);
  });

  it('leaves no string but the character counter in English in es, ko and pt-BR', () => {
    for (const lang of ['es', 'ko', 'pt-BR'] as const) {
      for (const key of HELP_STRING_KEYS) {
        if (key === 'charCount') continue; // '{count} / {max}' holds no words
        expect(HELP_STRINGS[lang][key], `${lang}.${key}`).not.toBe(HELP_STRINGS.en[key]);
      }
    }
  });

  it('says that the session ended in each language (Review Focus 4)', () => {
    expect(HELP_LANGUAGES.map((l) => HELP_STRINGS[l].sessionExpired)).toEqual([
      'Your session ended — reload the page to sign in.',
      'Su sesión terminó; recargue la página para iniciar sesión.',
      '세션이 종료되었습니다. 페이지를 새로 고쳐 로그인하세요.',
      'Sua sessão terminou — recarregue a página para entrar.',
    ]);
  });

  it('keeps the English withheld and interrupted texts (Review Focus 3 and 5)', () => {
    expect(HELP_STRINGS.en.withheld).toBe("I can't help with that one.");
    expect(HELP_STRINGS.en.interrupted).toBe('Interrupted — ask again.');
  });

  it('t() fills placeholders and leaves unknown ones untouched', () => {
    expect(t('en', 'footerEdition', { edition: '1.7', date: '2026-10-07' })).toBe('Guide 1.7 · help pack 2026-10-07');
    expect(t('en', 'masked', { count: 2 })).toBe('Secrets masked before sending: 2');
    expect(t('en', 'contact')).toBe('Contact {contact}');
  });

  it('t() reads the dictionary of the language it is given', () => {
    expect(t('es', 'footerEdition', { edition: '1.7', date: '2026-10-07' })).toBe('Guía 1.7 · paquete de ayuda 2026-10-07');
    expect(t('ko', 'masked', { count: 3 })).toBe('전송 전에 가려진 비밀 값: 3개');
    expect(t('pt-BR', 'retry')).toBe('Tentar novamente');
  });

  it('t() fills a zero and an empty string', () => {
    expect(t('en', 'charCount', { count: 0, max: 16000 })).toBe('0 / 16000');
    expect(t('en', 'contact', { contact: '' })).toBe('Contact ');
  });

  it('t() fills the vars it has and leaves the one it lacks', () => {
    expect(t('en', 'footerEdition', { edition: '1.7' })).toBe('Guide 1.7 · help pack {date}');
  });

  it('t() inserts a value as it is: no $ pattern, no second pass', () => {
    expect(t('en', 'contact', { contact: '$&-$1' })).toBe('Contact $&-$1');
    expect(t('en', 'footerEdition', { edition: '{date}', date: 'X' })).toBe('Guide {date} · help pack X');
  });

  it('labels each language in its own name', () => {
    expect(HELP_LANGUAGE_LABELS).toEqual({ en: 'English', es: 'Español', ko: '한국어', 'pt-BR': 'Português (Brasil)' });
  });

  it('exposes the default support contact', () => {
    expect(DEFAULT_SUPPORT_CONTACT).toBe('support@haiwave.ai');
  });
});

// The texts themselves, as the plan's listing for Task 3.1 has them. The checks above are structural: they still pass
// with two labels swapped (Helpful / Not helpful, Minimize / Close, Send / Stop: the names a screen reader gives the
// buttons), with one language's text under another's code, or with a changed fact (the hour the daily limit resets).
describe('help panel strings, each dictionary as written', () => {
  it('holds the English text of every string, word for word', () => {
    expect(HELP_STRINGS.en).toEqual({
      title: 'HAIWAVE Help',
      openHelp: 'Help',
      newAnswer: 'new answer',
      language: 'Language',
      reset: 'Start a new conversation',
      minimize: 'Minimize',
      close: 'Close and clear this conversation',
      intro: 'Ask where to find something in the console, what a term means, or how to get your agent deployed and running.',
      placeholder: 'Ask a question or paste an error…',
      messageLabel: 'Message',
      send: 'Send',
      stop: 'Stop',
      charCount: '{count} / {max}',
      masked: 'Secrets masked before sending: {count}',
      thinking: 'Thinking…',
      helpful: 'Helpful',
      notHelpful: 'Not helpful',
      feedbackNote: 'What was wrong? (optional)',
      feedbackSend: 'Send feedback',
      feedbackThanks: 'Thanks for the feedback.',
      copy: 'Copy',
      copied: 'Copied',
      summarize: 'Summarize for support',
      summaryIntro: 'Copy this summary and send it to {contact}.',
      summaryFailed: "Couldn't create the summary — try again.",
      footerEdition: 'Guide {edition} · help pack {date}',
      mismatch: 'Help may be ahead of or behind the guide you downloaded.',
      budget: 'Daily help limit reached; resets 00:00 UTC.',
      contact: 'Contact {contact}',
      rateLimited: 'One moment…',
      unavailable: 'Help is temporarily unavailable.',
      withheld: "I can't help with that one.",
      error: 'Something went wrong — try again.',
      interrupted: 'Interrupted — ask again.',
      retry: 'Retry',
      sessionExpired: 'Your session ended — reload the page to sign in.',
    });
  });

  it('holds the Spanish text of every string, word for word', () => {
    expect(HELP_STRINGS.es).toEqual({
      title: 'Ayuda de HAIWAVE',
      openHelp: 'Ayuda',
      newAnswer: 'respuesta nueva',
      language: 'Idioma',
      reset: 'Iniciar una conversación nueva',
      minimize: 'Minimizar',
      close: 'Cerrar y borrar esta conversación',
      intro: 'Pregunte dónde encontrar algo en la consola, qué significa un término o cómo implementar y poner en marcha su agente.',
      placeholder: 'Haga una pregunta o pegue un error…',
      messageLabel: 'Mensaje',
      send: 'Enviar',
      stop: 'Detener',
      charCount: '{count} / {max}',
      masked: 'Secretos ocultados antes de enviar: {count}',
      thinking: 'Pensando…',
      helpful: 'Útil',
      notHelpful: 'No fue útil',
      feedbackNote: '¿Qué estuvo mal? (opcional)',
      feedbackSend: 'Enviar comentarios',
      feedbackThanks: 'Gracias por sus comentarios.',
      copy: 'Copiar',
      copied: 'Copiado',
      summarize: 'Resumir para soporte',
      summaryIntro: 'Copie este resumen y envíelo a {contact}.',
      summaryFailed: 'No se pudo crear el resumen; inténtelo de nuevo.',
      footerEdition: 'Guía {edition} · paquete de ayuda {date}',
      mismatch: 'La ayuda puede estar más adelantada o más atrasada que la guía que descargó.',
      budget: 'Se alcanzó el límite diario de ayuda; se restablece a las 00:00 UTC.',
      contact: 'Escriba a {contact}',
      rateLimited: 'Un momento…',
      unavailable: 'La ayuda no está disponible temporalmente.',
      withheld: 'No puedo ayudarle con eso.',
      error: 'Algo salió mal; inténtelo de nuevo.',
      interrupted: 'Interrumpido; vuelva a preguntar.',
      retry: 'Reintentar',
      sessionExpired: 'Su sesión terminó; recargue la página para iniciar sesión.',
    });
  });

  it('holds the Korean text of every string, word for word', () => {
    expect(HELP_STRINGS.ko).toEqual({
      title: 'HAIWAVE 도움말',
      openHelp: '도움말',
      newAnswer: '새 답변',
      language: '언어',
      reset: '새 대화 시작',
      minimize: '최소화',
      close: '닫고 이 대화 지우기',
      intro: '콘솔에서 무언가를 찾을 위치, 용어의 의미, 또는 에이전트를 배포하고 실행하는 방법을 물어보세요.',
      placeholder: '질문을 입력하거나 오류를 붙여 넣으세요…',
      messageLabel: '메시지',
      send: '보내기',
      stop: '중지',
      charCount: '{count} / {max}',
      masked: '전송 전에 가려진 비밀 값: {count}개',
      thinking: '생각 중…',
      helpful: '도움이 됨',
      notHelpful: '도움이 되지 않음',
      feedbackNote: '무엇이 잘못되었나요? (선택 사항)',
      feedbackSend: '피드백 보내기',
      feedbackThanks: '피드백을 보내 주셔서 감사합니다.',
      copy: '복사',
      copied: '복사됨',
      summarize: '지원팀용 요약',
      summaryIntro: '이 요약을 복사하여 {contact}(으)로 보내세요.',
      summaryFailed: '요약을 만들지 못했습니다. 다시 시도하세요.',
      footerEdition: '가이드 {edition} · 도움말 팩 {date}',
      mismatch: '도움말이 다운로드한 가이드보다 최신이거나 이전 버전일 수 있습니다.',
      budget: '일일 도움말 한도에 도달했습니다. 00:00 UTC에 초기화됩니다.',
      contact: '{contact}(으)로 문의하세요',
      rateLimited: '잠시만 기다려 주세요…',
      unavailable: '도움말을 일시적으로 사용할 수 없습니다.',
      withheld: '그 질문은 도와드릴 수 없습니다.',
      error: '문제가 발생했습니다. 다시 시도하세요.',
      interrupted: '중단되었습니다. 다시 질문하세요.',
      retry: '다시 시도',
      sessionExpired: '세션이 종료되었습니다. 페이지를 새로 고쳐 로그인하세요.',
    });
  });

  // Not "differs from the Spanish": eight texts are rightly the same in both (Idioma, Minimizar, Enviar, Útil, …).
  it('holds the Brazilian Portuguese text of every string, word for word', () => {
    expect(HELP_STRINGS['pt-BR']).toEqual({
      title: 'Ajuda HAIWAVE',
      openHelp: 'Ajuda',
      newAnswer: 'nova resposta',
      language: 'Idioma',
      reset: 'Iniciar uma nova conversa',
      minimize: 'Minimizar',
      close: 'Fechar e apagar esta conversa',
      intro: 'Pergunte onde encontrar algo no console, o que significa um termo ou como implantar e executar seu agente.',
      placeholder: 'Faça uma pergunta ou cole um erro…',
      messageLabel: 'Mensagem',
      send: 'Enviar',
      stop: 'Parar',
      charCount: '{count} / {max}',
      masked: 'Segredos mascarados antes do envio: {count}',
      thinking: 'Pensando…',
      helpful: 'Útil',
      notHelpful: 'Não foi útil',
      feedbackNote: 'O que estava errado? (opcional)',
      feedbackSend: 'Enviar feedback',
      feedbackThanks: 'Obrigado pelo feedback.',
      copy: 'Copiar',
      copied: 'Copiado',
      summarize: 'Resumir para o suporte',
      summaryIntro: 'Copie este resumo e envie para {contact}.',
      summaryFailed: 'Não foi possível criar o resumo — tente novamente.',
      footerEdition: 'Guia {edition} · pacote de ajuda {date}',
      mismatch: 'A ajuda pode estar mais adiantada ou mais atrasada que o guia que você baixou.',
      budget: 'Limite diário de ajuda atingido; reinicia às 00:00 UTC.',
      contact: 'Fale com {contact}',
      rateLimited: 'Um momento…',
      unavailable: 'A ajuda está temporariamente indisponível.',
      withheld: 'Não posso ajudar com isso.',
      error: 'Algo deu errado — tente novamente.',
      interrupted: 'Interrompido — pergunte novamente.',
      retry: 'Tentar novamente',
      sessionExpired: 'Sua sessão terminou — recarregue a página para entrar.',
    });
  });
});

describe('resolveDefaultLanguage', () => {
  it.each([
    [['pt-PT', 'en'], 'pt-BR'],
    [['pt-BR'], 'pt-BR'],
    [['es-MX', 'en'], 'es'],
    [['ko-KR', 'en-US'], 'ko'],
    [['en-GB', 'es'], 'en'],
    [['fr-FR', 'de-DE'], 'en'],
    [['fr-FR', 'ko'], 'ko'],
    [[], 'en'],
  ] as const)('%j → %s', (preferred, expected) => {
    expect(resolveDefaultLanguage(preferred)).toBe(expected);
  });

  // A tag is matched on its language subtag, not on its first two letters: 'kok' is Konkani, not Korean.
  it.each([
    [['kok-IN', 'es'], 'es'],
    [['esu', 'ko'], 'ko'],
    [['enm', 'es'], 'es'],
    [['ptp', 'ko'], 'ko'],
  ] as const)('does not take a longer language subtag for one of the four: %j → %s', (preferred, expected) => {
    expect(resolveDefaultLanguage(preferred)).toBe(expected);
  });

  // Only the first subtag names the language. 'ca-ES' is Catalan as written in Spain, not Spanish; 'fr-PT' is
  // French as written in Portugal, not Portuguese. ES and PT are the only regions that spell one of the four.
  it.each([
    [['ca-ES', 'ko'], 'ko'],
    [['fr-PT', 'ko'], 'ko'],
  ] as const)('does not take a region subtag for the language: %j → %s', (preferred, expected) => {
    expect(resolveDefaultLanguage(preferred)).toBe(expected);
  });

  it('reads the language of an underscore tag (pt_BR) as it does of a hyphen one', () => {
    expect(resolveDefaultLanguage(['pt_BR', 'es'])).toBe('pt-BR');
  });

  it('folds the case of a tag', () => {
    expect(resolveDefaultLanguage(['PT-br'])).toBe('pt-BR');
    expect(resolveDefaultLanguage(['KO-KR', 'es'])).toBe('ko');
    expect(resolveDefaultLanguage(['ES-mx', 'ko'])).toBe('es');
  });

  it('takes a bare language tag', () => {
    expect(resolveDefaultLanguage(['pt', 'es'])).toBe('pt-BR');
    expect(resolveDefaultLanguage(['es', 'ko'])).toBe('es');
    expect(resolveDefaultLanguage(['en', 'es'])).toBe('en');
  });

  it('does not take another language that shares a first letter', () => {
    expect(resolveDefaultLanguage(['pl-PL', 'es'])).toBe('es');
    expect(resolveDefaultLanguage(['ka-GE', 'es'])).toBe('es');
    expect(resolveDefaultLanguage(['et-EE', 'ko'])).toBe('ko');
  });

  it('reads the whole list, not only its head', () => {
    expect(resolveDefaultLanguage(['fr', 'de', 'it', 'es'])).toBe('es');
  });

  // Spec §7.3: "the first match of navigator.languages". A Portuguese tag further down the list does not win.
  it.each([
    [['es-ES', 'pt-BR'], 'es'],
    [['en-US', 'pt-PT'], 'en'],
  ] as const)('takes the first match in the list, whatever follows it: %j → %s', (preferred, expected) => {
    expect(resolveDefaultLanguage(preferred)).toBe(expected);
  });
});

describe('isHelpLanguage', () => {
  it('accepts exactly the four codes', () => {
    expect(['en', 'es', 'ko', 'pt-BR'].every(isHelpLanguage)).toBe(true);
    expect(isHelpLanguage('pt')).toBe(false);
    expect(isHelpLanguage('fr')).toBe(false);
    expect(isHelpLanguage(null)).toBe(false);
  });

  // The guard on localStorage['hw-help:lang'] (C.6): only the four codes, exactly as written.
  it('refuses another case, a region or a suffix', () => {
    for (const v of ['en-US', 'pt-BR-x', 'pt-br', 'PT-BR', 'EN']) expect(isHelpLanguage(v), JSON.stringify(v)).toBe(false);
  });

  it('refuses an empty or a padded string', () => {
    for (const v of ['', ' en', 'en ']) expect(isHelpLanguage(v), JSON.stringify(v)).toBe(false);
  });

  it('refuses the names every object inherits (toString, constructor, __proto__)', () => {
    for (const v of ['toString', 'constructor', '__proto__']) expect(isHelpLanguage(v), v).toBe(false);
  });

  it('refuses what is not a string', () => {
    expect(isHelpLanguage(undefined)).toBe(false);
    expect(isHelpLanguage(['en'])).toBe(false);
    expect(isHelpLanguage(0)).toBe(false);
    expect(isHelpLanguage({})).toBe(false);
  });
});
