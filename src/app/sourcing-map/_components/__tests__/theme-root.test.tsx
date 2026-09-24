/// <reference types="vitest/jsdom" />
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SmThemeRoot, ThemeToggle } from '../theme-root';

// Node 26's own (file-less, undefined) localStorage global shadows jsdom's: vitest 4.1.4's
// populateGlobal skips a key already on global unless it is in its KEYS list. Use jsdom's.
vi.stubGlobal('localStorage', jsdom.window.localStorage);

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function mount() {
  render(
    <SmThemeRoot>
      <ThemeToggle />
    </SmThemeRoot>,
  );
  return screen.getByTestId('sm-root');
}

describe('SmThemeRoot', () => {
  it('is dark by default with the tokens on its element; the toggle switches to light and remembers it', () => {
    const root = mount();
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(root.style.getPropertyValue('--sm-canvas')).toBe('#10132A');
    fireEvent.click(screen.getByRole('button', { name: 'Light theme' }));
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(root.style.getPropertyValue('--sm-canvas')).toBe('#ECF0F4');
    expect(window.localStorage.getItem('sm.theme')).toBe('light');
  });
});
