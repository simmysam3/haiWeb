// src/components/help/__tests__/help-composer.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { HelpComposer } from '../help-composer';

function renderComposer(props: Partial<ComponentProps<typeof HelpComposer>> = {}) {
  const onSend = vi.fn();
  const onStop = vi.fn();
  render(<HelpComposer language="en" streaming={false} onSend={onSend} onStop={onStop} {...props} />);
  // The box's accessible name is localized: the Korean case below renders '메시지', not 'Message'.
  return { onSend, onStop, box: screen.getByRole('textbox', { name: props.language === 'ko' ? '메시지' : 'Message' }) };
}

describe('HelpComposer', () => {
  it('Enter sends the trimmed text and clears the box', () => {
    const { onSend, box } = renderComposer();
    fireEvent.change(box, { target: { value: '  how do I deploy?  ' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('how do I deploy?');
    expect(box).toHaveValue('');
  });

  it('Shift+Enter does not send', () => {
    const { onSend, box } = renderComposer();
    fireEvent.change(box, { target: { value: 'line one' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('Enter while an IME composition is active does not send (Korean input)', () => {
    const { onSend, box } = renderComposer({ language: 'ko' });
    fireEvent.change(box, { target: { value: '배포' } });
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 229 });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('Send is disabled for blank input', () => {
    renderComposer();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('counts characters against the 16,000 cap', () => {
    const { box } = renderComposer();
    expect(box).toHaveAttribute('maxLength', '16000');
    fireEvent.change(box, { target: { value: 'abc' } });
    expect(screen.getByTestId('help-char-count')).toHaveTextContent('3 / 16000');
  });

  it('while streaming shows Stop instead of Send, and Enter does not send', () => {
    const { onSend, onStop, box } = renderComposer({ streaming: true });
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    fireEvent.change(box, { target: { value: 'next' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalled();
  });
});
