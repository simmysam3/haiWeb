// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { extractSourceBinding, verifySourceUnchanged, buildGuidePdf, GUIDE_MANIFEST_FILE } from '../build-guide-pdf.mjs';

const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const SOURCE = '# Guide 1.7\n## §1 Quick Start\n';
const page = (attrs: string) => `<section class="page" data-screen-label="Contents"${attrs}><div class="page__inner">TOC</div></section>`;
const bound = (s = sha(SOURCE)) => page(` data-edition="1.7" data-source="client-implementation-guidelines-v1.7.md" data-source-sha256="${s}"`);

const created: string[] = [];
const tmp = (p: string) => { const d = mkdtempSync(join(tmpdir(), p)); created.push(d); return d; };
afterEach(() => { created.forEach((d) => rmSync(d, { recursive: true, force: true })); created.length = 0; });

describe('extractSourceBinding (README § Source binding)', () => {
  it('reads the three attributes from the first page section', () => {
    expect(extractSourceBinding(bound() + page(' data-edition="9.9"'))).toEqual({
      edition: '1.7', sourceFile: 'client-implementation-guidelines-v1.7.md', sourceSha256: sha(SOURCE),
    });
  });
  it('names each missing attribute', () => {
    expect(() => extractSourceBinding(page(''))).toThrow(/data-edition/);
    expect(() => extractSourceBinding(page(' data-edition="1.7"'))).toThrow(/data-source\b/);
    expect(() => extractSourceBinding(page(' data-edition="1.7" data-source="client-implementation-guidelines-v1.7.md"'))).toThrow(/data-source-sha256/);
  });
  it('refuses a bad file name, an edition that is not the file\'s, and a malformed sha', () => {
    expect(() => extractSourceBinding(page(` data-edition="1.7" data-source="guide.md" data-source-sha256="${sha(SOURCE)}"`))).toThrow(/client-implementation-guidelines-v/);
    expect(() => extractSourceBinding(page(` data-edition="1.8" data-source="client-implementation-guidelines-v1.7.md" data-source-sha256="${sha(SOURCE)}"`))).toThrow(/does not match/);
    expect(() => extractSourceBinding(page(' data-edition="1.7" data-source="client-implementation-guidelines-v1.7.md" data-source-sha256="ABC"'))).toThrow(/64 lowercase hex/);
  });
  it('refuses a body with no page section', () => {
    expect(() => extractSourceBinding('<div>nothing</div>')).toThrow(/no <section class="page">/);
  });
});

describe('verifySourceUnchanged', () => {
  it('passes when the source still hashes to the binding and refuses when it changed', async () => {
    const docs = tmp('guide-docs-');
    writeFileSync(join(docs, 'client-implementation-guidelines-v1.7.md'), SOURCE);
    const binding = extractSourceBinding(bound());
    await expect(verifySourceUnchanged(binding, docs)).resolves.toBeUndefined();
    writeFileSync(join(docs, 'client-implementation-guidelines-v1.7.md'), SOURCE + 'amended in place\n');
    await expect(verifySourceUnchanged(binding, docs)).rejects.toThrow(/changed since body\.html was authored/);
  });
  it('names the missing file and HAICORE_DIR when the source cannot be read', async () => {
    await expect(verifySourceUnchanged(extractSourceBinding(bound()), tmp('empty-docs-'))).rejects.toThrow(/HAICORE_DIR/);
  });
});

describe('buildGuidePdf writes configuration-guide.json beside the PDF', () => {
  function tree(bodyHtml: string) {
    const root = tmp('guide-build-');
    const docs = join(root, 'docs');
    mkdirSync(docs);
    writeFileSync(join(docs, 'client-implementation-guidelines-v1.7.md'), SOURCE);
    writeFileSync(join(root, 'template.html'), '<html>{{title}} {{date}} {{body}}</html>');
    writeFileSync(join(root, 'body.html'), bodyHtml);
    return { root, docs, out: join(root, 'out', 'configuration-guide.pdf') };
  }

  it('renders, then records bodySha256, edition, source file, source sha and builtAt', async () => {
    const body = bound() + '<section class="page">§1</section>';
    const t = tree(body);
    const rendered: string[] = [];
    const now = new Date('2026-10-07T11:00:00.000Z');
    const r = await buildGuidePdf({
      bodyHtmlPath: join(t.root, 'body.html'), templatePath: join(t.root, 'template.html'), outPath: t.out,
      title: 'T', date: 'D', haicoreDocsDir: t.docs, now, render: async (_html: string, outPath: string) => { rendered.push(outPath); },
    });
    expect(rendered).toEqual([t.out]);
    const written = JSON.parse(readFileSync(join(t.root, 'out', GUIDE_MANIFEST_FILE), 'utf8'));
    expect(written).toEqual({ bodySha256: sha(body), edition: '1.7', sourceFile: 'client-implementation-guidelines-v1.7.md', sourceSha256: sha(SOURCE), builtAt: now.toISOString() });
    expect(r.manifest).toEqual(written);
  });

  it('neither renders nor writes the manifest when the source changed after authoring', async () => {
    const t = tree(bound(sha('an older source')));
    const rendered: string[] = [];
    await expect(buildGuidePdf({
      bodyHtmlPath: join(t.root, 'body.html'), templatePath: join(t.root, 'template.html'), outPath: t.out,
      title: 'T', date: 'D', haicoreDocsDir: t.docs, render: async (_h: string, o: string) => { rendered.push(o); },
    })).rejects.toThrow(/changed since body\.html was authored/);
    expect(rendered).toEqual([]);
    expect(existsSync(join(t.root, 'out', GUIDE_MANIFEST_FILE))).toBe(false);
  });
});
