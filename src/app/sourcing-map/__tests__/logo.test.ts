import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LOGO = join(__dirname, '..', '..', '..', '..', 'public', 'img', 'haiwave-logo-reversed.svg');

describe('reversed HAIWAVE logo (spec §9.1, R-2)', () => {
  it('has no plate: no rect, no image, no background and no navy (owner-supplied filled artwork passes too)', () => {
    const svg = readFileSync(LOGO, 'utf8');
    expect(svg).toMatch(/<svg[\s>]/); // present control: the file is an SVG
    expect(svg).not.toMatch(/<rect[\s>/]/i);
    expect(svg).not.toMatch(/<image[\s>/]/i);
    expect(svg).not.toMatch(/background/i);
    expect(svg).not.toContain('#1A1F36');
  });
});
