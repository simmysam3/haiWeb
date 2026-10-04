// Test-only WCAG 2.x contrast instrument for the console's brand tokens; nothing under src/ outside tests imports it.
//
// Its limits. It reads class names, not rendered pixels:
// - it sees only a `text-<token>` or `bg-<token>` class that is exactly a brand token of globals.css;
// - a colour class that is not a brand token (for example a Tailwind default such as `text-red-900`) is skipped,
//   and the walk then reports an ancestor's token;
// - on one element the first matching class in the class list wins;
// - variant classes (`hover:`, `focus:`), opacity, inline styles and any colour set outside the class list are not seen.
// So a pin proves the tokens a component asks for; a real-browser check (axe on the page) is the proof of what a user sees.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
