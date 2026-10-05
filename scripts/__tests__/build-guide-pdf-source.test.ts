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
  it('takes all three attributes from the first class="page" tag and from no other section (plan R7)', () => {
    // A first page with only the edition is unbound. The attributes of a later page do not complete it.
    expect(() => extractSourceBinding(page(' data-edition="1.7"') + bound())).toThrow(/must carry data-source(?!-)/);
    // Only a class="page" section can be the first page. A section of another class that comes before it is not read,
    // even when it carries a whole binding, so it cannot bind the build to its own edition.
    const cover = `<section class="cover" data-edition="1.6" data-source="client-implementation-guidelines-v1.6.md" data-source-sha256="${sha('the 1.6 source')}">cover</section>`;
    expect(extractSourceBinding(cover + bound())).toEqual({
      edition: '1.7', sourceFile: 'client-implementation-guidelines-v1.7.md', sourceSha256: sha(SOURCE),
    });
  });
  it('ignores HTML comments when finding the first page section (CN-1)', () => {
    const quoted = '<!-- One <section class="page"> per printed page. -->\n';
    expect(extractSourceBinding(quoted + bound()).edition).toBe('1.7');
    const previous = page(` data-edition="1.6" data-source="client-implementation-guidelines-v1.6.md" data-source-sha256="${sha('the 1.6 source')}"`);
    expect(extractSourceBinding(`<!-- previous edition:\n${previous}\n-->\n` + bound())).toEqual({
      edition: '1.7', sourceFile: 'client-implementation-guidelines-v1.7.md', sourceSha256: sha(SOURCE),
    });
  });
  it('ignores every comment, each one on its own, in a body with several (CN-1)', () => {
    // The real body has dozens of comments, two of them before its first page. Removing only the first comment would bind
    // to the commented-out 1.6 section; one match running from the first <!-- to the last --> would swallow the bound section.
    const previous = page(` data-edition="1.6" data-source="client-implementation-guidelines-v1.6.md" data-source-sha256="${sha('the 1.6 source')}"`);
    const body = `<!-- provenance header -->\n<!-- previous edition:\n${previous}\n-->\n${bound()}\n<!-- ===== §1 ===== -->\n<section class="page">§1</section>`;
    expect(extractSourceBinding(body)).toEqual({
      edition: '1.7', sourceFile: 'client-implementation-guidelines-v1.7.md', sourceSha256: sha(SOURCE),
    });
  });
  it('names each missing attribute', () => {
    expect(() => extractSourceBinding(page(''))).toThrow(/data-edition/);
    expect(() => extractSourceBinding(page(' data-edition="1.7"'))).toThrow(/data-source(?!-)/); // not data-source-sha256
    expect(() => extractSourceBinding(page(' data-edition="1.7" data-source="client-implementation-guidelines-v1.7.md"'))).toThrow(/data-source-sha256/);
  });
  it('refuses a bad file name, an edition that is not the file\'s, and a malformed sha', () => {
    expect(() => extractSourceBinding(page(` data-edition="1.7" data-source="guide.md" data-source-sha256="${sha(SOURCE)}"`))).toThrow(/client-implementation-guidelines-v/);
    expect(() => extractSourceBinding(page(` data-edition="1.8" data-source="client-implementation-guidelines-v1.7.md" data-source-sha256="${sha(SOURCE)}"`))).toThrow(/does not match/);
    expect(() => extractSourceBinding(bound(sha(SOURCE).toUpperCase()))).toThrow(/64 lowercase hex/); // 64 characters, upper case
    expect(() => extractSourceBinding(bound(sha(SOURCE).slice(0, 63)))).toThrow(/64 lowercase hex/); // lower case, 63 characters
    // The file name is anchored at both ends, so data-source is always a bare file name inside haiCore docs/.
    expect(() => extractSourceBinding(page(` data-edition="1.7" data-source="../x/client-implementation-guidelines-v1.7.md" data-source-sha256="${sha(SOURCE)}"`))).toThrow(/is not a client-implementation-guidelines-v/);
    expect(() => extractSourceBinding(page(` data-edition="1.7" data-source="client-implementation-guidelines-v1.7.md.bak" data-source-sha256="${sha(SOURCE)}"`))).toThrow(/is not a client-implementation-guidelines-v/);
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
    const unreadable = verifySourceUnchanged(extractSourceBinding(bound()), tmp('empty-docs-'));
    await expect(unreadable).rejects.toThrow(/client-implementation-guidelines-v1\.7\.md/);
    await expect(unreadable).rejects.toThrow(/HAICORE_DIR/);
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

  it('names the manifest configuration-guide.json, the name its readers open (plan C.6)', () => {
    // publish:help-pack and the console BFF open the file by this literal name, not through this constant. The cases below
    // find the manifest through the constant, so on their own they would pass whatever its value is.
    expect(GUIDE_MANIFEST_FILE).toBe('configuration-guide.json');
  });

  it('renders, then records bodySha256, edition, source file, source sha and builtAt', async () => {
    // Like the real body, this one has comments. Only the binding lookup ignores them: the renderer gets the body as it is on
    // disk, and bodySha256 is the hash of that same file (publish:help-pack re-hashes body.html and refuses on a difference).
    const body = `<!-- authoring note -->\n${bound()}\n<!-- ===== §1 ===== -->\n<section class="page">§1</section>`;
    const t = tree(body);
    const rendered: { html: string; outPath: string }[] = [];
    const now = new Date('2026-10-07T11:00:00.000Z');
    const r = await buildGuidePdf({
      bodyHtmlPath: join(t.root, 'body.html'), templatePath: join(t.root, 'template.html'), outPath: t.out,
      title: 'T', date: 'D', haicoreDocsDir: t.docs, now, render: async (html: string, outPath: string) => { rendered.push({ html, outPath }); },
    });
    // The document handed to the renderer is the template with the title, the date and the whole body injected.
    expect(rendered).toEqual([{ html: `<html>T D ${body}</html>`, outPath: t.out }]);
    const written = JSON.parse(readFileSync(join(t.root, 'out', GUIDE_MANIFEST_FILE), 'utf8'));
    expect(written).toEqual({ bodySha256: sha(body), edition: '1.7', sourceFile: 'client-implementation-guidelines-v1.7.md', sourceSha256: sha(SOURCE), builtAt: now.toISOString() });
    expect(r.manifest).toEqual(written);
  });

  it('rejects with the render error and writes no manifest when the render fails', async () => {
    const t = tree(bound());
    await expect(buildGuidePdf({
      bodyHtmlPath: join(t.root, 'body.html'), templatePath: join(t.root, 'template.html'), outPath: t.out,
      title: 'T', date: 'D', haicoreDocsDir: t.docs, render: async () => { throw new Error('chromium did not launch'); },
    })).rejects.toThrow('chromium did not launch');
    expect(existsSync(join(t.root, 'out', GUIDE_MANIFEST_FILE))).toBe(false);
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
