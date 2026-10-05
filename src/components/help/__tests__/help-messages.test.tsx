// src/components/help/__tests__/help-messages.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpMessages } from '../help-messages';
import type { HelpUiMessage } from '../help-storage';

const AMSG = 'c6e5d4b3-2a1f-4e0d-9c8b-7a6f5e4d3c2b';

function renderMessages(messages: HelpUiMessage[]) {
  const handlers = { onRetry: vi.fn(), onFeedback: vi.fn(), onSummarize: vi.fn() };
  render(<HelpMessages messages={messages} language="en" {...handlers} />);
  return handlers;
}

const user = (text: string, redactionCount?: number): HelpUiMessage => ({ id: 'u1', role: 'user', text, status: 'complete', redactionCount });
const reply = (over: Partial<HelpUiMessage>): HelpUiMessage => ({ id: 'a1', role: 'assistant', text: '', status: 'complete', ...over });

describe('HelpMessages', () => {
  it('shows the intro when there are no messages', () => {
    renderMessages([]);
    expect(screen.getByText(/Ask where to find something in the console/)).toBeInTheDocument();
  });

  it('shows the user text and the masked-secrets line', () => {
    renderMessages([user('KEY=‹redacted›', 2)]);
    expect(screen.getByText('KEY=‹redacted›')).toBeInTheDocument();
    expect(screen.getByText('Secrets masked before sending: 2')).toBeInTheDocument();
  });

  it('shows Thinking… for an empty streaming answer, and Markdown once text arrives', () => {
    const { rerender } = render(<HelpMessages messages={[reply({ status: 'streaming' })]} language="en" onRetry={vi.fn()} onFeedback={vi.fn()} onSummarize={vi.fn()} />);
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
    rerender(<HelpMessages messages={[reply({ status: 'streaming', text: 'Run `npm ci`' })]} language="en" onRetry={vi.fn()} onFeedback={vi.fn()} onSummarize={vi.fn()} />);
    expect(screen.getByText('npm ci').tagName).toBe('CODE');
  });

  it('offers feedback only on completed answers that have a server id', () => {
    renderMessages([reply({ text: 'No id yet' })]);
    expect(screen.queryByRole('button', { name: 'Helpful' })).toBeNull();
  });

  it('withheld: the fixed sentence plus Summarize for support', () => {
    const h = renderMessages([reply({ status: 'withheld' })]);
    expect(screen.getByText("I can't help with that one.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Summarize for support' }));
    expect(h.onSummarize).toHaveBeenCalled();
  });

  it('error: says so and Retry calls onRetry with the answer id', () => {
    const h = renderMessages([user('q'), reply({ status: 'error' })]);
    expect(screen.getByText('Something went wrong — try again.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(h.onRetry).toHaveBeenCalledWith('a1');
  });

  it('interrupted: keeps the partial text, says so, offers Retry', () => {
    renderMessages([user('q'), reply({ status: 'interrupted', text: 'Partial answer' })]);
    expect(screen.getByText('Partial answer')).toBeInTheDocument();
    expect(screen.getByText('Interrupted — ask again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('thumbs-down sends at once, then the optional note; the pressed state follows the message', () => {
    const message = reply({ text: 'Answer', serverId: AMSG, feedback: 'down' });
    const h = renderMessages([message]);
    expect(screen.getByRole('button', { name: 'Not helpful' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Helpful' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Not helpful' }));
    expect(h.onFeedback).toHaveBeenCalledWith(message, 'down');
    fireEvent.change(screen.getByRole('textbox', { name: 'What was wrong? (optional)' }), { target: { value: 'Wrong page' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    expect(h.onFeedback).toHaveBeenLastCalledWith(message, 'down', 'Wrong page');
    expect(screen.getByText('Thanks for the feedback.')).toBeInTheDocument();
  });
});

// Implementer's pins (Task 3.8): listing lines that no case above drives, each red first.
describe('HelpMessages (implementer pins)', () => {
  it('a completed answer renders its Markdown', () => {
    renderMessages([reply({ text: 'Open **Agents**' })]);
    expect(screen.getByText('Agents').tagName).toBe('STRONG');
  });

  it('an errored answer keeps the text that arrived before the error', () => {
    renderMessages([user('q'), reply({ status: 'error', text: 'Half an answer' })]);
    expect(screen.getByText('Half an answer')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong — try again.')).toBeInTheDocument();
  });

  it('thumbs-up sends at once and closes an open note', () => {
    const message = reply({ text: 'Answer', serverId: AMSG });
    const h = renderMessages([message]);
    fireEvent.click(screen.getByRole('button', { name: 'Not helpful' }));
    expect(screen.getByRole('textbox', { name: 'What was wrong? (optional)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Helpful' }));
    expect(h.onFeedback).toHaveBeenLastCalledWith(message, 'up');
    expect(screen.queryByRole('textbox', { name: 'What was wrong? (optional)' })).toBeNull();
  });

  it('scrolls the end of the list into view whenever the messages change', () => {
    const original = Element.prototype.scrollIntoView; // jsdom has none; browsers do
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    try {
      const props = { language: 'en' as const, onRetry: vi.fn(), onFeedback: vi.fn(), onSummarize: vi.fn() };
      const { rerender } = render(<HelpMessages messages={[user('q')]} {...props} />);
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll).toHaveBeenLastCalledWith({ block: 'end' });
      expect(scroll.mock.contexts.at(-1)).toBe(screen.getByRole('list').lastElementChild);
      rerender(<HelpMessages messages={[user('q'), reply({ status: 'streaming' })]} {...props} />);
      expect(scroll).toHaveBeenCalledTimes(2);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('shows no masked-secrets line when nothing was masked', () => {
    renderMessages([user('plain question', 0)]);
    expect(screen.getByText('plain question')).toBeInTheDocument();
    expect(screen.queryByText(/Secrets masked before sending/)).toBeNull();
  });
});
