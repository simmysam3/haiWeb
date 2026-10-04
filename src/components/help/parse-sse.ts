// src/components/help/parse-sse.ts
export interface SseEvent {
  event: string;
  data: string;
}

export interface SseParser {
  push(chunk: string): void;
  end(): void;
}

/** Incremental text/event-stream parser (WHATWG rules used by contract C.3). */
export function createSseParser(onEvent: (e: SseEvent) => void): SseParser {
  let buffer = '';
  let eventName = '';
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length > 0) onEvent({ event: eventName || 'message', data: dataLines.join('\n') });
    eventName = '';
    dataLines = [];
  };

  const processLine = (line: string) => {
    if (line === '') {
      dispatch();
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') eventName = value;
    else if (field === 'data') dataLines.push(value);
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      for (;;) {
        const at = buffer.search(/\r\n|\r|\n/);
        if (at === -1) return;
        // A trailing lone '\r' may be the first half of a '\r\n' split across chunks.
        if (buffer[at] === '\r' && at + 1 === buffer.length) return;
        const width = buffer[at] === '\r' && buffer[at + 1] === '\n' ? 2 : 1;
        const line = buffer.slice(0, at);
        buffer = buffer.slice(at + width);
        processLine(line);
      }
    },
    end() {
      // An event not closed by a blank line is incomplete: discard it.
      buffer = '';
      eventName = '';
      dataLines = [];
    },
  };
}
