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

  it('reads "—" for a missing country or class', () => {
    const bare: SmCandidateResult2 = { ...leon!, nodes: [{ alias: 'A', tier: 2, country: null, class: null, band: 'slight', observed_below: true }] };
    mount(bare);
    expect(screen.getByRole('button', { name: /^A · — · —/ })).toBeInTheDocument();
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
});
