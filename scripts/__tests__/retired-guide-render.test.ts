// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The earlier guide render printed an authored HTML body (`build:guide-pdf`). `render:guide-pdf` replaced it: the PDF
// now comes from the guide's markdown. The earlier render and the files it read stay out of this tree.
const inRepo = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

describe('the retired guide render', () => {
  it.each([
    'design/configuration-guide/body.html',
    'design/configuration-guide/template.html',
    'scripts/build-guide-pdf.mjs',
    'scripts/__tests__/build-guide-pdf.test.ts',
    'scripts/__tests__/build-guide-pdf-source.test.ts',
  ])('%s is not in the tree', (path) => {
    expect(existsSync(inRepo(path))).toBe(false);
  });
  // The rows above pass for any path that does not exist. This one holds them to the repository's root.
  it('finds the template the current render fills, at the same root', () => {
    expect(existsSync(inRepo('design/configuration-guide/guide-template.html'))).toBe(true);
  });
  it('package.json has no build:guide-pdf command, and no command runs the removed script', () => {
    const scripts = JSON.parse(readFileSync(inRepo('package.json'), 'utf8')).scripts as Record<string, string>;
    expect(Object.keys(scripts)).not.toContain('build:guide-pdf');
    expect(Object.entries(scripts).filter(([, command]) => command.includes('build-guide-pdf'))).toEqual([]);
  });
});
