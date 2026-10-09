// @vitest-environment node
/**
 * The checks on the page guide, design/help/console-pages.md, and the notes for whoever maintains it. The notes are
 * kept here, not in the guide: the guide reaches the help model as it is, so it carries no comment.
 * - The guide is hand-maintained (DESIGN-2026-10-03 D10).
 * - One `## /route` per page; the route is a route pattern with [param] segments.
 * - Every entry has the four fields `**Page:**`, `**For:**`, `**You can:**` and `**Where:**`; `**Related:**` is optional.
 * - These tests fail when a nav item or a Sourcing Map page has no entry.
 * - Write what a customer sees on the page; never describe how HAIWAVE implements it.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { navSections } from '@/components/account-nav';
import { STATUS_LABELS } from '@/components/status-badge';

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
 * src/app has many `_`-prefixed folders today (`_components`, `__tests__`, `__fixtures__` and others), and none of them
 * holds a page.tsx; it has no (group) folder and no @slot folder. A page under any of these would be listed by its
 * folder path.
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

  // A heading typed with two spaces, `##  /account/agents`, is skipped by the helpers above, so no other test
  // reads its body, while a reader that splits the file on `## ` and trims the heading, as haiCore does, takes it
  // as a second entry for that route.
  it('writes every level-2 heading as `## /route` or `## Glossary`, one space and nothing else on the line', () => {
    const wrong = read()
      .split('\n')
      .filter((line) => /^##\s/.test(line) && !/^## (Glossary|\/\S*)$/.test(line));
    expect(wrong).toEqual([]);
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

  // The Sourcing Map routes come from a walk of the file system, so they are pinned by name: a walk that loses a page
  // would let its entry go missing unseen. The nav routes are taken from navSections, as the coverage test takes them.
  // A new page under src/app/sourcing-map adds a line here and an entry in the guide.
  it('requires the nav pages and the Sourcing Map sub-pages, so the coverage check is not vacuous', () => {
    expect(sourcingMapRoutes()).toEqual([
      '/sourcing-map',
      '/sourcing-map/[projectId]',
      '/sourcing-map/[projectId]/products/[productId]',
      '/sourcing-map/[projectId]/runs/[templateId]',
    ]);
    const routes = new Set(required());
    const expected = [...navSections.flatMap((s) => s.items.map((i) => i.href)), ...sourcingMapRoutes()];
    expect(expected.filter((route) => !routes.has(route))).toEqual([]);
    // A floor that does not come from navSections: an empty or reshaped nav list would otherwise pass unseen.
    expect(required()).toContain('/account/agents');
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

  // Who may open the Users and Billing pages, in the labels a customer sees for the two roles.
  it('says the Owner and Account Admin roles can open the Users and Billing pages', () => {
    const sections = pageSections(read());
    const rule = `The ${STATUS_LABELS.account_owner} and ${STATUS_LABELS.account_admin} roles can open this page; other roles are sent to the System Dashboard.`;
    for (const route of ['/account/users', '/account/billing']) {
      const entry = sections.get(route) ?? '';
      expect(entry, route).not.toContain('Only the account Owner can open this page');
      expect(entry, route).toContain(rule);
    }
  });

  // scripts/publish-help-pack.mjs puts this file into the knowledge pack as it is, so a comment in it would reach the
  // help model. The notes for whoever maintains the guide are in this file's header instead.
  it('holds no HTML comment, because the file reaches the help model as it is', () => {
    expect(read()).not.toContain('<!--');
  });

  // Nothing sits between the title and the first page: a maintainer note written there as plain text, or as a
  // markdown comment, would reach the help model just as an HTML comment would.
  it('opens with its title line and one blank line, then the first page', () => {
    expect(read().split(/^## /m)[0]).toMatch(/^# [^\n]+\n\n$/);
  });
});
