import { describe, it, expect } from 'vitest';
import { contrastRatio, consoleColor, textToken, groundToken, ratioOn, smTextColor, smGroundColor, smRatioOn, smWorstRatio } from '../contrast';

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

  it('reads a Sourcing Map class through sourcing-map.css to its theme token, in both themes (present control)', () => {
    const host = document.createElement('div');
    host.innerHTML = '<div class="sm-root"><div class="sm-card"><span class="sm-muted text-xs">x</span></div><b>y</b></div>';
    const span = host.querySelector('span') as HTMLElement;
    expect(smTextColor(span, 'dark')).toBe('#B9C2CC');
    expect(smTextColor(span, 'light')).toBe('#475569');
    expect(smGroundColor(span, 'dark')).toBe('#212846');
    expect(smGroundColor(span, 'light')).toBe('#FFFFFF');
    const bold = host.querySelector('b') as HTMLElement;
    expect(smTextColor(bold, 'dark')).toBe('#E8EBF0');
    expect(smGroundColor(bold, 'dark')).toBe('#10132A');
  });

  it('measures the pair in each theme and reports the worse', () => {
    const host = document.createElement('div');
    host.innerHTML = '<div class="sm-root"><div class="sm-surface"><span class="sm-muted">x</span></div></div>';
    const span = host.querySelector('span') as HTMLElement;
    expect(Math.round(smRatioOn(span, 'dark') * 100)).toBe(901);
    expect(Math.round(smRatioOn(span, 'light') * 100)).toBe(758);
    expect(Math.round(smWorstRatio(span) * 100)).toBe(758);
  });

  it('reads a brand class as its hex in both themes, and throws on a colour it does not know or a ground it cannot find', () => {
    const host = document.createElement('div');
    host.innerHTML = '<div class="sm-root"><div class="sm-surface"><span class="text-xs text-slate">x</span></div></div>';
    expect(Math.round(smWorstRatio(host.querySelector('span') as HTMLElement) * 100)).toBe(341);

    host.innerHTML = '<div class="sm-root"><div class="sm-surface"><span class="text-red-900">x</span></div></div>';
    expect(() => smWorstRatio(host.querySelector('span') as HTMLElement)).toThrow(/unknown colour class/);

    host.innerHTML = '<div class="sm-root"><div class="bg-black/60"><span class="sm-muted">x</span></div></div>';
    expect(() => smWorstRatio(host.querySelector('span') as HTMLElement)).toThrow(/unknown colour class/);

    host.innerHTML = '<div><span class="text-slate">x</span></div>';
    expect(() => smWorstRatio(host.querySelector('span') as HTMLElement)).toThrow(/no ground/);

    host.innerHTML = '<div class="sm-root"><span class="sm-btn-primary">x</span></div>';
    expect(() => smWorstRatio(host.querySelector('span') as HTMLElement)).toThrow(/not a theme token/);

    host.innerHTML = '<div class="sm-surface"><span class="text-xs">x</span></div>';
    expect(() => smWorstRatio(host.querySelector('span') as HTMLElement)).toThrow(/no text colour/);
  });
});
