import { describe, it, expect } from 'vitest';
import { contrastRatio, consoleColor, textToken, groundToken, ratioOn } from '../contrast';

describe('contrast instrument', () => {
  it('reproduces the measured ratios in hundredths: 416, 227, 541, 1047 (present control)', () => {
    const hundredths = (fg: string, bg: string) => Math.round(contrastRatio(fg, bg) * 100);
    expect(hundredths('#64748B', '#ECF0F4')).toBe(416);
    expect(hundredths('#29B0C3', '#ECF0F4')).toBe(227);
    expect(hundredths('#007585', '#FFFFFF')).toBe(541);
    expect(hundredths('#2D3748', '#ECF0F4')).toBe(1047);
  });

  it("reads the console's brand tokens from globals.css and throws on an unknown token", () => {
    expect(consoleColor('slate')).toBe('#64748B');
    expect(consoleColor('light-gray')).toBe('#ECF0F4');
    expect(() => consoleColor('nope')).toThrow();
  });

  it('resolves the text and ground tokens by whole-class equality, and refuses translucent or missing ones', () => {
    const host = document.createElement('div');
    host.innerHTML = '<div class="bg-light-gray"><span class="text-xs text-teal-dark hover:text-navy">x</span></div>';
    const span = host.querySelector('span') as HTMLElement;
    expect(textToken(span)).toBe('teal-dark');
    expect(groundToken(span)).toBe('light-gray');
    expect(Math.round(ratioOn(span) * 100)).toBe(472);

    // A variant class never counts, even when it comes first in the class list.
    host.innerHTML = '<div class="hover:bg-white bg-light-gray"><span class="hover:text-navy text-teal-dark">x</span></div>';
    const variantFirst = host.querySelector('span') as HTMLElement;
    expect(textToken(variantFirst)).toBe('teal-dark');
    expect(groundToken(variantFirst)).toBe('light-gray');

    host.innerHTML = '<div class="bg-light-gray/50"><span class="text-teal-dark">x</span></div>';
    expect(() => groundToken(host.querySelector('span') as HTMLElement)).toThrow(/translucent/);

    host.innerHTML = '<div><span class="text-teal-dark">x</span></div>';
    expect(() => groundToken(host.querySelector('span') as HTMLElement)).toThrow(/no ground/);
  });
});
