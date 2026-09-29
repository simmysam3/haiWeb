import { fireEvent, screen, within } from '@testing-library/react';

/**
 * Test helper: what a user does to add a hand-entered line since Add line asks in a dialog (owner's walk,
 * 2026-09-29). The class is put off, so no request is made; the row lands in the grid, editable in place.
 */
export function addLineThroughDialog(component: string, uom?: string): void {
  fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
  const dialog = screen.getByRole('dialog', { name: 'Add a BOM line' });
  fireEvent.change(within(dialog).getByLabelText('Component'), { target: { value: component } });
  if (uom !== undefined) fireEvent.change(within(dialog).getByLabelText('UoM'), { target: { value: uom } });
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Decide the class later' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add line' }));
}
