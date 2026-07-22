import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccordionLeafRow } from '../accordion-leaf-row';
import { IdChip } from '@/components/id-chip';

describe('<AccordionLeafRow>', () => {
  it('never nests interactive metaSlot content inside a button (valid HTML, no hydration error)', () => {
    const { container } = render(
      <AccordionLeafRow
        label="Pressure-Rated Tee Casting"
        onClick={() => {}}
        metaSlot={<IdChip id="APX-BR-FIT-TEE-075" chars={6} />}
      />,
    );
    // A <button> descendant of a <button> is invalid HTML and triggers a
    // React hydration error (seen live on the template wizard catalog browser).
    expect(container.querySelector('button button')).toBeNull();
    // The chip is still a real, clickable button.
    expect(screen.getByTestId('id-chip')).toBeInTheDocument();
  });

  it('clickable row activates on click and on Enter/Space', () => {
    const onClick = vi.fn();
    render(
      <AccordionLeafRow label="Leaf" onClick={onClick} metaSlot={<span>›</span>} />,
    );
    const row = screen.getByRole('treeitem', { name: 'Leaf' });

    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(row, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(3);

    // Focusable like a button.
    expect(row).toHaveAttribute('tabindex', '0');
  });

  it('metaSlot chip click does not bubble into row activation', () => {
    const onClick = vi.fn();
    render(
      <AccordionLeafRow
        label="Leaf"
        onClick={onClick}
        metaSlot={<IdChip id="APX-BR-FIT-TEE-075" chars={6} />}
      />,
    );
    fireEvent.click(screen.getByTestId('id-chip'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders detailSlot content on its own line beneath the row, not inside it', () => {
    render(
      <AccordionLeafRow
        label="Leaf"
        metaSlot={<span>SKU-1</span>}
        detailSlot={<span>ask cluster</span>}
      />,
    );
    const detail = screen.getByText('ask cluster');
    expect(detail).toBeInTheDocument();
    // The detail line is a sibling of the treeitem row, not part of its flex line.
    const row = screen.getByText('Leaf').closest('[role="treeitem"]');
    expect(row).not.toBeNull();
    expect(row).not.toContainElement(detail);
  });

  it('clicking detailSlot content does not activate a clickable row', () => {
    const onClick = vi.fn();
    render(
      <AccordionLeafRow
        label="Leaf"
        onClick={onClick}
        metaSlot={<span>m</span>}
        detailSlot={<button type="button">inner control</button>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'inner control' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
