import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { multitierDetail } from '@/app/sourcing-map/__fixtures__/sp2';
import { vomeroResult } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SmCandidateResult2 } from '@/lib/sourcing-map/types';
import { TierRows } from '../tier-rows';

const mt = multitierDetail.result!;
const [leon, mekong, arno] = mt.slots[0]!.candidates;

function mount(candidate: SmCandidateResult2, extra: Partial<Parameters<typeof TierRows>[0]> = {}) {
  return render(
    <TierRows candidate={candidate} traced={false} selectedAlias={null} onSelectAlias={vi.fn()} hoveredAlias={null} onHoverAlias={vi.fn()} {...extra} />,
  );
}

describe('TierRows', () => {
  it('draws one row per tier present; each handle reads alias · country · floored class, with the band dot worded in title and aria-label; nothing below tier 1 is a number (spec §12.1)', () => {
    mount(leon!);
    const t2 = screen.getByRole('group', { name: 'Tier 2 under León Cuero' });
    const t3 = screen.getByRole('group', { name: 'Tier 3 under León Cuero' });
    expect(screen.queryByRole('group', { name: 'Tier 4 under León Cuero' })).toBeNull();
    const a = within(t2).getByRole('button', { name: /^A · IT · Dyes/ });
    const b = within(t2).getByRole('button', { name: /^B · US · Wet-blue/ });
    const c = within(t3).getByRole('button', { name: /^C · IN · Colorants/ });
    expect(within(t2).getAllByRole('button')).toHaveLength(2);
    const dot = within(a).getByRole('img', { name: 'moderate' });
    expect(dot).toHaveAttribute('title', 'moderate');
    expect(dot.style.background).toBe('var(--sm-heat-mid)');
    expect(within(b).queryByRole('img')).toBeNull();
    expect(within(c).queryByRole('img')).toBeNull();
    expect(a).toHaveAttribute('data-anchor', 'leon/A');
    expect(c).toHaveAttribute('data-anchor', 'leon/C');
    expect(a).toHaveAttribute('data-alias', 'A');
    expect(a).toHaveAttribute('aria-pressed', 'false');
    // Requirements §7.3: an alias, a tier, a country, a floored class, a band — never a quantity, an id or a name.
    expect(t2.parentElement!.textContent).not.toMatch(/\d[\d,.]{2,}|[0-9a-f]{8}-|Vetta|Halcyon|Rio Bravo/);
  });

  it('keeps each handle to one line: the full label is its title and stays in the DOM text, so a truncated handle still names itself (Task 13 fix round A)', () => {
    mount(leon!);
    const full = { A: 'A · IT · Dyes', B: 'B · US · Wet-blue', C: 'C · IN · Colorants' } as const;
    for (const [alias, label] of Object.entries(full)) {
      const handle = document.querySelector<HTMLElement>(`button[data-anchor="leon/${alias}"]`)!;
      expect(handle).toHaveAttribute('title', label);
      expect(handle.textContent!.startsWith(label)).toBe(true);
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toBe(handle);
    }
  });

  it('reads "—" for a missing country or class', () => {
    const bare: SmCandidateResult2 = { ...leon!, nodes: [{ alias: 'A', tier: 2, country: null, class: null, band: 'slight', observed_below: true }] };
    mount(bare);
    expect(screen.getByRole('button', { name: /^A · — · —/ })).toHaveAttribute('title', 'A · — · —');
    expect(screen.getByRole('img', { name: 'slight' }).style.background).toBe('var(--sm-heat-good)');
  });

  it('renders nothing for an SP1 candidate (no nodes) or a gap card with no nodes (Review Focus 1)', () => {
    const sp1 = mount(vomeroResult.slots[0]!.candidates[0]!);
    expect(sp1.container).toBeEmptyDOMElement();
    sp1.unmount();
    expect(arno!.nodes).toEqual([]);
    expect(mount(arno!).container).toBeEmptyDOMElement();
  });

  it('selects an alias on click and deselects it on a second click; reports hover on enter/leave and focus/blur', async () => {
    const user = userEvent.setup();
    const onSelectAlias = vi.fn();
    const onHoverAlias = vi.fn();
    const { rerender, unmount } = mount(leon!, { onSelectAlias, onHoverAlias });
    const a = screen.getByRole('button', { name: /^A · IT/ });
    await user.hover(a);
    expect(onHoverAlias).toHaveBeenLastCalledWith('A');
    await user.unhover(a);
    expect(onHoverAlias).toHaveBeenLastCalledWith(null);
    await user.click(a);
    expect(onSelectAlias).toHaveBeenLastCalledWith('A', 'leon');
    rerender(<TierRows candidate={leon!} traced={false} selectedAlias="A" onSelectAlias={onSelectAlias} hoveredAlias={null} onHoverAlias={onHoverAlias} />);
    expect(screen.getByRole('button', { name: /^A · IT/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /^A · IT/ }));
    expect(onSelectAlias).toHaveBeenLastCalledWith(null, 'leon');
    unmount();

    // focus reports too (keyboard users light the shared handles as well); a fresh mock so hover and click cannot satisfy it
    const onFocusHover = vi.fn();
    mount(leon!, { onHoverAlias: onFocusHover });
    const handle = screen.getByRole('button', { name: /^A · IT/ });
    fireEvent.focus(handle);
    expect(onFocusHover).toHaveBeenLastCalledWith('A');
    fireEvent.blur(handle);
    expect(onFocusHover).toHaveBeenLastCalledWith(null);
  });

  it('lights every handle of the hovered alias across cards, and only those (Review Focus 3: Vetta is moderate under León, unbanded under Mekong)', () => {
    render(
      <>
        <TierRows candidate={leon!} traced={false} selectedAlias={null} onSelectAlias={vi.fn()} hoveredAlias="A" onHoverAlias={vi.fn()} />
        <TierRows candidate={mekong!} traced={false} selectedAlias={null} onSelectAlias={vi.fn()} hoveredAlias="A" onHoverAlias={vi.fn()} />
      </>,
    );
    const aHandles = screen.getAllByRole('button', { name: /^A · IT · Dyes/ });
    expect(aHandles).toHaveLength(2);
    for (const h of aHandles) {
      expect(h).toHaveAttribute('data-lit', 'true');
      expect(h.style.boxShadow).toBe('0 0 0 2px var(--sm-teal)');
    }
    expect(aHandles[0]).toHaveAttribute('data-anchor', 'leon/A');
    expect(aHandles[1]).toHaveAttribute('data-anchor', 'mekong/A');
    // each card shows its own option's band for the shared node
    expect(within(aHandles[0]!).getByRole('img', { name: 'moderate' })).toBeInTheDocument();
    expect(within(aHandles[1]!).queryByRole('img')).toBeNull();
    for (const other of screen.getAllByRole('button', { name: /^(B|C|F) ·/ })) {
      expect(other).not.toHaveAttribute('data-lit');
      expect(other.style.boxShadow).toBe('');
    }
  });

  it('marks the traced card’s binding node with ● and says "Binding for N options" when it binds more than one; an untraced card shows no marker (spec §12.3)', () => {
    const traced = mount(leon!, { traced: true });
    const a = screen.getByRole('button', { name: /^A · IT · Dyes/ });
    const marker = within(a).getByRole('img', { name: 'binding' });
    expect(marker).toHaveTextContent(String.fromCharCode(0x25cf));
    expect(screen.queryByText(/^Binding for/)).toBeNull();
    traced.unmount();
    const bindsTwo: SmCandidateResult2 = { ...leon!, trace: { ...leon!.trace!, nodes: [{ ...leon!.trace!.nodes[0]!, binds_for: 2 }] } };
    const two = mount(bindsTwo, { traced: true });
    expect(screen.getByText('Binding for 2 options')).toBeInTheDocument();
    two.unmount();
    const inherited: SmCandidateResult2 = { ...leon!, trace: { nodes: [{ alias: 'A', tier: 2, role: 'inherited', band: 'moderate', binds_for: 1 }, { alias: 'C', tier: 3, role: 'binding', band: 'severe', binds_for: 1 }], edges: [{ parent: 'leon', child: 'A', band: 'moderate' }, { parent: 'A', child: 'C', band: 'severe' }], gaps: [] } };
    const deep = mount(inherited, { traced: true });
    expect(within(screen.getByRole('button', { name: /^A · IT/ })).getByRole('img', { name: 'inherited' })).toHaveTextContent(String.fromCharCode(0x25cb));
    expect(within(screen.getByRole('button', { name: /^C · IN/ })).getByRole('img', { name: 'binding' })).toBeInTheDocument();
    deep.unmount();
    mount(leon!, { traced: false });
    expect(screen.queryByRole('img', { name: 'binding' })).toBeNull();
  });
});
