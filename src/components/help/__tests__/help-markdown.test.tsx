// src/components/help/__tests__/help-markdown.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { HelpMarkdown, parseHelpMarkdown } from '../help-markdown';

const md = (text: string) => render(<HelpMarkdown text={text} copyLabel="Copy" copiedLabel="Copied" />);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseHelpMarkdown', () => {
  it('splits headings, paragraphs, lists and fenced code', () => {
    expect(parseHelpMarkdown('# Fix\nFirst line\nsecond line\n\n- a\n- b\n\n2. two\n3. three\n\n```bash\ndocker build .\n```')).toEqual([
      { kind: 'heading', level: 1, text: 'Fix' },
      { kind: 'p', text: 'First line\nsecond line' },
      { kind: 'ul', items: ['a', 'b'] },
      { kind: 'ol', start: 2, items: ['two', 'three'] },
      { kind: 'code', lang: 'bash', code: 'docker build .' },
    ]);
  });

  it('treats an unclosed fence (answer still streaming) as code to the end', () => {
    expect(parseHelpMarkdown('Run:\n```\nnpm ci\nnpm run')).toEqual([
      { kind: 'p', text: 'Run:' },
      { kind: 'code', lang: '', code: 'npm ci\nnpm run' },
    ]);
  });

  it('caps heading depth at 3', () => {
    expect(parseHelpMarkdown('##### deep')).toEqual([{ kind: 'heading', level: 3, text: 'deep' }]);
  });

  it('reads CRLF and lone CR line endings as line breaks', () => {
    expect(parseHelpMarkdown('First\r\nsecond\rthird')).toEqual([{ kind: 'p', text: 'First\nsecond\nthird' }]);
  });

  it('ends a paragraph at a heading or a list item with no blank line between', () => {
    expect(parseHelpMarkdown('a\n# h\nb\n- c\nd\n1. e')).toEqual([
      { kind: 'p', text: 'a' },
      { kind: 'heading', level: 1, text: 'h' },
      { kind: 'p', text: 'b' },
      { kind: 'ul', items: ['c'] },
      { kind: 'p', text: 'd' },
      { kind: 'ol', start: 1, items: ['e'] },
    ]);
  });

  it('reads a fence whose language holds other characters, such as c#, as code', () => {
    expect(parseHelpMarkdown('```c#\nvar x = 1;\n# not a heading\n```\nThen restart the agent.')).toEqual([
      { kind: 'code', lang: 'c#', code: 'var x = 1;\n# not a heading' },
      { kind: 'p', text: 'Then restart the agent.' },
    ]);
  });

  it("takes the first word of a fence's info string as its language", () => {
    expect(
      parseHelpMarkdown('```bash title="setup.sh"\n# install\nnpm ci\n```\n\nThen open **Agents** and check the status.'),
    ).toEqual([
      { kind: 'code', lang: 'bash', code: '# install\nnpm ci' },
      { kind: 'p', text: 'Then open **Agents** and check the status.' },
    ]);
  });

  it.each<[string, string, ReturnType<typeof parseHelpMarkdown>]>([
    ['seven hashes as text, not a heading', '####### seven', [{ kind: 'p', text: '####### seven' }]],
    ['a hash with no space after it as text', '#tag', [{ kind: 'p', text: '#tag' }]],
    ['a heading without its trailing spaces', '## Title  ', [{ kind: 'heading', level: 2, text: 'Title' }]],
    ['* and + bullets as list items', '* a\n+ b', [{ kind: 'ul', items: ['a', 'b'] }]],
    ['an indented bullet as a list item', '  - a', [{ kind: 'ul', items: ['a'] }]],
    ['a dash with no space after it as text', '-a', [{ kind: 'p', text: '-a' }]],
    ['a number and a parenthesis as an ordered item', '1) a', [{ kind: 'ol', start: 1, items: ['a'] }]],
    ['an indented ordered item', '  2. b', [{ kind: 'ol', start: 2, items: ['b'] }]],
    ['a number with no space after the dot as text', '3.14 is pi', [{ kind: 'p', text: '3.14 is pi' }]],
    ['an indented fence with spaces after it', '  ```js  \nx\n  ```  ', [{ kind: 'code', lang: 'js', code: 'x' }]],
    ['a space between the fence and its language', '``` bash\nls\n```', [{ kind: 'code', lang: 'bash', code: 'ls' }]],
    ['a + in the fence language', '```c++\nx\n```', [{ kind: 'code', lang: 'c++', code: 'x' }]],
    ['a - in the fence language', '```shell-session\n$ ls\n```', [{ kind: 'code', lang: 'shell-session', code: '$ ls' }]],
    ['a . in the fence language', '```nginx.conf\nlisten 80;\n```', [{ kind: 'code', lang: 'nginx.conf', code: 'listen 80;' }]],
    ['a fence line with a language inside a code block as code', '```\n```js\n```', [{ kind: 'code', lang: '', code: '```js' }]],
    [
      'list lines at the left margin inside a code block as code',
      '```yaml\n- name: a\n1. b\n```\nMore.',
      [{ kind: 'code', lang: 'yaml', code: '- name: a\n1. b' }, { kind: 'p', text: 'More.' }],
    ],
    ['a line of spaces as the end of a paragraph', 'a\n   \nb', [{ kind: 'p', text: 'a' }, { kind: 'p', text: 'b' }]],
    [
      "a tab-indented fence's lines without the tab",
      '1. Run:\n\t```sh\n\tnpm ci\n\t```',
      [{ kind: 'ol', start: 1, items: ['Run:'] }, { kind: 'code', lang: 'sh', code: 'npm ci' }],
    ],
    [
      "a nested fence's lines keeping the indent beyond the fence's own",
      '1. Add:\n\n   ```yaml\n   services:\n     agent:\n       image: x\n   ```',
      [{ kind: 'ol', start: 1, items: ['Add:'] }, { kind: 'code', lang: 'yaml', code: 'services:\n  agent:\n    image: x' }],
    ],
    [
      'a fence nested under a sub-step, six columns in, without those six columns',
      '1. Step\n   1. Sub:\n\n      ```bash\n      EOF\n      ```',
      [{ kind: 'ol', start: 1, items: ['Step', 'Sub:'] }, { kind: 'code', lang: 'bash', code: 'EOF' }],
    ],
    [
      'a heredoc nested under step 10, four columns in, ending at its EOF',
      "10. Create the file:\n\n    ```bash\n    cat > .env <<'EOF'\n    AGENT_ID=agent-1\n    EOF\n    ```\n11. Restart.",
      [
        { kind: 'ol', start: 10, items: ['Create the file:'] },
        { kind: 'code', lang: 'bash', code: "cat > .env <<'EOF'\nAGENT_ID=agent-1\nEOF" },
        { kind: 'ol', start: 11, items: ['Restart.'] },
      ],
    ],
    [
      "a fence on a bullet's own line keeping the indent beyond the bullet's text column",
      '- ```yaml\n  services:\n    agent: x\n  ```',
      [{ kind: 'ul', items: [''] }, { kind: 'code', lang: 'yaml', code: 'services:\n  agent: x' }],
    ],
    ['a number with no dot or parenthesis after it as text', '2 replicas are needed', [{ kind: 'p', text: '2 replicas are needed' }]],
    ['a tab after the hashes as a heading', '#\tTitle', [{ kind: 'heading', level: 1, text: 'Title' }]],
    ['a code line indented less than its fence without the indent it has', '   ```\n   a\n b\n   ```', [{ kind: 'code', lang: '', code: 'a\nb' }]],
    ['a fence language ended by a tab', '```bash\ttitle="x"\nls\n```', [{ kind: 'code', lang: 'bash', code: 'ls' }]],
    ['the indentation inside a code block', '```yaml\nservices:\n  agent:\n    image: x\n```', [{ kind: 'code', lang: 'yaml', code: 'services:\n  agent:\n    image: x' }]],
    ['a two-digit ordered item number', '10. ten\n11. eleven', [{ kind: 'ol', start: 10, items: ['ten', 'eleven'] }]],
    ['a number and a dot inside a line as text', 'Use version 2. Then restart.', [{ kind: 'p', text: 'Use version 2. Then restart.' }]],
    ['a line that starts with three backticks and holds more as text', '```npm ci``` runs it', [{ kind: 'p', text: '```npm ci``` runs it' }]],
    ['three backticks at the end of a line as text', 'see ```', [{ kind: 'p', text: 'see ```' }]],
    ['three backticks at the end of a code line as code', '```\necho ```\nx\n```', [{ kind: 'code', lang: '', code: 'echo ```\nx' }]],
    [
      'a fence with a language right after a paragraph line as a code block',
      'Run:\n```bash\nnpm ci\n```',
      [{ kind: 'p', text: 'Run:' }, { kind: 'code', lang: 'bash', code: 'npm ci' }],
    ],
    ['a heading marker with no title yet (streaming) as text', '## ', [{ kind: 'p', text: '## ' }]],
    ['an ordered marker with no text yet (streaming) as an empty item', '1. ', [{ kind: 'ol', start: 1, items: [''] }]],
    ['a bullet with no text yet (streaming) as an empty item', '- ', [{ kind: 'ul', items: [''] }]],
  ])('reads %s', (_name, source, expected) => {
    expect(parseHelpMarkdown(source)).toEqual(expected);
  });
});

