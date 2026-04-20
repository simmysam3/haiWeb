import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer } from '../drawer';

describe('Drawer', () => {
  it('renders title and children when open', () => {
    render(
      <Drawer open={true} onClose={() => {}} title="Details">
        <p>hello</p>
      </Drawer>,
    );
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Drawer open={false} onClose={() => {}} title="Details">
        body
      </Drawer>,
    );
    expect(screen.queryByText('Details')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Drawer open={true} onClose={onClose} title="T">
        x
      </Drawer>,
    );
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Drawer open={true} onClose={onClose} title="T">
        x
      </Drawer>,
    );
    // overlay has role=presentation or is just a div; find by aria-hidden="true"
    const overlay = screen.getByTestId('drawer-overlay');
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies custom width class when provided', () => {
    render(
      <Drawer open={true} onClose={() => {}} title="T" width="max-w-3xl">
        x
      </Drawer>,
    );
    const panel = screen.getByRole('dialog').querySelector('aside');
    expect(panel?.className).toContain('max-w-3xl');
  });
});
