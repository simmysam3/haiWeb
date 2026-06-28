// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { injectTemplate } from '../build-guide-pdf.mjs';

// injectTemplate is the contract between the Claude Design template and the
// generator: the template carries {{title}} / {{date}} / {{body}} placeholders,
// and every one must be filled. A leftover {{…}} after substitution is a template
// authoring error and must fail loudly (so a renamed/typo'd placeholder can't
// silently ship an empty section).
const TEMPLATE = `<!doctype html><title>{{title}}</title><body><header>{{title}} — {{date}}</header><main>{{body}}</main></body>`;

describe('injectTemplate', () => {
  it('fills every occurrence of each placeholder', () => {
    const html = injectTemplate(TEMPLATE, {
      title: 'Configuration Guide',
      date: '2026-06-28',
      bodyHtml: '<h1>Hello</h1>',
    });
    expect(html).toContain('<title>Configuration Guide</title>');
    expect(html).toContain('Configuration Guide — 2026-06-28');
    expect(html).toContain('<main><h1>Hello</h1></main>');
    expect(html).not.toContain('{{');
  });

  it('throws when a required field is missing', () => {
    expect(() =>
      injectTemplate(TEMPLATE, { title: 'X', date: '2026-06-28' } as never),
    ).toThrow(/body/i);
  });

  it('throws when the template has an unknown leftover placeholder', () => {
    const bad = TEMPLATE + '<footer>{{author}}</footer>';
    expect(() =>
      injectTemplate(bad, { title: 'X', date: 'Y', bodyHtml: 'Z' }),
    ).toThrow(/unfilled placeholder.*author/i);
  });

  it('does not throw for a template whose placeholders are all known (contrast case)', () => {
    expect(() =>
      injectTemplate(TEMPLATE, { title: 'X', date: 'Y', bodyHtml: 'Z' }),
    ).not.toThrow();
  });
});

// Contract test against the REAL committed Claude Design template: it must fill
// cleanly through the pipeline's injector (only {{title}}/{{date}}/{{body}}, no
// stray tokens — the spec comment's `{{ + title + }}` notation must not trip it).
describe('design/configuration-guide/template.html ↔ pipeline contract', () => {
  const template = readFileSync(
    join(process.cwd(), 'design/configuration-guide/template.html'),
    'utf8',
  );

  it('fills the cover (title/date) and body slot with no leftover tokens', () => {
    const html = injectTemplate(template, {
      title: 'Free Agent SCM — Client Implementation Guidelines',
      date: '2026-06-28',
      bodyHtml: '<section class="page"><div class="page__inner">CONTRACT-BODY</div></section>',
    });
    expect(html).toContain('Free Agent SCM — Client Implementation Guidelines'); // banner + <title>
    expect(html).toContain('Edition: 2026-06-28'); // cover date slot
    expect(html).toContain('CONTRACT-BODY'); // body slot
    expect(html).not.toMatch(/\{\{\s*(title|date|body)\s*\}\}/); // all live tokens consumed
  });
});