// `\s` takes U+2028 and U+2029 and `.` does not, so a block pattern with a `.` tail retried every split of a
// long run of spaces before one of them (quadratic), and the answer is parsed again on every streamed delta.
// Each pin times one whole parse at 64,000 spaces: over 4 s with the `.` tails, under 1 ms without them; the
// bound leaves room for a loaded machine.
describe('parseHelpMarkdown in linear time on a run of spaces before U+2028 or U+2029', () => {
  const spaces = ' '.repeat(64_000);
  const BOUND_MS = 250;
  const parseTimed = (source: string) => {
    const start = performance.now();
    const blocks = parseHelpMarkdown(source);
    return { ms: performance.now() - start, blocks };
  };

  it('reads a heading line', () => {
    for (const separator of ['\u2028', '\u2029']) {
      const { ms, blocks } = parseTimed(`#${spaces}a${separator}`);
      expect(ms).toBeLessThan(BOUND_MS);
      expect(blocks).toEqual([{ kind: 'heading', level: 1, text: 'a' }]);
    }
  }, 30_000);

  it('reads a bullet line', () => {
    for (const separator of ['\u2028', '\u2029']) {
      const { ms, blocks } = parseTimed(`-${spaces}a${separator}`);
      expect(ms).toBeLessThan(BOUND_MS);
      expect(blocks).toEqual([{ kind: 'ul', items: [`a${separator}`] }]);
    }
  }, 30_000);

  it('reads an ordered item line', () => {
    for (const separator of ['\u2028', '\u2029']) {
      const { ms, blocks } = parseTimed(`1.${spaces}a${separator}`);
      expect(ms).toBeLessThan(BOUND_MS);
      expect(blocks).toEqual([{ kind: 'ol', start: 1, items: [`a${separator}`] }]);
    }
  }, 30_000);
});

