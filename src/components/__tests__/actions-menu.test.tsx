import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionsMenu } from '../actions-menu';

/**
 * v1.85 — a row-level "Actions" menu: one labelled button that opens a WAI-ARIA
 * menu of links. Replaces the un-labelled chevron on the watcher Configurations
 * table, where a single drill-down could not say whether it led to runs or to
 * the configuration.
 */
const ITEMS = [
  { label: 'View runs', href: '/w/1?tab=runs' },
  { label: 'Edit configuration', href: '/w/1?tab=configuration' },
];

function renderMenu() {
  return render(
    <div>
      <button type="button">outside</button>
      <ActionsMenu label="Actions for Acme watcher" items={ITEMS} />
    </div>,
  );
}

describe('ActionsMenu', () => {
  it('renders a closed menu button named by label, with no menu in the document', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Actions for Acme watcher' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens on click and lists every item as a link menuitem with its href', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Acme watcher' }));
    expect(screen.getByRole('button', { name: 'Actions for Acme watcher' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const menu = screen.getByRole('menu', { name: 'Actions for Acme watcher' });
    expect(menu).toBeInTheDocument();
    const items = screen.getAllByRole('menuitem');
    expect(items.map((el) => el.textContent)).toEqual(['View runs', 'Edit configuration']);
    expect(items[0]).toHaveAttribute('href', '/w/1?tab=runs');
    expect(items[1]).toHaveAttribute('href', '/w/1?tab=configuration');
  });

  it('closes on Escape and returns focus to the trigger', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Actions for Acme watcher' });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('closes when the pointer goes down outside the menu', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Acme watcher' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // v1.85 walk finding: inside the Configurations table's overflow-x-auto
  // wrapper an absolutely positioned menu was clipped and grew the wrapper
  // a scrollbar. The open menu therefore leaves its ancestors entirely.
  it('renders the open menu at the document body, outside any scrolling ancestor', () => {
    const { container } = render(
      <div style={{ overflowX: 'auto' }} data-testid="scroller">
        <ActionsMenu label="Actions for Acme watcher" items={ITEMS} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Acme watcher' }));
    const menu = screen.getByRole('menu');
    expect(screen.getByTestId('scroller').contains(menu)).toBe(false);
    expect(container.contains(menu)).toBe(false);
    expect(menu.parentElement).toBe(document.body);
  });

  it('positions the open menu fixed to the viewport, not relative to the table', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Acme watcher' }));
    expect(screen.getByRole('menu').style.position).toBe('fixed');
  });

  it('stays open on a pointer-down inside the menu itself', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Acme watcher' }));
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'View runs' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('moves focus through the items with ArrowDown/ArrowUp, wrapping', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Acme watcher' }));
    const [first, second] = screen.getAllByRole('menuitem');
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: 'ArrowDown' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(second).toHaveFocus();
  });
});
