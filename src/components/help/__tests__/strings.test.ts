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
