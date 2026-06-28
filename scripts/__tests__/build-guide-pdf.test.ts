// @vitest-environment node
import { describe, it, expect } from 'vitest';
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
