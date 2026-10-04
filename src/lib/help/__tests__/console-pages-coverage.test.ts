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

/**
 * Every app route, spelled as its folder path: one per page.tsx under src/app.
 * The app has no (group), _private or @slot folder today; a page under one would be listed by its folder path.
 */
function appRoutes(): string[] {
  const base = join(ROOT, 'src/app');
  return (readdirSync(base, { recursive: true }) as string[])
    .filter((p) => p.split(sep).pop() === 'page.tsx')
    .map((p) => (dirname(p) === '.' ? '/' : `/${dirname(p).split(sep).join('/')}`))
    .sort();
}

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

  // Pins added by the Task 1.7 review (plan C.5). haiCore matches a page's route against the `## /route`
  // headings and takes the lines under the matching heading as that page's entry, so a duplicate heading, a
  // route that is not spelled as the app spells it, or a stray line would reach a customer's answer unnoticed.

  it('gives every page entry Page, For, You can and Where, then at most one Related, each with a value, and no other line', () => {
    const allowed = ['Page | For | You can | Where', 'Page | For | You can | Where | Related'];
    const wrong: string[] = [];
    for (const [route, body] of pageSections(read())) {
      const fields = body
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => /^\*\*([^*]+):\*\* \S/.exec(line)?.[1] ?? `(not a field) ${line.slice(0, 60)}`)
        .join(' | ');
      if (!allowed.includes(fields)) wrong.push(`${route}: ${fields}`);
    }
    expect(wrong).toEqual([]);
  });

  it('has each page heading once, with nothing after the route', () => {
    const md = read();
    const headings = pageHeadings(md);
    expect(headings.filter((h, i) => headings.indexOf(h) !== i)).toEqual([]);
    expect([...pageSections(md).keys()]).toEqual(headings);
  });

  it('spells every page heading exactly as an app route', () => {
    const routes = new Set(appRoutes());
    expect(pageHeadings(read()).filter((h) => !routes.has(h))).toEqual([]);
  });

  it('has no level-2 heading other than the page routes and Glossary', () => {
    const md = read();
    const pages = new Set(pageHeadings(md));
    const others = [...md.matchAll(/^## (.*)$/gm)]
      .map((m) => (m[1] as string).trim())
      .filter((h) => h !== 'Glossary' && !pages.has(h));
    expect(others).toEqual([]);
  });

  it('points every **Related:** line at page headings of this file', () => {
    const md = read();
    const pages = new Set(pageHeadings(md));
    const dangling: string[] = [];
    for (const [route, body] of pageSections(md)) {
      for (const line of body.split('\n').filter((l) => l.startsWith('**Related:**'))) {
        for (const target of line.slice('**Related:**'.length).split(',')) {
          if (!pages.has(target.trim())) dangling.push(`${route} -> ${target.trim()}`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it('requires the nav pages and the Sourcing Map sub-pages, so the coverage check is not vacuous', () => {
    const routes = new Set(required());
    const expected = ['/account/agents', '/sourcing-map/[projectId]/runs/[templateId]'];
    expect(expected.filter((route) => !routes.has(route))).toEqual([]);
  });

  it('defines each glossary term once', () => {
    const md = read();
    const terms = md
      .slice(md.indexOf('## Glossary'))
      .split('\n')
      .map((line) => /^\*\*([^*]+)\*\* — /.exec(line)?.[1])
      .filter((term): term is string => term !== undefined);
    expect(terms.filter((term, i) => terms.indexOf(term) !== i)).toEqual([]);
  });
});
