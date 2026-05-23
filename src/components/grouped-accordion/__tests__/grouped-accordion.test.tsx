import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import {
  GroupedAccordion,
  AccordionGroupRow,
  AccordionLeafRow,
} from '../index.js';

function Harness({ initial = 'none' }: { initial?: 'none' | 'all' }) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => (initial === 'all' ? new Set(['a', 'b']) : new Set()),
  );
  const toggle = (k: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <GroupedAccordion initialExpanded={initial}>
      <AccordionGroupRow
        groupKey="a"
        label="Alpha"
        count={3}
        expanded={expanded.has('a')}
        onToggle={() => toggle('a')}
      >
        <AccordionLeafRow label="Alpha-1" metaSlot={<span>meta-1</span>} onClick={() => {}} />
      </AccordionGroupRow>
      <AccordionGroupRow
        groupKey="b"
        label="Beta"
        count={{ filtered: 1, total: 5 }}
        expanded={expanded.has('b')}
        onToggle={() => toggle('b')}
      >
        <AccordionLeafRow label="Beta-1" metaSlot={null} onClick={() => {}} />
      </AccordionGroupRow>
    </GroupedAccordion>
  );
}

describe('<GroupedAccordion>', () => {
  it('renders all group headers; children hidden when collapsed', () => {
    render(<Harness initial="none" />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Alpha-1')).toBeNull();
    expect(screen.queryByText('Beta-1')).toBeNull();
  });

  it('toggles a group when its chevron is clicked', () => {
    render(<Harness initial="none" />);
    fireEvent.click(screen.getByRole('button', { name: /Expand Alpha/i }));
    expect(screen.getByText('Alpha-1')).toBeInTheDocument();
  });

  it('renders all expanded when initialExpanded="all"', () => {
    render(<Harness initial="all" />);
    expect(screen.getByText('Alpha-1')).toBeInTheDocument();
    expect(screen.getByText('Beta-1')).toBeInTheDocument();
  });

  it('renders count as a number for number prop', () => {
    render(<Harness initial="none" />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders count as "X of N" for filtered prop', () => {
    render(<Harness initial="none" />);
    expect(screen.getByText('1 of 5')).toBeInTheDocument();
  });

  it('header button advertises aria-expanded', () => {
    render(<Harness initial="all" />);
    const alphaBtn = screen.getByRole('button', { name: /Collapse Alpha/i });
    expect(alphaBtn.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('<AccordionLeafRow>', () => {
  it('fires onClick on row click', () => {
    let clicked = false;
    render(
      <AccordionLeafRow
        label="L"
        metaSlot={null}
        onClick={() => {
          clicked = true;
        }}
      />,
    );
    fireEvent.click(screen.getByRole('treeitem', { name: /L/i }));
    expect(clicked).toBe(true);
  });
});