describe('HelpMarkdown', () => {
  it('renders headings, list items and paragraph line breaks', () => {
    const { container } = md('## Fix it\n- one\n- two\n\nline a\nline b');
    expect(screen.getByRole('heading', { name: 'Fix it' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['one', 'two']);
    expect(container.querySelector('p br')).not.toBeNull();
  });

  it('renders heading levels 1 to 3 as h3 to h5, below the panel title', () => {
    md('# One\n## Two\n### Three');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('One');
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Two');
    expect(screen.getByRole('heading', { level: 5 })).toHaveTextContent('Three');
  });

  it('renders an ordered list from its first number', () => {
    const { container } = md('3. three\n4. four');
    expect(container.querySelector('ol')).toHaveAttribute('start', '3');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['three', 'four']);
  });

  it('renders inline code, bold and italics', () => {
    const { container } = md('Set `NODE_ENV` to **production**, *not* _dev_.');
    expect(container.querySelector('code')).toHaveTextContent('NODE_ENV');
    expect(container.querySelector('strong')).toHaveTextContent('production');
    expect([...container.querySelectorAll('em')].map((e) => e.textContent)).toEqual(['not', 'dev']);
  });

  it('shows exactly the text between the backticks of each inline code span', () => {
    const { container } = md('Set `NODE_ENV` and `PORT` now');
    expect([...container.querySelectorAll('code')].map((c) => c.textContent)).toEqual(['NODE_ENV', 'PORT']);
  });

  it('shows exactly the text between the ** of bold', () => {
    const { container } = md('to **production** now');
    expect(container.querySelector('strong')?.textContent).toBe('production');
    expect(container.querySelector('p')?.textContent).toBe('to production now');
  });

  it('puts one line break between the lines of a paragraph and none before the first', () => {
    const { container } = md('line a\nline b');
    expect(container.querySelector('p')?.innerHTML).toBe('line a<br>line b');
  });

  it('shows markup inside inline code as written', () => {
    const { container } = md('Type `**not bold**` here.');
    expect(container.querySelector('code')).toHaveTextContent('**not bold**');
    expect(container.querySelector('strong')).toBeNull();
  });

  it('renders inline markup inside headings and list items', () => {
    const { container } = md('## **Bold** head\n- `code` item\n1. *em* item');
    expect(container.querySelector('h4 strong')).toHaveTextContent('Bold');
    expect(container.querySelector('ul li code')).toHaveTextContent('code');
    expect(container.querySelector('ol li em')).toHaveTextContent('em');
  });

  it('leaves snake_case identifiers and arithmetic alone', () => {
    const { container } = md('Set HAIWAVE_CENTRAL_CLIENT_ID and KEYCLOAK_CLIENT_SECRET; 2 * 3 * 4.');
    expect(container.querySelector('em')).toBeNull();
    expect(container).toHaveTextContent('Set HAIWAVE_CENTRAL_CLIENT_ID and KEYCLOAK_CLIENT_SECRET; 2 * 3 * 4.');
  });

  it.each([
    ['a * after a letter', 'x*y* z'],
    ['a * after another *', '**a*'],
    ['a closing * before a letter', 'x *b*c'],
    ['a closing * before another *', 'x *a** y'],
    ['a * followed by a space', 'x * a* y'],
    ['a closing * after a space', 'x *a * y'],
    ['** after a letter', 'x**b** y'],
    ['** after a *', '***b**'],
    ['** followed by a space', 'x ** b** y'],
    ['a closing ** after a space', 'x **b ** y'],
    ['a closing ** before a letter', '**b**c'],
    ['a closing ** before a *', '**b***'],
    ['an _ after a letter', 'file_name_ here'],
    ['a closing _ before a letter', 'see _config_file'],
    ['an _ followed by a space', 'x _ a_ y'],
    ['a closing _ after a space', 'x _a _ y'],
    ['an empty pair of backticks', 'run `` here'],
    ['a link with an empty label', 'see [](https://haiwave.ai) here'],
    ['a link whose address holds a space', 'see [a](https://haiwave.ai/x y) here'],
    ['a link whose address holds a ]', 'see [a](https://x]y) here'],
    ['a link whose address holds a [', 'see [a](https://x[y) here'],
    ['a link whose label holds a ]', 'see [a]b](https://x) here'],
    ['a link with an empty address', 'see [a]() here'],
  ])('leaves %s as plain text', (_name, text) => {
    const { container } = md(text);
    const p = container.querySelector('p');
    expect(p?.children).toHaveLength(0);
    expect(p?.textContent).toBe(text);
  });

  it('links http(s) only, opening safely in a new tab', () => {
    md('See [the guide](https://haiwave.ai/guide).');
    const a = screen.getByRole('link', { name: 'the guide' });
    expect(a).toHaveAttribute('href', 'https://haiwave.ai/guide');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    expect(a).toHaveAttribute('target', '_blank');
  });

  it('never links other schemes', () => {
    const { container } = md('[click](javascript:alert(1)) [mail](mailto:x@y.z) [data](data:text/html,hi)');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(container).toHaveTextContent('click');
    expect(container.innerHTML).not.toContain('javascript:');
  });

  it('links from the last [ of a run, and shows the earlier ones as text', () => {
    const { container } = md('[[a](https://x)');
    const p = container.querySelector('p');
    expect(p?.childNodes).toHaveLength(2);
    expect(p?.firstChild?.textContent).toBe('[');
    expect(screen.getByRole('link', { name: 'a' })).toHaveAttribute('href', 'https://x');
  });

  it('ends a link address at a [, so an unclosed link before a good one stays text', () => {
    const { container } = md('[a](https://x[b](https://y)');
    const p = container.querySelector('p');
    expect(p?.childNodes).toHaveLength(2);
    expect(p?.firstChild?.textContent).toBe('[a](https://x');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'b' })).toHaveAttribute('href', 'https://y');
  });

  it.each([
    ['http', 'http://haiwave.ai/guide'],
    ['an upper-case scheme', 'HTTPS://HAIWAVE.AI/GUIDE'],
  ])('links an address with %s', (_name, href) => {
    md(`See [the guide](${href}).`);
    expect(screen.getByRole('link', { name: 'the guide' })).toHaveAttribute('href', href);
  });

  it.each([
    ['a protocol-relative address', '//evil.example/x'],
    ['a relative path', '/account/agents'],
    ['a javascript: address that holds https:// later', 'javascript://https://haiwave.ai'],
    ['a scheme with no host', 'https://'],
  ])('never links %s', (_name, href) => {
    const { container } = md(`See [the guide](${href}).`);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(container).toHaveTextContent('See the guide.');
    expect(container.innerHTML).not.toContain(href);
  });

  it('shows raw HTML as text and creates no elements from it', () => {
    const { container } = md('<script>alert(1)</script><img src=x onerror=alert(1)>');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('<script>alert(1)</script>');
  });

  it('copies a code block verbatim and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    md('```env\nHAIWAVE_CENTRAL_CLIENT_ID=abc\nAGENT_ID=agent-1\n```');
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('HAIWAVE_CENTRAL_CLIENT_ID=abc\nAGENT_ID=agent-1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument());
  });

  it('makes Copy a plain button, so a click never submits a form around the answer', () => {
    md('```\nnpm ci\n```');
    expect(screen.getByRole('button', { name: 'Copy' })).toHaveAttribute('type', 'button');
  });

  it("drops the fence's own indent from a block nested under a numbered step, on screen and in Copy", async () => {
    const source = "1. Create the file:\n\n   ```bash\n   cat > .env <<'EOF'\n   AGENT_ID=agent-1\n   EOF\n   ```\n2. Restart the agent.";
    const code = "cat > .env <<'EOF'\nAGENT_ID=agent-1\nEOF";
    expect(parseHelpMarkdown(source)).toEqual([
      { kind: 'ol', start: 1, items: ['Create the file:'] },
      { kind: 'code', lang: 'bash', code },
      { kind: 'ol', start: 2, items: ['Restart the agent.'] },
    ]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { container } = md(source);
    expect(container.querySelector('pre code')?.textContent).toBe(code);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await act(async () => {});
    expect(writeText).toHaveBeenCalledWith(code);
  });

  it("reads a fence opened on a numbered step's own line as that step's code block, and goes on after it", async () => {
    const source = '1. ```bash\n   npm ci\n   ```\n2. Restart the agent.\n\n## Next\nMore.';
    expect(parseHelpMarkdown(source)).toEqual([
      { kind: 'ol', start: 1, items: [''] },
      { kind: 'code', lang: 'bash', code: 'npm ci' },
      { kind: 'ol', start: 2, items: ['Restart the agent.'] },
      { kind: 'heading', level: 2, text: 'Next' },
      { kind: 'p', text: 'More.' },
    ]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { container } = md(source);
    expect(container.querySelector('pre code')?.textContent).toBe('npm ci');
    expect(screen.getByRole('heading', { name: 'Next' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await act(async () => {});
    expect(writeText).toHaveBeenCalledWith('npm ci');
  });

  it("reads a fence opened on a bullet's own line as that bullet's code block, and goes on after it", () => {
    expect(parseHelpMarkdown('- ```bash\n  npm ci\n  ```\n- Restart the agent.\n\nThen open **Agents**.')).toEqual([
      { kind: 'ul', items: [''] },
      { kind: 'code', lang: 'bash', code: 'npm ci' },
      { kind: 'ul', items: ['Restart the agent.'] },
      { kind: 'p', text: 'Then open **Agents**.' },
    ]);
  });

  it("keeps a code line that looks like a list item in the code block a list item's fence opened", () => {
    expect(parseHelpMarkdown('- ```yaml\n  - name: agent\n  ```')).toEqual([
      { kind: 'ul', items: [''] },
      { kind: 'code', lang: 'yaml', code: '- name: agent' },
    ]);
    expect(parseHelpMarkdown('1. ```text\n   2. not a step\n   ```')).toEqual([
      { kind: 'ol', start: 1, items: [''] },
      { kind: 'code', lang: 'text', code: '2. not a step' },
    ]);
  });

  it("ends an unclosed fence opened on a numbered step's own line at the next step, and goes on after it", () => {
    const source = '1. ```bash\n   npm ci\n2. Restart.\n\n## Next\nMore.';
    expect(parseHelpMarkdown(source)).toEqual([
      { kind: 'ol', start: 1, items: [''] },
      { kind: 'code', lang: 'bash', code: 'npm ci' },
      { kind: 'ol', start: 2, items: ['Restart.'] },
      { kind: 'heading', level: 2, text: 'Next' },
      { kind: 'p', text: 'More.' },
    ]);
    const { container } = md(source);
    expect(container.querySelectorAll('pre')).toHaveLength(1);
    expect(container.querySelector('pre code')?.textContent).toBe('npm ci');
    expect([...container.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['', 'Restart.']);
    expect(screen.getByRole('heading', { name: 'Next' })).toBeInTheDocument();
    expect(container.querySelector('p')?.textContent).toBe('More.');
  });

  it("ends an unclosed fence opened on a bullet's own line at the next bullet, and goes on after it", () => {
    expect(parseHelpMarkdown('- ```bash\n  npm ci\n- Restart the agent.\n\nThen open **Agents**.')).toEqual([
      { kind: 'ul', items: [''] },
      { kind: 'code', lang: 'bash', code: 'npm ci' },
      { kind: 'ul', items: ['Restart the agent.'] },
      { kind: 'p', text: 'Then open **Agents**.' },
    ]);
  });

  it('shows and copies the indentation inside a code block as written', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { container } = md('```\n  indented\n```');
    expect(container.querySelector('pre code')?.textContent).toBe('  indented');
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await act(async () => {});
    expect(writeText).toHaveBeenCalledWith('  indented');
  });

  it("tags a code block with its fence's language, and a bare fence with none", () => {
    const { container } = md('```env\nAGENT_ID=agent-1\n```\n\n```\nplain\n```');
    const codes = [...container.querySelectorAll('pre code')];
    expect(codes.map((c) => c.textContent)).toEqual(['AGENT_ID=agent-1', 'plain']);
    expect(codes[0]).toHaveAttribute('data-lang', 'env');
    expect(codes[1]).not.toHaveAttribute('data-lang');
  });

  it('returns to the copy label 1.5 s after a copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.useFakeTimers();
    try {
      md('```\nnpm ci\n```');
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
      await act(async () => {});
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1499));
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays on the copy label, with no unhandled rejection, when the clipboard refuses', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    md('```\nnpm ci\n```');
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await act(async () => {});
    expect(writeText).toHaveBeenCalledWith('npm ci');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('does nothing, and throws nothing, when the browser has no clipboard', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    md('```\nnpm ci\n```');
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });
});
