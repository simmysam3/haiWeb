import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnswerForMyselfOnly } from '../_components/answer-for-myself-only';

const LABEL =
  "Answer for myself only — Sourcing Map runs don't go below you; your suppliers are never probed through you.";
const SETTING_URL = '/api/account/settings/sourcing-map-setting';

describe('AnswerForMyselfOnly', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ answer_for_myself_only: true }), { status: 200 }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('toggling on sends one PUT with the new value and the box is checked', async () => {
    render(<AnswerForMyselfOnly initial={false} />);
    const box = screen.getByRole('switch', { name: LABEL });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SETTING_URL);
    expect(init.method).toBe('PUT');
    expect(init.body).toBe('{"answer_for_myself_only":true}');
    await waitFor(() => expect(box).toBeChecked());
  });

  it('a 500 reverts the box and says the setting is unchanged', async () => {
    fetchSpy.mockResolvedValue(new Response('{}', { status: 500 }));
    render(<AnswerForMyselfOnly initial={false} />);
    const box = screen.getByRole('switch', { name: LABEL });
    fireEvent.click(box);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/^Couldn't save — the setting is unchanged\.$/);
    expect(box).not.toBeChecked();
  });

  it('two clicks while the PUT is held send one PUT', async () => {
    let release: (r: Response) => void = () => {};
    fetchSpy.mockReturnValue(new Promise<Response>((resolve) => (release = resolve)));
    render(<AnswerForMyselfOnly initial={false} />);
    const box = screen.getByRole('switch', { name: LABEL });
    const user = userEvent.setup();
    await user.click(box);
    await waitFor(() => expect(box).toBeDisabled());
    await user.click(box);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    release(new Response('{"answer_for_myself_only":true}', { status: 200 }));
    await waitFor(() => expect(box).toBeEnabled());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('initial null disables the box with the load line and no alert', () => {
    render(<AnswerForMyselfOnly initial={null} />);
    expect(screen.getByRole('switch', { name: LABEL })).toBeDisabled();
    expect(screen.getByText("Couldn't load the setting.").tagName).toBe('P');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it("after an ok save the box takes the server's answer, not the sent value", async () => {
    fetchSpy.mockResolvedValue(new Response('{"answer_for_myself_only":false}', { status: 200 }));
    render(<AnswerForMyselfOnly initial={false} />);
    const box = screen.getByRole('switch', { name: LABEL });
    fireEvent.click(box);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(box).toBeEnabled());
    expect(box).not.toBeChecked();
  });

  it('initial true renders the box checked and enabled', () => {
    render(<AnswerForMyselfOnly initial={true} />);
    const box = screen.getByRole('switch', { name: LABEL });
    expect(box).toBeChecked();
    expect(box).toBeEnabled();
  });
});
