// src/components/help/__tests__/strings.test.ts
import { describe, it, expect } from 'vitest';
import { HELP_LANGUAGES } from '@haiwave/protocol';
import {
  HELP_STRINGS,
  HELP_STRING_KEYS,
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

  it('really translates: the title differs from English in es, ko and pt-BR', () => {
    expect(HELP_STRINGS.es.title).not.toBe(HELP_STRINGS.en.title);
    expect(HELP_STRINGS.ko.title).not.toBe(HELP_STRINGS.en.title);
    expect(HELP_STRINGS['pt-BR'].title).not.toBe(HELP_STRINGS.en.title);
  });

  it('t() fills placeholders and leaves unknown ones untouched', () => {
    expect(t('en', 'footerEdition', { edition: '1.7', date: '2026-10-07' })).toBe('Guide 1.7 · help pack 2026-10-07');
    expect(t('en', 'masked', { count: 2 })).toBe('Secrets masked before sending: 2');
    expect(t('en', 'contact')).toBe('Contact {contact}');
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
});

describe('isHelpLanguage', () => {
  it('accepts exactly the four codes', () => {
    expect(['en', 'es', 'ko', 'pt-BR'].every(isHelpLanguage)).toBe(true);
    expect(isHelpLanguage('pt')).toBe(false);
    expect(isHelpLanguage('fr')).toBe(false);
    expect(isHelpLanguage(null)).toBe(false);
  });
});
