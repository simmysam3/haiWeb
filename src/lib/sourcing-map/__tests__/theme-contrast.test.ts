import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SM_THEME_TOKENS, SM_PILL_TONES, SM_PILL_TOKENS, SM_HEADER, SM_BUTTON_PRIMARY_FG, smThemeStyle } from '../theme';

// The WCAG 2.1 instrument lives here: nothing in production calls it.
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const hundredths = (r: number) => Math.round(r * 100);

const SURFACES = ['canvas', 'surface', 'card'] as const;
const TEXT = ['ink', 'ink-2', 'teal-text', 'orange-text', 'red-text', 'success-text', 'warn-text'] as const;
const NONTEXT = ['heat-good', 'heat-mid', 'heat-bad', 'gap-border'] as const;

// The focus ring's token, read from the stylesheet itself (`.sm-root :focus-visible { outline: … var(--sm-<token>) }`).
const SM_CSS = readFileSync(join(__dirname, '..', '..', '..', 'app', 'sourcing-map', 'sourcing-map.css'), 'utf8');
const FOCUS_RING = /:focus-visible\s*\{[^}]*outline:[^;}]*var\(--sm-([a-z0-9-]+)\)/.exec(SM_CSS)?.[1];

describe('Sourcing Map theme contrast (spec §9.1, WCAG 2.1 AA)', () => {
  it('the instrument reproduces the contract §2 measurements, in hundredths (present control)', () => {
    expect(hundredths(contrastRatio('#FFFFFF', '#000000'))).toBe(2100);
    expect(hundredths(contrastRatio('#DC2626', '#212846'))).toBe(299);
    expect(hundredths(contrastRatio('#F87171', '#10132A'))).toBe(661);
    expect(hundredths(contrastRatio('#007585', '#FFFFFF'))).toBe(541);
  });

  it('every token pair passes AA in both themes (text and pill tints 4.5:1, non-text 3:1), and the spec hex values are verbatim', () => {
    const failures: string[] = [];
    const check = (label: string, fg: string, bg: string, min: number) => {
      const r = contrastRatio(fg, bg);
      if (r < min) failures.push(`${label} = ${r.toFixed(2)}`);
    };
    // Present control: the stylesheet's :focus-visible outline names a theme token; a missing or renamed rule fails here.
    expect(Object.keys(SM_THEME_TOKENS.dark)).toContain(FOCUS_RING);
    for (const theme of ['dark', 'light'] as const) {
      const t = SM_THEME_TOKENS[theme];
      for (const fg of TEXT) for (const bg of SURFACES) check(`${theme} ${fg} on ${bg}`, t[fg], t[bg], 4.5);
      check(`${theme} primary button`, SM_BUTTON_PRIMARY_FG, t.teal, 4.5);
      for (const tone of SM_PILL_TONES) check(`${theme} pill ${tone}`, SM_PILL_TOKENS[theme][tone].fg, SM_PILL_TOKENS[theme][tone].bg, 4.5);
      // WCAG 1.4.11: heat and the gap border are non-text, on the canvas and on cards.
      for (const fg of NONTEXT) for (const bg of ['canvas', 'card'] as const) check(`${theme} ${fg} on ${bg}`, t[fg], t[bg], 3);
      // WCAG 1.4.11: the focus ring is non-text, on every surface, in the token sourcing-map.css actually uses.
      for (const bg of SURFACES) check(`${theme} focus ring --sm-${FOCUS_RING} on ${bg}`, t[FOCUS_RING as keyof typeof t], t[bg], 3);
    }
    for (const fg of [SM_HEADER.ink, SM_HEADER.ink2]) check(`header ${fg}`, fg, SM_HEADER.bg, 4.5);
    expect(failures).toEqual([]);
    // Spec §9.1 verbatim, and red text on dark = #F87171 (contract §2).
    expect(SM_THEME_TOKENS.dark).toMatchObject({
      canvas: '#10132A', surface: '#1A1F36', card: '#212846', line: '#2B3252', 'line-2': '#34405F',
      ink: '#E8EBF0', 'ink-2': '#B9C2CC', teal: '#29B0C3', 'teal-text': '#7FD3DF', orange: '#F58220',
      'orange-text': '#F7A25A', red: '#DC2626', 'red-text': '#F87171',
    });
    expect(SM_THEME_TOKENS.light['teal-text']).toBe('#007585');
  });

  it('the header background is exactly the dark surface token (Task 18 ruling): the dark text rows on surface above are the header contrast checks', () => {
    expect(SM_HEADER.bg).toBe(SM_THEME_TOKENS.dark.surface);
  });

  it('smThemeStyle emits every token, pill tone and header value as --sm-* custom properties', () => {
    const dark = smThemeStyle('dark');
    expect(dark['--sm-canvas']).toBe('#10132A');
    expect(dark['--sm-red-text']).toBe('#F87171');
    expect(dark['--sm-pill-problem-bg']).toBe('#3F1D29');
    expect(dark['--sm-header-bg']).toBe('#1A1F36');
    expect(smThemeStyle('light')['--sm-canvas']).toBe('#ECF0F4');
    for (const tone of SM_PILL_TONES) {
      expect(dark[`--sm-pill-${tone}-fg`]).toBeTruthy();
      expect(smThemeStyle('light')[`--sm-pill-${tone}-bg`]).toBeTruthy();
    }
  });
});
