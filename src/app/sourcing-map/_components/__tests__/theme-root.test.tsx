import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SmThemeRoot, ThemeToggle } from '../theme-root';

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

  it('names the theme the button switches to, so the label changes with the theme (owner, walk 2026-09-29)', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Light theme' }));
    expect(screen.queryByRole('button', { name: 'Light theme' })).toBeNull();
    const back = screen.getByRole('button', { name: 'Dark theme' });
    // The label carries the state, so the button is not also a pressed toggle (one or the other, never both).
    expect(back).not.toHaveAttribute('aria-pressed');
    fireEvent.click(back);
    expect(screen.getByTestId('sm-root')).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Light theme' })).not.toHaveAttribute('aria-pressed');
    expect(window.localStorage.getItem('sm.theme')).toBe('dark');
  });

  it('applies a remembered light theme after mount and ignores a value it does not know (server renders dark; known one-frame limitation)', () => {
    window.localStorage.setItem('sm.theme', 'neon');
    const first = render(
      <SmThemeRoot>
        <ThemeToggle />
      </SmThemeRoot>,
    );
    expect(screen.getByTestId('sm-root')).toHaveAttribute('data-theme', 'dark');
    first.unmount();
    window.localStorage.setItem('sm.theme', 'light');
    const root = mount();
    expect(root).toHaveAttribute('data-theme', 'light');
  });

  it('the theme toggle survives throwing storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const root = mount();
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Light theme' }))).not.toThrow();
    expect(root).toHaveAttribute('data-theme', 'light');
  });
});
