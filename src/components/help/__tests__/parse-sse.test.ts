// src/components/help/__tests__/parse-sse.test.ts
import { describe, it, expect } from 'vitest';
import { createSseParser, type SseEvent } from '../parse-sse';

function collect(chunks: string[], end = true): SseEvent[] {
  const out: SseEvent[] = [];
  const p = createSseParser((e) => out.push(e));
  for (const c of chunks) p.push(c);
  if (end) p.end();
  return out;
}

describe('createSseParser', () => {
  it('parses one event', () => {
    expect(collect(['event: delta\ndata: {"text":"hi"}\n\n'])).toEqual([{ event: 'delta', data: '{"text":"hi"}' }]);
  });

  it('parses several events in one chunk, in order', () => {
    expect(collect(['event: meta\ndata: {}\n\nevent: delta\ndata: {"text":"a"}\n\nevent: done\ndata: {}\n\n']).map((e) => e.event)).toEqual([
      'meta',
      'delta',
      'done',
    ]);
  });

  it('reassembles an event split mid-field and mid-JSON across chunks', () => {
    expect(collect(['ev', 'ent: del', 'ta\nda', 'ta: {"te', 'xt":"hello"}\n', '\n'])).toEqual([{ event: 'delta', data: '{"text":"hello"}' }]);
  });

  it('ignores heartbeat comments', () => {
    expect(collect([': ping\n\nevent: delta\ndata: {"text":"x"}\n\n: ping\n\n'])).toEqual([{ event: 'delta', data: '{"text":"x"}' }]);
  });

  it('accepts CRLF line endings, including a CRLF split across chunks', () => {
    expect(collect(['event: delta\r', '\ndata: {"text":"y"}\r\n\r\n'])).toEqual([{ event: 'delta', data: '{"text":"y"}' }]);
  });

  it('joins multiple data lines with \\n and defaults the event name to message', () => {
    expect(collect(['data: line one\ndata: line two\n\n'])).toEqual([{ event: 'message', data: 'line one\nline two' }]);
  });

  it('forgets the event name at every blank line, so it never carries over to the next event', () => {
    expect(collect(['event: delta\ndata: a\n\ndata: b\n\nevent: meta\n\ndata: c\n\n'])).toEqual([
      { event: 'delta', data: 'a' },
      { event: 'message', data: 'b' },
      { event: 'message', data: 'c' },
    ]);
  });

  it('strips exactly one space after the colon', () => {
    expect(collect(['data:  two spaces\n\n'])).toEqual([{ event: 'message', data: ' two spaces' }]);
  });

  it('discards an unterminated event at end of stream', () => {
    expect(collect(['event: done\ndata: {"partial":'])).toEqual([]);
  });

  it.each<{ what: string; before: string; after: string; expected: SseEvent[] }>([
    { what: 'a line not yet ended', before: 'data: x', after: '\n\n', expected: [] },
    { what: 'an event name', before: 'event: done\n', after: 'data: y\n\n', expected: [{ event: 'message', data: 'y' }] },
    { what: 'a data line', before: 'data: x\n', after: '\n', expected: [] },
  ])('end() discards $what, so nothing of it reaches a later push', ({ before, after, expected }) => {
    const out: SseEvent[] = [];
    const p = createSseParser((e) => out.push(e));
    p.push(before);
    p.end();
    p.push(after);
    expect(out).toEqual(expected);
  });

  it('dispatches nothing for an event with no data lines', () => {
    expect(collect(['event: meta\n\n'])).toEqual([]);
  });

  it('reads a line with no colon as a field name with an empty value', () => {
    expect(collect(['data\n\n'])).toEqual([{ event: 'message', data: '' }]);
  });

  it('accepts a lone CR as a line ending', () => {
    expect(collect(['data: a\r\rdata: b\n\n'])).toEqual([
      { event: 'message', data: 'a' },
      { event: 'message', data: 'b' },
    ]);
  });

  it('keeps the whole value when no space follows the colon', () => {
    expect(collect(['event:delta\ndata:{"text":"z"}\n\n'])).toEqual([{ event: 'delta', data: '{"text":"z"}' }]);
  });

  it('ignores a field that is neither event nor data', () => {
    expect(collect(['id: 7\nretry: 3000\nevent: delta\ndata: x\n\n'])).toEqual([{ event: 'delta', data: 'x' }]);
  });

  it.each<[string, string, SseEvent[]]>([
    ['a line of spaces is a field line, not a blank line', 'data: a\n \ndata: b\n\n', [{ event: 'message', data: 'a\nb' }]],
    ['the event name is kept as written, a trailing space included', 'event: delta \ndata: x\n\n', [{ event: 'delta ', data: 'x' }]],
    ['the last event line of a block wins', 'event: a\nevent: b\ndata: x\n\n', [{ event: 'b', data: 'x' }]],
    ['a data value keeps its trailing space', 'data: x \n\n', [{ event: 'message', data: 'x ' }]],
    ['a field name is not trimmed, so " data" is not data', ' data: x\n\n', []],
    ['field names are matched whole and in lower case', 'Event: a\nevents: b\nData: 1\ndatax: 2\ndata: x\n\n', [{ event: 'message', data: 'x' }]],
    ['a tab after the colon is part of the value: only a space is stripped', 'data:\tx\n\n', [{ event: 'message', data: '\tx' }]],
    [
      'a comment line inside an event is ignored: it neither dispatches nor clears what the event holds',
      'event: delta\ndata: a\n: note\ndata: b\n\n',
      [{ event: 'delta', data: 'a\nb' }],
    ],
    [
      'only CR and LF end a line: U+2028, U+2029, U+0085, form feed and vertical tab stay inside the value',
      'event: delta\ndata: {"text":"a\u2028b\u2029c\u0085d\fe\vf"}\n\n',
      [{ event: 'delta', data: '{"text":"a\u2028b\u2029c\u0085d\fe\vf"}' }],
    ],
    ['empty data lines are kept in the join, in the middle and at the end', 'data: a\ndata:\ndata: b\ndata\n\n', [{ event: 'message', data: 'a\n\nb\n' }]],
  ])('%s', (_rule, stream, expected) => {
    expect(collect([stream])).toEqual(expected);
  });
});
