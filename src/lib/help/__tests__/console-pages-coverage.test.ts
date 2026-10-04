// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { navSections } from '@/components/account-nav';

const ROOT = process.cwd();
const FILE = join(ROOT, 'design/help/console-pages.md');
const read = () => readFileSync(FILE, 'utf8');

/** `## /route` headings, in order. */
function pageHeadings(md: string): string[] {
  return [...md.matchAll(/^## (\/\S*)\s*$/gm)].map((m) => m[1] as string);
}

/** Each page section's text, keyed by its heading. */
function pageSections(md: string): Map<string, string> {
  const out = new Map<string, string>();
  const parts = md.split(/^## /m).slice(1);
  for (const part of parts) {
    const [heading, ...rest] = part.split('\n');
    if (heading?.startsWith('/')) out.set(heading.trim(), rest.join('\n'));
  }
  return out;
}

function sourcingMapRoutes(): string[] {
  const base = join(ROOT, 'src/app/sourcing-map');
  return (readdirSync(base, { recursive: true }) as string[])
    .filter((p) => p.split(sep).pop() === 'page.tsx')
    .map((p) => (dirname(p) === '.' ? '/sourcing-map' : `/sourcing-map/${dirname(p).split(sep).join('/')}`))
    .sort();
}

const required = (): string[] =>
  [...new Set([...navSections.flatMap((s) => s.items.map((i) => i.href)), ...sourcingMapRoutes()])].sort();

describe('design/help/console-pages.md (DESIGN-2026-10-03 §5.2, D10; plan C.5)', () => {
  it('exists', () => {
    expect(existsSync(FILE)).toBe(true);
  });

  it('has a heading for every nav href and every Sourcing Map page', () => {
    const headings = new Set(pageHeadings(read()));
    expect(required().filter((route) => !headings.has(route))).toEqual([]);
  });

  it('names no route that has no page.tsx', () => {
    const orphans = pageHeadings(read()).filter((h) => !existsSync(join(ROOT, 'src/app', ...h.split('/').filter(Boolean), 'page.tsx')));
    expect(orphans).toEqual([]);
  });

  it('gives every page entry the four required fields', () => {
    const missing: string[] = [];
    for (const [route, body] of pageSections(read())) {
      for (const field of ['**Page:**', '**For:**', '**You can:**', '**Where:**']) {
        if (!body.split('\n').some((line) => line.startsWith(field))) missing.push(`${route} ${field}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('ends with exactly one Glossary section of **Term** — definition lines', () => {
    const md = read();
    const headings = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings.filter((h) => h === 'Glossary')).toHaveLength(1);
    expect(headings[headings.length - 1]).toBe('Glossary');
    const glossary = md.slice(md.indexOf('## Glossary') + '## Glossary'.length).split('\n').filter((l) => l.trim() !== '');
    expect(glossary.length).toBeGreaterThan(0);
    expect(glossary.filter((l) => !/^\*\*[^*]+\*\* — \S/.test(l))).toEqual([]);
  });
});
