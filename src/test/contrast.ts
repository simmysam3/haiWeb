// Test-only WCAG 2.x contrast instrument for the console's brand tokens; nothing under src/ outside tests imports it.
//
// Its limits. It reads class names, not rendered pixels:
// - it sees only a `text-<token>` or `bg-<token>` class that is exactly a brand token of globals.css;
// - a colour class that is not a brand token (for example a Tailwind default such as `text-red-900`) is skipped,
//   and the walk then reports an ancestor's token;
// - on one element the first matching class in the class list wins;
// - variant classes (`hover:`, `focus:`), opacity, inline styles and any colour set outside the class list are not seen.
// So a pin proves the tokens a component asks for; a real-browser check (axe on the page) is the proof of what a user sees.
//
// The Sourcing Map reader (smTextColor, smGroundColor, smRatioOn, smWorstRatio) has the same limits, with two differences:
// - it never skips a colour it does not know: a `text-` or `bg-` class that is no `.sm-*` class, no brand token and no size or
//   alignment throws `unknown colour class` (a Tailwind default colour and a translucent ground included), and a walk that
//   reaches the root without a match throws `no text colour` / `no ground`;
// - it reads only a `.sm-*` rule whose selector is ONE class, so a `.sm-table` header cell is read as its ancestor's ink,
//   not the `ink-2` its descendant rule `.sm-table th` gives it. A pin on such a cell passes, and its mutant still reds.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SM_THEME_TOKENS } from '@/lib/sourcing-map/theme';

// The brand tokens, read once from the stylesheet itself: `--color-<name>: #RRGGBB;`.
const GLOBALS_CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
const TOKENS = new Map<string, string>(
  [...GLOBALS_CSS.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map((m) => [m[1], m[2]] as [string, string]),
);

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
export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function consoleColor(token: string): string {
  const hex = TOKENS.get(token);
  if (!hex) throw new Error(`no --color-${token} token in globals.css`);
  return hex;
}
// Nearest self-or-ancestor class that is EXACTLY `<prefix><token>` for a globals.css token.
function resolveToken(el: Element, prefix: string, missing: string): string {
  for (let node: Element | null = el; node; node = node.parentElement) {
    for (const cls of node.classList) {
      if (!cls.startsWith(prefix)) continue;
      const token = cls.slice(prefix.length);
      if (TOKENS.has(token)) return token;
      const slash = token.lastIndexOf('/');
      if (slash > 0 && TOKENS.has(token.slice(0, slash))) {
        throw new Error(`translucent ${cls}: compute it by hand`);
      }
    }
  }
  throw new Error(missing);
}
export function textToken(el: Element): string {
  return resolveToken(el, 'text-', 'no text token');
}
export function groundToken(el: Element): string {
  return resolveToken(el, 'bg-', 'no ground');
}
export function ratioOn(el: Element): number {
  return contrastRatio(consoleColor(textToken(el)), consoleColor(groundToken(el)));
}

// The Sourcing Map's reader. `sourcing-map.css` is read once: a rule whose selector is ONE class gives that class its
// `color: var(--sm-<t>)` (text) or `background: var(--sm-<t>)` (ground); the walk takes the nearest self-or-ancestor class.
const SM_CSS = readFileSync(join(__dirname, '..', 'app', 'sourcing-map', 'sourcing-map.css'), 'utf8');
function smClassMap(property: string): Map<string, string> {
  const re = new RegExp(`^\\.(sm-[a-z0-9-]+)\\s*\\{[^}]*?(?:^|[\\s;{])${property}:\\s*var\\(--sm-([a-z0-9-]+)\\)`, 'gm');
  return new Map([...SM_CSS.matchAll(re)].map((m) => [m[1], m[2]] as [string, string]));
}
const SM_TEXT = smClassMap('color');
const SM_GROUND = smClassMap('background');

// A `text-` class that is a size or an alignment carries no colour.
const TEXT_LAYOUT = /^text-(?:xs|sm|base|lg|[2-9]?xl|left|center|right|\[\d+px\])$/;

export type SmThemeName = 'dark' | 'light';
function smResolve(el: Element, theme: SmThemeName, map: Map<string, string>, prefix: string): string | undefined {
  for (let node: Element | null = el; node; node = node.parentElement) {
    for (const cls of node.classList) {
      const t = map.get(cls);
      if (t) {
        if (!(t in SM_THEME_TOKENS[theme])) throw new Error(`${cls}: --sm-${t} is not a theme token`);
        return SM_THEME_TOKENS[theme][t as keyof (typeof SM_THEME_TOKENS)['dark']];
      }
      const brand = cls.startsWith(prefix) ? TOKENS.get(cls.slice(prefix.length)) : undefined;
      if (brand) return brand;
      if (cls.startsWith(prefix) && !TEXT_LAYOUT.test(cls)) throw new Error(`unknown colour class ${cls}`);
    }
  }
  return undefined;
}
export function smTextColor(el: Element, theme: SmThemeName): string {
  const hex = smResolve(el, theme, SM_TEXT, 'text-');
  if (!hex) throw new Error('no text colour');
  return hex;
}
export function smGroundColor(el: Element, theme: SmThemeName): string {
  const hex = smResolve(el, theme, SM_GROUND, 'bg-');
  if (!hex) throw new Error('no ground');
  return hex;
}
export function smRatioOn(el: Element, theme: SmThemeName): number {
  return contrastRatio(smTextColor(el, theme), smGroundColor(el, theme));
}
export function smWorstRatio(el: Element): number {
  return Math.min(smRatioOn(el, 'dark'), smRatioOn(el, 'light'));
}
