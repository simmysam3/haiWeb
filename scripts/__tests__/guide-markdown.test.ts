// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUIDE_CODE_LINE_MAX, parseGuideSource, guideMarkdownToHtml, verifyGuideHtml } from '../guide-markdown.mjs';

/** The message a call is refused with, or a text that says it was not refused. */
const refusalOf = (run: () => unknown): string => {
  try {
    run();
  } catch (err) {
    return err instanceof Error ? err.message : `thrown, but not an Error: ${String(err)}`;
  }
  return 'not refused';
};
/** Matches a message that begins with `text`: every refusal begins with the guide's line number. */
const beginning = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

describe('GUIDE_CODE_LINE_MAX', () => {
  // The print template fits 97 characters of code on one line and wraps the 98th: 96 leaves one character of margin.
  it('is 96', () => {
    expect(GUIDE_CODE_LINE_MAX).toBe(96);
  });

  it('refuses a code line one character longer than the limit, and says the length and the limit', () => {
    const tooLong = 'x'.repeat(GUIDE_CODE_LINE_MAX + 1);
    expect(refusalOf(() => guideMarkdownToHtml(['```', 'short', tooLong, '```'].join('\n'), { firstLine: 101 }))).toMatch(
      beginning('guide line 103: a code line of 97 characters. The limit is 96'),
    );
  });

  it('converts a code line of exactly the limit', () => {
    const longest = 'x'.repeat(GUIDE_CODE_LINE_MAX);
    expect(guideMarkdownToHtml(['```', longest, '```'].join('\n'))).toBe(`<pre><code>${longest}\n</code></pre>\n`);
  });
});

/**
 * A guide source in the real file's form: the header comment with its labelled lines and the note for the designer
 * (the note's cover line wrapped onto a second line), the three cover lines, then the body. The line numbers beside
 * the lines are what the refusals name.
 */
const HEADER = [
  '<!--', // 1
  '  SOURCE OF RECORD: Free Agent SCM: Sample Administration Notesheets', // 2
  '  Version: 1.104.0', // 3
  '  Dated:    2026-10-06', // 4
  '  Maps to:  Platform level v1.104 (agent release 1.104.0).', // 5
  '', // 6
  '  For the designer: title "Free Agent SCM: Sample Administration Notesheets"; cover line', // 7
  '  "Sample Administration Notes · Version 1.104.0 (platform level v1.104) · CONFIDENTIAL"; edition date = the', // 8
  '  Dated line there; logo = docs/haiwave-logo.png (the sole image).', // 9
  '-->', // 10
];
const COVER = [
  '', // 11
  '![HAIWAVE](haiwave-logo.png)', // 12
  '', // 13
  '# Free Agent SCM: Sample Administration Notesheets', // 14
  '', // 15
  '**Sample Administration Notes · Version 1.104.0** (platform level v1.104) · CONFIDENTIAL', // 16
];
const BODY = ['', 'This sheet is the technical statement.', '', '## Contents', '']; // 17 to 21
const SOURCE_LINES = [...HEADER, ...COVER, ...BODY];
const SOURCE = SOURCE_LINES.join('\n');
const PARSED = {
  slots: {
    title: 'Free Agent SCM: Sample Administration Notesheets',
    coverLine: 'Sample Administration Notes · Version 1.104.0 (platform level v1.104) · CONFIDENTIAL',
    version: '1.104.0',
    date: '2026-10-06',
  },
  body: '\nThis sheet is the technical statement.\n\n## Contents\n',
  bodyFirstLine: 17,
};

describe('parseGuideSource', () => {
  it('reads the four cover slots by their labels, and gives the body with the line it starts on', () => {
    expect(parseGuideSource(SOURCE)).toEqual(PARSED);
  });

  it('reads a file with \\r\\n line endings as the same file with \\n', () => {
    expect(parseGuideSource(SOURCE_LINES.join('\r\n'))).toEqual(PARSED);
  });

  it('finds the values by their labels, not by their line numbers, and reads a label only at the start of its line', () => {
    const header = [
      '<!--',
      '  Maintenance: bump the Version: line and the Dated: line; the note "For the designer: title ..." stays in this comment.',
      '',
      '  For the designer:',
      '    title "Free Agent SCM: Sample Administration Notesheets";',
      '    cover line "Sample Administration Notes · Version 1.104.0 (platform level v1.104) · CONFIDENTIAL".',
      'Dated: 2026-10-06',
      'Version:1.104.0',
      '-->',
    ];
    expect(parseGuideSource([...header, ...COVER, ...BODY].join('\n'))).toEqual({ ...PARSED, bodyFirstLine: 16 });
  });

  /** The source with one change: `edit` is handed a copy of its lines. */
  const edited = (edit: (lines: string[]) => void) => {
    const lines = [...SOURCE_LINES];
    edit(lines);
    return lines.join('\n');
  };

  it.each<[string, (lines: string[]) => void, string]>([
    ['a file that does not begin with the header comment', (l) => l.unshift(''), 'guide line 1: the file must begin with its header comment'],
    ['a header comment that never closes', (l) => l.splice(9, 1), 'guide line 1: the header comment that opens here does not close'],
    ['text after the --> that closes the header comment', (l) => (l[9] = '--> ![HAIWAVE](haiwave-logo.png)'), 'guide line 10: text follows the --> that closes the header comment'],
    ['a header comment with no Version: line', (l) => l.splice(2, 1), 'guide line 1: the header comment has no line "Version: <value>"'],
    ['a second Version: line', (l) => l.splice(4, 0, 'Version: 1.103.0'), 'guide line 5: a second "Version:" line'],
    ['a Version that is not groups of digits', (l) => (l[2] = '  Version: v1.104.0'), 'guide line 3: Version "v1.104.0" is not a version'],
    ['a Version of one group of digits', (l) => (l[2] = '  Version: 7'), 'guide line 3: Version "7" is not a version'],
    ['a Version with a suffix after its digits', (l) => (l[2] = '  Version: 1.104.0-rc.1'), 'guide line 3: Version "1.104.0-rc.1" is not a version'],
    ['a header comment with no Dated: line', (l) => l.splice(3, 1), 'guide line 1: the header comment has no line "Dated: <value>"'],
    ['a second Dated: line', (l) => l.splice(5, 0, '  Dated: 2026-10-07'), 'guide line 6: a second "Dated:" line'],
    ['a Dated that is not written YYYY-MM-DD', (l) => (l[3] = '  Dated: 2026-10-6'), 'guide line 4: Dated "2026-10-6" is not a date'],
    ['a Dated that is no day of the calendar', (l) => (l[3] = '  Dated: 2026-02-30'), 'guide line 4: Dated "2026-02-30" is not a date'],
    ['a header comment with no note for the designer', (l) => l.splice(6, 3), 'guide line 1: the header comment has no note for the designer'],
    ['a second note for the designer', (l) => l.splice(9, 0, '  For the designer: title "Another"; cover line "Another"'), 'guide line 10: a second note "For the designer:"'],
    ['a note for the designer with no title', (l) => (l[6] = '  For the designer: cover line'), 'guide line 7: the note for the designer has no title'],
    [
      'a note for the designer with no cover line',
      (l) => l.splice(6, 2, '  For the designer: title "Free Agent SCM: Sample Administration Notesheets"; edition date = the'),
      'guide line 7: the note for the designer has no cover line',
    ],
    ['an empty title in the note for the designer', (l) => (l[6] = '  For the designer: title ""; cover line'), 'guide line 7: the title in the note for the designer is empty'],
    ['an empty cover line in the note for the designer', (l) => (l[7] = '  ""; edition date = the'), 'guide line 7: the cover line in the note for the designer is empty'],
    [
      'a title in the note that begins with white space, although the cover is written the same way',
      (l) => {
        l[6] = '  For the designer: title " Free Agent SCM: Sample Administration Notesheets"; cover line';
        l[13] = '#  Free Agent SCM: Sample Administration Notesheets';
      },
      'guide line 7: the title in the note for the designer begins or ends with white space',
    ],
    [
      'a cover line in the note that ends with white space, although the cover is written the same way',
      (l) => {
        l[7] = '  "Sample Administration Notes · Version 1.104.0 (platform level v1.104) · CONFIDENTIAL "; edition date = the';
        l[15] = '**Sample Administration Notes · Version 1.104.0** (platform level v1.104) · CONFIDENTIAL ';
      },
      'guide line 7: the cover line in the note for the designer begins or ends with white space',
    ],
    [
      'a title in the note that is broken over two lines',
      (l) => l.splice(6, 1, '  For the designer: title "Free Agent SCM:', '  Sample Administration Notesheets"; cover line'),
      'guide line 7: the note for the designer has no title',
    ],
    ['a cover without the logo image line', (l) => l.splice(11, 1), 'guide line 13: the first line after the header comment must be the logo image'],
    ['text after the logo image on its line', (l) => (l[11] = '![HAIWAVE](haiwave-logo.png) HAIWAVE'), 'guide line 12: the first line after the header comment must be the logo image'],
    [
      'text after the logo image that itself ends with a closing bracket',
      (l) => (l[11] = '![HAIWAVE](haiwave-logo.png) Read the notice first (it changed)'),
      'guide line 12: the first line after the header comment must be the logo image',
    ],
    ['a second image after the logo image on its line', (l) => (l[11] = '![HAIWAVE](haiwave-logo.png)![diagram](flow.png)'), 'guide line 12: the first line after the header comment must be the logo image'],
    ['a logo image with a title after its file', (l) => (l[11] = '![HAIWAVE](haiwave-logo.png "The HAIWAVE logo")'), 'guide line 12: the first line after the header comment must be the logo image'],
    ['a logo image whose file holds an opening bracket', (l) => (l[11] = '![HAIWAVE]((haiwave-logo.png)'), 'guide line 12: the first line after the header comment must be the logo image'],
    ['a cover whose second line is not a "# " title', (l) => (l[13] = '## Free Agent SCM: Sample Administration Notesheets'), 'guide line 14: the second line of the cover must be the title'],
    [
      'a title that differs between the note for the designer and the cover',
      (l) => (l[13] = '# Free Agent SCM: Sample Administration Notes'),
      'guide line 14: the title "Free Agent SCM: Sample Administration Notes" differs from the title in the note for the designer, "Free Agent SCM: Sample Administration Notesheets"',
    ],
    [
      'a cover whose third line is not bold, although its text is the cover line',
      (l) => (l[15] = 'Sample Administration Notes · Version 1.104.0 (platform level v1.104) · CONFIDENTIAL'),
      'guide line 16: the third line of the cover must be the bold cover line',
    ],
    [
      'a cover line whose ** is never closed, although its text is the cover line',
      (l) => (l[15] = '**Sample Administration Notes · Version 1.104.0 (platform level v1.104) · CONFIDENTIAL'),
      'guide line 16: the third line of the cover must be the bold cover line',
    ],
    [
      'a cover line that differs between the note for the designer and the cover',
      (l) => (l[15] = '**Sample Administration Notes · Version 1.103.0** (platform level v1.104) · CONFIDENTIAL'),
      'guide line 16: the cover line "Sample Administration Notes · Version 1.103.0 (platform level v1.104) · CONFIDENTIAL" differs from the cover line in the note for the designer, "Sample Administration Notes · Version 1.104.0 (platform level v1.104) · CONFIDENTIAL"',
    ],
    ['a file that ends before the three lines of the cover', (l) => l.splice(15), 'guide line 15: the cover is not complete'],
    ['a line of spaces between the cover lines, which is not a blank line', (l) => (l[12] = '  '), 'guide line 13: the second line of the cover must be the title'],
    ['text before the <!-- that opens the header comment on line 1', (l) => (l[0] = 'x<!--'), 'guide line 1: the file must begin with its header comment'],
    ['a Version with two dots in a row', (l) => (l[2] = '  Version: 1..104'), 'guide line 3: Version "1..104" is not a version'],
    ['a Version that ends with a dot', (l) => (l[2] = '  Version: 1.104.'), 'guide line 3: Version "1.104." is not a version'],
    [
      'a note for the designer with words before its title',
      (l) => (l[6] = '  For the designer: please set the title "Free Agent SCM: Sample Administration Notesheets"; cover line'),
      'guide line 7: the note for the designer has no title',
    ],
    [
      'a note for the designer with no semicolon after its title',
      (l) => (l[6] = '  For the designer: title "Free Agent SCM: Sample Administration Notesheets" cover line'),
      'guide line 7: the note for the designer has no cover line',
    ],
    [
      'a note for the designer with words between its title and the semicolon',
      (l) => (l[6] = '  For the designer: title "Free Agent SCM: Sample Administration Notesheets" and then; cover line'),
      'guide line 7: the note for the designer has no cover line',
    ],
    [
      'a cover line in the note that is broken over two lines',
      (l) => l.splice(7, 1, '  "Sample Administration Notes · Version 1.104.0', '  (platform level v1.104) · CONFIDENTIAL"; edition date = the'),
      'guide line 7: the note for the designer has no cover line',
    ],
    ['text before the logo image on its line', (l) => (l[11] = 'Logo: ![HAIWAVE](haiwave-logo.png)'), 'guide line 12: the first line after the header comment must be the logo image'],
    ['a logo image with no file', (l) => (l[11] = '![HAIWAVE]()'), 'guide line 12: the first line after the header comment must be the logo image'],
    ['a logo image with no name and a space for its file', (l) => (l[11] = '![]( )'), 'guide line 12: the first line after the header comment must be the logo image'],
    [
      'a Version: line in the body and none in the header comment',
      (l) => {
        l.splice(2, 1);
        l.push('Version: 9.9.9');
      },
      'guide line 1: the header comment has no line "Version: <value>"',
    ],
    ['a Dated with a signed year of six digits, which is a date to a computer', (l) => (l[3] = '  Dated: +010000-01'), 'guide line 4: Dated "+010000-01" is not a date'],
    ['a logo image whose file holds a closing bracket', (l) => (l[11] = '![HAIWAVE](logo).png)'), 'guide line 12: the first line after the header comment must be the logo image'],
  ])('refuses %s', (_label, edit, message) => {
    expect(refusalOf(() => parseGuideSource(edited(edit)))).toMatch(beginning(message));
  });
});

/** The body HTML of a guide body given as its lines, as the lines of the HTML (the last one is empty: the output ends with a line break). */
const htmlLines = (markdown: string[]) => guideMarkdownToHtml(markdown.join('\n')).split('\n');

describe('guideMarkdownToHtml: each kind of block', () => {
  it.each<[string, string[], string[]]>([
    ['a section heading', ['## §1 First Steps'], ['<h2>§1 First Steps</h2>', '']],
    ['a subsection heading', ['### §1.1 What you want'], ['<h3>§1.1 What you want</h3>', '']],
    ['a paragraph', ['No separate embedding service is needed.'], ['<p>No separate embedding service is needed.</p>', '']],
    ['a rule', ['---'], ['<hr>', '']],
    [
      'a bulleted list',
      ['- §0 How to fix this sheet', '- §1 First Steps'],
      ['<ul>', '<li>§0 How to fix this sheet</li>', '<li>§1 First Steps</li>', '</ul>', ''],
    ],
    [
      'a numbered list',
      ['1. Get the container.', '2. Run it with defaults.', '3. Send it a short tag.'],
      ['<ol>', '<li>Get the container.</li>', '<li>Run it with defaults.</li>', '<li>Send it a short tag.</li>', '</ol>', ''],
    ],
    [
      'a check-box list, whose "[ ]" is not part of an item\'s text',
      ['- [ ] Obtain a bearer token on every call.', '- [ ] Validate the inbound token.'],
      ['<ul class="checklist">', '<li>Obtain a bearer token on every call.</li>', '<li>Validate the inbound token.</li>', '</ul>', ''],
    ],
    [
      'a code block whose fence names a language',
      ['```bash', 'docker run -d --name example-agent \\', '  -p 3001:3001 example-agent', '```'],
      ['<pre><code class="language-bash">docker run -d --name example-agent \\', '  -p 3001:3001 example-agent', '</code></pre>', ''],
    ],
    ['a code block whose fence names no language', ['```', 'a block with no language', '```'], ['<pre><code>a block with no language', '</code></pre>', '']],
    [
      'a table, whose cells are trimmed',
      ['| Variable | Default |', '|---|---|', '| PORT | 3001 |', '|HOST|  0.0.0.0  |'],
      [
        '<table>',
        '<thead>',
        '<tr><th>Variable</th><th>Default</th></tr>',
        '</thead>',
        '<tbody>',
        '<tr><td>PORT</td><td>3001</td></tr>',
        '<tr><td>HOST</td><td>0.0.0.0</td></tr>',
        '</tbody>',
        '</table>',
        '',
      ],
    ],
    [
      'a note with no label',
      ['> A note with no bold label: a plain quoted paragraph.'],
      ['<blockquote>', '<p>A note with no bold label: a plain quoted paragraph.</p>', '</blockquote>', ''],
    ],
    [
      'a note with a bold label',
      ['> **Conventions.** Configuration on each agent is given as an environment variable.'],
      ['<blockquote>', '<p><strong>Conventions.</strong> Configuration on each agent is given as an environment variable.</p>', '</blockquote>', ''],
    ],
    [
      'a planned note, which begins **Planned.**',
      ['> **Planned.** Not yet available.'],
      ['<blockquote class="planned">', '<p><strong>Planned.</strong> Not yet available.</p>', '</blockquote>', ''],
    ],
    [
      'a note of two lines, which is one paragraph joined with a single space',
      ['> **Planned.** Word files are not yet supported;', '> convert them to PDF for now.'],
      ['<blockquote class="planned">', '<p><strong>Planned.</strong> Word files are not yet supported; convert them to PDF for now.</p>', '</blockquote>', ''],
    ],
    [
      'a code block with &, < and >, which become entities while every other character stays',
      ['```bash', 'PARTICIPANT_ID=<yours> && echo "$A" > \'out.txt\'  # **not bold**, `not code`', '```'],
      ['<pre><code class="language-bash">PARTICIPANT_ID=&lt;yours&gt; &amp;&amp; echo "$A" &gt; \'out.txt\'  # **not bold**, `not code`', '</code></pre>', ''],
    ],
    [
      'a list whose items hold bold, a console path and a code span',
      ['1. **The Free Agent archive.** At ***Account › Agent Software***.', '2. Second item with `PARTICIPANT_ID`.'],
      [
        '<ol>',
        '<li><strong>The Free Agent archive.</strong> At <strong><em>Account › Agent Software</em></strong>.</li>',
        '<li>Second item with <code>PARTICIPANT_ID</code>.</li>',
        '</ol>',
        '',
      ],
    ],
    [
      'a table whose cells hold bold and code spans',
      ['| Variable | **Default** |', '|---|---|', '| `PORT` | `3001` |'],
      [
        '<table>',
        '<thead>',
        '<tr><th>Variable</th><th><strong>Default</strong></th></tr>',
        '</thead>',
        '<tbody>',
        '<tr><td><code>PORT</code></td><td><code>3001</code></td></tr>',
        '</tbody>',
        '</table>',
        '',
      ],
    ],
    ['a heading that holds a code span', ['### §3.4 The `agent.env` file'], ['<h3>§3.4 The <code>agent.env</code> file</h3>', '']],
    [
      'a note that holds **Planned.** after its start, which is not a planned note',
      ['> **Word files.** They are **Planned.** work.'],
      ['<blockquote>', '<p><strong>Word files.</strong> They are <strong>Planned.</strong> work.</p>', '</blockquote>', ''],
    ],
    [
      'a note that begins **Planned** with no full stop, which is not a planned note',
      ['> **Planned** for a later release.'],
      ['<blockquote>', '<p><strong>Planned</strong> for a later release.</p>', '</blockquote>', ''],
    ],
    [
      'a table with no body row',
      ['| Variable | Default |', '|---|---|'],
      ['<table>', '<thead>', '<tr><th>Variable</th><th>Default</th></tr>', '</thead>', '<tbody>', '</tbody>', '</table>', ''],
    ],
    [
      'a table with empty cells, and a delimiter row written with spaces',
      ['| Field |  |', '| --- | - |', '|  | ✓ |'],
      ['<table>', '<thead>', '<tr><th>Field</th><th></th></tr>', '</thead>', '<tbody>', '<tr><td></td><td>✓</td></tr>', '</tbody>', '</table>', ''],
    ],
    [
      'two notes with a blank line between them, which are two notes',
      ['> **Planned.** One.', '', '> **Conventions.** Two.'],
      [
        '<blockquote class="planned">',
        '<p><strong>Planned.</strong> One.</p>',
        '</blockquote>',
        '<blockquote>',
        '<p><strong>Conventions.</strong> Two.</p>',
        '</blockquote>',
        '',
      ],
    ],
    ['a code block with no line in it', ['```', '```'], ['<pre><code></code></pre>', '']],
    [
      'a code block with a blank line and with spaces at the end of a line, which are kept',
      ['```', '# Network identity  ', '', 'PARTICIPANT_ID=yours', '```'],
      ['<pre><code># Network identity  ', '', 'PARTICIPANT_ID=yours', '</code></pre>', ''],
    ],
    [
      'a note that begins **PLANNED.** in capitals, which is not a planned note',
      ['> **PLANNED.** Not yet.'],
      ['<blockquote>', '<p><strong>PLANNED.</strong> Not yet.</p>', '</blockquote>', ''],
    ],
  ])('converts %s', (_label, markdown, html) => {
    expect(htmlLines(markdown)).toEqual(html);
  });
});

describe('guideMarkdownToHtml: inline text', () => {
  it.each<[string, string, string]>([
    ['bold', 'The printer accepts the **yellow ticket once**, so keep it.', 'The printer accepts the <strong>yellow ticket once</strong>, so keep it.'],
    ['a code span', 'Write the settings to a file named `agent.env`:', 'Write the settings to a file named <code>agent.env</code>:'],
    ['italic', "*Audience: A (every visitor's third week)*", "<em>Audience: A (every visitor's third week)</em>"],
    ['bold italic, as a console path is written', 'Select an entry under ***Account › Agents***.', 'Select an entry under <strong><em>Account › Agents</em></strong>.'],
    ['bold around a code span', 'Set it to **`true`** to turn it on.', 'Set it to <strong><code>true</code></strong> to turn it on.'],
    ['italic around a code span', '*See `agent.env` for the list.*', '<em>See <code>agent.env</code> for the list.</em>'],
    [
      'bold that holds an italic span',
      '**The client secret is shown *once* and never again.**',
      '<strong>The client secret is shown <em>once</em> and never again.</strong>',
    ],
    [
      'an underscore inside a word and around a word, which stays text',
      'It needs the quote_owner_inbound grant in the _draft_ state.',
      'It needs the quote_owner_inbound grant in the _draft_ state.',
    ],
    ['&, < and > in text, which become entities', 'Pricing & Commercial Terms: 1 < 2 and 3 > 2.', 'Pricing &amp; Commercial Terms: 1 &lt; 2 and 3 &gt; 2.'],
    ['&, < and > in a code span, which become entities too', 'Set `PARTICIPANT_ID=<yours> && echo ok`.', 'Set <code>PARTICIPANT_ID=&lt;yours&gt; &amp;&amp; echo ok</code>.'],
    [
      'a quote, an apostrophe, a double hyphen and three dots, which stay as typed',
      'Run it with "--retry 3" -- it\'s safe... and so on.',
      'Run it with "--retry 3" -- it\'s safe... and so on.',
    ],
    [
      'what is refused or converted in text, which inside a code span is code',
      'Write `[a link](x)`, `[^1]`, `C:\\data`, `&amp;`, `<br>`, `</p>`, `~~x~~`, `**bold**`, `_a_` and `2 * 3 * 4`.',
      'Write <code>[a link](x)</code>, <code>[^1]</code>, <code>C:\\data</code>, <code>&amp;amp;</code>, <code>&lt;br&gt;</code>, ' +
        '<code>&lt;/p&gt;</code>, <code>~~x~~</code>, <code>**bold**</code>, <code>_a_</code> and <code>2 * 3 * 4</code>.',
    ],
    ['a "<" that begins no HTML tag, which is text', 'Use a value <= 10, or <3 retries, or a <-- mark.', 'Use a value &lt;= 10, or &lt;3 retries, or a &lt;-- mark.'],
    [
      'square brackets, and an ampersand with a semicolon later in the line, which are text',
      'The [param] segment, the list [1, 2] and terms & conditions; then prices.',
      'The [param] segment, the list [1, 2] and terms &amp; conditions; then prices.',
    ],
    ['a code span with spaces at its ends, which are kept', 'Type ` --retry 3 ` with the spaces at its ends.', 'Type <code> --retry 3 </code> with the spaces at its ends.'],
    ['a code span with runs of spaces, which are kept', 'Type `docker  ps   -a` with its runs of spaces.', 'Type <code>docker  ps   -a</code> with its runs of spaces.'],
    ['bold around a code span at the start of the text', '**`PORT`** is the port it listens on.', '<strong><code>PORT</code></strong> is the port it listens on.'],
    ['bold around a code span with a comma right after it', 'Set it to **`true`**, then restart.', 'Set it to <strong><code>true</code></strong>, then restart.'],
    [
      'bold around a code span right after an opening bracket',
      'The default (**`true`** unless you change it) is safe.',
      'The default (<strong><code>true</code></strong> unless you change it) is safe.',
    ],
    ['an empty comment, which is removed like any other', 'An empty comment <!----> leaves one space.', 'An empty comment leaves one space.'],
    [
      'comments between and after code spans, which stand outside them',
      'Set `PORT` first, <!-- a cite --> then `HOST`. <!-- another -->',
      'Set <code>PORT</code> first, then <code>HOST</code>.',
    ],
    ['bold and italic that close right before a letter', 'A **bold**word and a*b*c.', 'A <strong>bold</strong>word and a<em>b</em>c.'],
    ['bold inside a word', 'Set a**b**c now.', 'Set a<strong>b</strong>c now.'],
    ['the characters --!> outside any comment, which are text', 'The mark --!> is text here. <!-- a cite -->', 'The mark --!&gt; is text here.'],
  ])('converts %s', (_label, markdown, html) => {
    expect(guideMarkdownToHtml(markdown)).toBe(`<p>${html}</p>\n`);
  });
});

describe('guideMarkdownToHtml: where a paragraph runs and where it ends', () => {
  it.each<[string, string[], string[]]>([
    [
      'a paragraph of three source lines is one paragraph, its lines joined with single spaces',
      ['This sheet covers seven chapters.', 'Skip over the part', 'that repeats yours.', '', 'A second paragraph.'],
      ['<p>This sheet covers seven chapters. Skip over the part that repeats yours.</p>', '<p>A second paragraph.</p>', ''],
    ],
    [
      'a code span may cross the join of two lines: the lines are joined before the inline rules are applied',
      ["The response is `{kind: 'value', value,", 'nonce}` for a value.'],
      ["<p>The response is <code>{kind: 'value', value, nonce}</code> for a value.</p>", ''],
    ],
    [
      'a bulleted list may follow a paragraph line directly',
      ['**Enter here**', '- §0 How to fix this sheet', '- §1 First Steps'],
      ['<p><strong>Enter here</strong></p>', '<ul>', '<li>§0 How to fix this sheet</li>', '<li>§1 First Steps</li>', '</ul>', ''],
    ],
    ['a numbered list may follow a paragraph line directly', ['In two steps:', '1. Build it.', '2. Run it.'], ['<p>In two steps:</p>', '<ol>', '<li>Build it.</li>', '<li>Run it.</li>', '</ol>', '']],
    ['a check-box list may follow a paragraph line directly', ['Before you start:', '- [ ] Docker is installed.'], ['<p>Before you start:</p>', '<ul class="checklist">', '<li>Docker is installed.</li>', '</ul>', '']],
    ['a heading ends a paragraph with no blank line', ['Text of a paragraph.', '### §1.2 Run it'], ['<p>Text of a paragraph.</p>', '<h3>§1.2 Run it</h3>', '']],
    ['a code fence ends a paragraph with no blank line', ['Run it:', '```bash', 'docker ps', '```'], ['<p>Run it:</p>', '<pre><code class="language-bash">docker ps', '</code></pre>', '']],
    [
      'a table ends a paragraph with no blank line',
      ['The settings:', '| Variable | Default |', '|---|---|', '| PORT | 3001 |'],
      ['<p>The settings:</p>', '<table>', '<thead>', '<tr><th>Variable</th><th>Default</th></tr>', '</thead>', '<tbody>', '<tr><td>PORT</td><td>3001</td></tr>', '</tbody>', '</table>', ''],
    ],
    ['a note ends a paragraph with no blank line', ['Word files:', '> **Planned.** Not yet.'], ['<p>Word files:</p>', '<blockquote class="planned">', '<p><strong>Planned.</strong> Not yet.</p>', '</blockquote>', '']],
    ['a line that begins with a decimal number is a paragraph, not a list item', ['1.5 GB of memory is enough.'], ['<p>1.5 GB of memory is enough.</p>', '']],
  ])('%s', (_label, markdown, html) => {
    expect(htmlLines(markdown)).toEqual(html);
  });
});

describe('guideMarkdownToHtml: HTML comments', () => {
  it.each<[string, string[], string[]]>([
    [
      'a comment at the end of a line is removed, and no space is left at the line\'s end',
      ['The console withholds the control. <!-- haiClient:src/app.ts:10-20 -->', 'It says why.'],
      ['<p>The console withholds the control. It says why.</p>', ''],
    ],
    [
      'a comment in the middle of a line is removed, and the white space around it becomes one space',
      ['Revising a quote retracts the offer. <!-- a cite --> Retrying reuses the identity.'],
      ['<p>Revising a quote retracts the offer. Retrying reuses the identity.</p>', ''],
    ],
    [
      'two comments on one line, the second right after the first, leave one space between the texts around them',
      ['A first claim <!-- one --> and a second. <!-- two --><!-- three --> Then a third.'],
      ['<p>A first claim and a second. Then a third.</p>', ''],
    ],
    [
      'a line that holds only a comment is dropped and is not a blank line: the paragraph around it stays one',
      ['The first line', '<!-- a cite on a line of its own -->', 'and the second line.'],
      ['<p>The first line and the second line.</p>', ''],
    ],
    [
      'a line of several comments and nothing else is dropped too: the list around it stays one',
      ['- The first item.', '<!-- one --> <!-- two --><!-- three -->', '- The second item.'],
      ['<ul>', '<li>The first item.</li>', '<li>The second item.</li>', '</ul>', ''],
    ],
    [
      'inside a code fence nothing is removed: a comment there is code',
      ['```', 'before <!-- kept --> after', '<!-- a whole line, kept -->', '```'],
      ['<pre><code>before &lt;!-- kept --&gt; after', '&lt;!-- a whole line, kept --&gt;', '</code></pre>', ''],
    ],
    [
      'a heading whose text begins with a comment is a heading like any other: markdown readers format it too',
      ['## <!-- a cite --> **Title** of a section'],
      ['<h2><strong>Title</strong> of a section</h2>', ''],
    ],
    [
      'a table cell whose text begins with a comment is a cell like any other: markdown readers format it too',
      ['| <!-- a cite --> **Variable** | Default |', '|---|---|'],
      ['<table>', '<thead>', '<tr><th><strong>Variable</strong></th><th>Default</th></tr>', '</thead>', '<tbody>', '</tbody>', '</table>', ''],
    ],
  ])('%s', (_label, markdown, html) => {
    expect(htmlLines(markdown)).toEqual(html);
  });
});

describe('guideMarkdownToHtml: what it refuses, with the line number in the guide\'s file', () => {
  it('counts the lines from 1 when it is not told the body\'s first line: a comment that does not close on its line', () => {
    expect(refusalOf(() => guideMarkdownToHtml('A first line.\nText <!-- never closed\nmore -->'))).toMatch(
      beginning('guide line 2: a comment opens with <!-- and does not close with --> on the same line'),
    );
  });

  /** The refusal of a body whose first line is line 101 of the guide's file. */
  const refusalAt101 = (markdown: string[]) => refusalOf(() => guideMarkdownToHtml(markdown.join('\n'), { firstLine: 101 }));

  it.each<[string, string[], string]>([
    [
      'a comment that does not close on its line, numbered from the first line it is told',
      ['A first line.', 'Text <!-- never closed', 'more -->'],
      'guide line 102: a comment opens with <!-- and does not close with --> on the same line',
    ],
    ['an indented code fence', ['Run it:', '  ```bash', '  docker ps', '  ```'], 'guide line 102: a code fence is indented'],
    ['an indented fence line inside a code block', ['```bash', 'docker ps', '  ```'], 'guide line 103: a code fence is indented'],
    ['text after the language of a code fence', ['```bash title="run"', 'docker ps', '```'], 'guide line 101: a code fence holds more than three backticks and a language name'],
    ['a code fence whose language has a capital letter', ['```Bash', 'docker ps', '```'], 'guide line 101: a code fence holds more than three backticks and a language name'],
    ['a code fence of four backticks', ['````', 'docker ps', '````'], 'guide line 101: a code fence holds more than three backticks and a language name'],
    [
      'a line inside a code block that begins with three backticks and is not the closing fence',
      ['```bash', 'docker ps', '```bash', 'docker images', '```'],
      'guide line 103: inside a code block, a line begins with three backticks and is not the closing fence',
    ],
    ['a code block that never closes', ['Run it:', '```bash', 'docker ps'], 'guide line 102: the code block that opens here does not close'],
    ['a tab in a code line', ['```', 'PORT=3001', 'HOST\t0.0.0.0', '```'], 'guide line 103: a tab in a code line'],
    ['a "# " heading, which only the cover has', ['# A second title'], 'guide line 101: a line that begins with # must be a heading'],
    ['a heading of four #', ['## A section', '', '#### Too deep'], 'guide line 103: a line that begins with # must be a heading'],
    ['a line of # marks with no space before its text', ['##First Steps'], 'guide line 101: a line that begins with # must be a heading'],
    ['a heading that closes with # marks', ['## First Steps ##'], 'guide line 101: a heading closes with # marks'],
    ['a rule written with asterisks', ['A paragraph.', '', '***'], 'guide line 103: a rule is written as exactly ---'],
    ['a rule written with underscores', ['___'], 'guide line 101: a rule is written as exactly ---'],
    ['a rule written with spaces between its marks', ['- - -'], 'guide line 101: a rule is written as exactly ---'],
    ['a rule of four hyphens', ['----'], 'guide line 101: a rule is written as exactly ---'],
    ['a line of = marks under a line of text', ['First Steps', '==========='], 'guide line 102: a rule is written as exactly ---'],
    ['a delimiter row with a colon', ['| Variable | Default |', '|:---|---:|', '| PORT | 3001 |'], 'guide line 102: a colon in the delimiter row of a table'],
    [
      'a body row with more cells than the header',
      ['| Variable | Default |', '|---|---|', '| PORT | 3001 |', '| HOST | 0.0.0.0 | all interfaces |'],
      "guide line 104: the cell count of this table row is 3 and the header's is 2",
    ],
    ['a body row with fewer cells than the header', ['| Variable | Default |', '|---|---|', '| PORT |'], "guide line 103: the cell count of this table row is 1 and the header's is 2"],
    ['a delimiter row with fewer cells than the header', ['| Variable | Default |', '|---|', '| PORT | 3001 |'], "guide line 102: the cell count of this table row is 1 and the header's is 2"],
    ['a table row that does not end with |', ['| Variable | Default |', '|---|---|', '| PORT | 3001'], 'guide line 103: a table row must begin and end with |'],
    ['a table row that is a single | and nothing else', ['|', '|---|'], 'guide line 101: a table row must begin and end with |'],
    ['an escaped pipe in a table row', ['| Pattern | Meaning |', '|---|---|', '| `a \\| b` | either one |'], 'guide line 103: an escaped pipe'],
    ['a table whose second row is not a delimiter row', ['| Variable | Default |', '| PORT | 3001 |'], 'guide line 102: the second row of a table must be its delimiter row'],
    ['a header row with no row below it', ['The settings:', '', '| Variable | Default |', '', 'More text.'], 'guide line 103: a table needs a delimiter row below its header row'],
    [
      'a line of text directly below a table row: every line of a table is a row, and a table ends at a blank line',
      ['| Variable | Default |', '|---|---|', '| PORT | 3001 |', 'PORT is the port it listens on.'],
      'guide line 104: a table row must begin and end with |',
    ],
    ['a heading directly below a table row', ['| Variable | Default |', '|---|---|', '## The next section'], 'guide line 103: a table row must begin and end with |'],
    ['a note line that is only ">"', ['> A note.', '>', '> Its second paragraph.'], 'guide line 102: a note line that is only ">"'],
    ['a note inside a note', ['> A note.', '> > A note inside it.'], 'guide line 102: a note inside a note'],
    ['a note inside a note, written with no space between the marks', ['>> A note inside a note.'], 'guide line 101: a note inside a note'],
    ['a note line with no space after its ">"', ['>A note.'], 'guide line 101: a note line must be written "> text"'],
    ['a note line with two spaces after its ">"', ['>  A note.'], 'guide line 101: a note line must be written "> text"'],
    ['a list item inside a note', ['> **Before you start.**', '> - Docker is installed.'], 'guide line 102: a note holds text only'],
    ['a heading inside a note', ['> ## A heading in a note'], 'guide line 101: a note holds text only'],
    ['a table row inside a note', ['> | Variable | Default |'], 'guide line 101: a note holds text only'],
    ['a code fence inside a note', ['> ```bash', '> docker ps', '> ```'], 'guide line 101: a note holds text only'],
    ['a code fence after a comment that begins its line', ['<!-- a cite --> ```bash', 'docker ps', '```'], 'guide line 101: a comment begins the line and text follows it'],
    [
      'a line of text directly below a note, which markdown readers take into the note',
      ['> **Planned.** Not yet available.', 'Compare to PDF for now.'],
      'guide line 102: a note ends at a blank line',
    ],
    ['a plain item in a check-box list', ['- [ ] Docker is installed.', '- A plain item.'], 'guide line 102: a list mixes check-box items and plain items'],
    ['a check-box item in a bulleted list', ['- A plain item.', '- [ ] Docker is installed.'], 'guide line 102: a list mixes check-box items and plain items'],
    [
      'a line of text directly below a list item, which markdown readers take into the item',
      ['- Docker on the desk, with external storage access', 'for the draft and for the final step.'],
      'guide line 102: a list ends at a blank line',
    ],
    ['a numbered item directly below a bulleted list', ['- A bulleted item.', '1. A numbered item.'], 'guide line 102: a list ends at a blank line'],
    ['a ticked check box', ['Done so far:', '', '- [x] The agent is built.'], 'guide line 103: a check box is written "- [ ] text"'],
    ['a check box ticked with a capital X', ['- [X] The agent is built.'], 'guide line 101: a check box is written "- [ ] text"'],
    ['a check box with no space between its brackets', ['- [] The agent is built.'], 'guide line 101: a check box is written "- [ ] text"'],
    ['a check box with no space before its text', ['- [ ]The agent is built.'], 'guide line 101: a check box is written "- [ ] text"'],
    ['a bullet written with *', ['* An item.', '* Another item.'], 'guide line 101: a bulleted item is written "- text"'],
    ['a bullet written with +', ['+ An item.'], 'guide line 101: a bulleted item is written "- text"'],
    ['a list number followed by ")"', ['1) Build it.', '2) Run it.'], 'guide line 101: a numbered item is written "1. text"'],
    ['a numbered list that does not start at 1', ['The steps:', '', '2. Run it.', '3. Check it.'], 'guide line 103: a numbered list starts at 1'],
    ['a numbered list that skips a number', ['1. Build it.', '2. Run it.', '4. Check it.'], 'guide line 103: a numbered list counts up by one, so this item must be 3. and it is 4.'],
    ['a numbered list whose every item is numbered 1', ['1. Build it.', '1. Run it.'], 'guide line 102: a numbered list counts up by one, so this item must be 2. and it is 1.'],
    ['a list number with a leading zero', ['01. Build it.'], 'guide line 101: a numbered list starts at 1, and this one starts at 01.'],
    ['a line that begins with a hyphen and no space', ['-v prints the version.'], 'guide line 101: a line that begins with - must be a list item'],
    ['a hyphen alone on a line', ['- A first item.', '-'], 'guide line 102: a line that begins with - must be a list item'],
    ['a bulleted item with two spaces before its text', ['-  A first item.'], 'guide line 101: a line that begins with - must be a list item'],
    ['a check-box item with two spaces before its text', ['- [ ]  Docker is installed.'], 'guide line 101: a check box is written "- [ ] text"'],
    ['a list item inside a bulleted item', ['- - A nested item.'], 'guide line 101: a list item holds text only'],
    ['a note inside a check-box item', ['- [ ] > A quoted line.'], 'guide line 101: a list item holds text only'],
    ['a heading inside a numbered item', ['1. ## A heading in an item'], 'guide line 101: a list item holds text only'],
    ['a list number with no text', ['The steps:', '', '1.', '', 'Build it.'], 'guide line 103: a numbered item is written "1. text"'],
    ['a numbered item with two spaces before its text', ['1.  Build it.'], 'guide line 101: a numbered item is written "1. text"'],
    ['an indented item under a list item', ['- An item.', '  - A nested item.'], 'guide line 102: the line begins with white space'],
    ['an indented continuation line under a list item', ['- Docker on the desk, with external access', '  for the draft.'], 'guide line 102: the line begins with white space'],
    ['a line that begins with a tab', ['A paragraph.', '', '\tdocker ps'], 'guide line 103: the line begins with white space'],
    ['a line of spaces and nothing else, which is not a blank line', ['A paragraph.', '   ', 'Another paragraph.'], 'guide line 102: the line begins with white space'],
    ['a line that ends with two spaces, which markdown reads as a line break', ['The first line  ', 'and the second.'], 'guide line 101: the line ends with white space'],
    ['a line that ends with one space', ['A first paragraph.', '', 'The first line ', 'and the second.'], 'guide line 103: the line ends with white space'],
    ['an image, which only the cover has', ['The flow:', '', '![The message flow](flow.png)'], 'guide line 103: an image'],
    ['a link definition, which markdown readers do not show', ['See the documentation.', '', '[documentation]: https://docs.example.com'], 'guide line 103: a link definition'],
    ['a tab inside a line of text', ['Variable\tDefault'], 'guide line 101: a tab in a line of text'],
    ['a control character inside a line of text', ['A bell \u0007 in the text.'], 'guide line 101: a control character in a line of text, U+0007'],
    ['a control character in a code line', ['```bash', 'printf "\u001b[1mbold"', '```'], 'guide line 102: a control character in a code line, U+001B'],
    ['a carriage return at the end of a line', ['The first line.\r', 'The second line.'], 'guide line 101: a control character in a line of text, U+000D'],
    ['a line separator character inside a line', ['The first line.\u2028The second line.'], 'guide line 101: a control character in a line of text, U+2028'],
    ['a body with no content', [''], 'guide line 101: the body holds no content'],
    ['a body of blank lines and comments only', ['', '<!-- a cite and nothing else -->', ''], 'guide line 101: the body holds no content'],
    [
      'a backtick with no closing backtick, with the line it stands on',
      ['A first line of a paragraph,', 'a lone ` backtick on its second line', 'and a third line.'],
      'guide line 102: a backtick with no closing backtick',
    ],
    [
      'a backtick with no closing backtick that is the first character of a paragraph\'s third line',
      ['A first line of a paragraph,', 'a second line,', '` and a third line.'],
      'guide line 103: a backtick with no closing backtick',
    ],
    ['two backticks in a row', ['Write ``code`` like this.'], 'guide line 101: two backticks in a row'],
    ['two backticks in a row where a code span closes', ['A first line.', 'Write `code`` like `this`.'], 'guide line 102: two backticks in a row'],
    ['bold that opens and never closes', ['A first line', 'with **bold that never closes', 'on its three lines.'], 'guide line 102: an asterisk is left over'],
    ['asterisks used as multiplication signs, with spaces around them', ['The volume is 2 * 3 * 4 litres.'], 'guide line 101: an asterisk is left over'],
    ['bold whose closing asterisks stand after a space', ['A **bold ** word and **another** one.'], 'guide line 101: an asterisk is left over'],
    ['four asterisks in a row', ['A ****very**** bold word.'], 'guide line 101: an asterisk is left over'],
    ['bold inside italic', ['*An italic line with **bold** inside it.*'], 'guide line 101: an asterisk is left over'],
    ['bold italic inside bold', ['**Bold with ***both*** inside it.**'], 'guide line 101: an asterisk is left over'],
    ['italic inside bold italic', ['***Both with *italic* inside.***'], 'guide line 101: an asterisk is left over'],
    ['three asterisks that would close bold and the italic inside it at once', ['**Bold that ends in *italic***'], 'guide line 101: an asterisk is left over'],
    ['a link', ['A first line.', 'See [the console](https://console.example.com) for it.'], 'guide line 102: a link or an image'],
    ['a footnote', ['The ceiling is not configurable.[^1]'], 'guide line 101: a footnote'],
    ['a backslash outside a code span', ['The data lives in C:\\agent\\data on Windows.'], 'guide line 101: a backslash'],
    ['a named HTML entity', ['Fish &amp; chips.'], 'guide line 101: an HTML entity'],
    ['a decimal HTML entity', ['Copyright &#169; HAIWAVE.'], 'guide line 101: an HTML entity'],
    ['a hexadecimal HTML entity', ['Copyright &#xA9; HAIWAVE.'], 'guide line 101: an HTML entity'],
    ['an HTML element: a "<" followed by a letter', ['A first line<br>and a second.'], 'guide line 101: an HTML element or tag'],
    ['a closing HTML tag: a "<" followed by "/"', ['The end of the section </section> comes here.'], 'guide line 101: an HTML element or tag'],
    ['a declaration: a "<" followed by "!"', ['The page begins with <!DOCTYPE html> as usual.'], 'guide line 101: an HTML element or tag'],
    ['a processing instruction: a "<" followed by "?"', ['The file begins with <?xml version="1.0"?> as usual.'], 'guide line 101: an HTML element or tag'],
    ['a strike-through', ['The limit is ~~five~~ ten per minute.'], 'guide line 101: a strike-through'],
    [
      'two faults in one paragraph: the earlier one is named, with its own line',
      ['A first line', 'with a back\\slash in it', 'and [a link](https://example.com).'],
      'guide line 102: a backslash',
    ],
    ['a fault in a table cell, with the line of its row', ['| Variable | Default |', '|---|---|', '| `PORT` | 3001 |', '| `HOST | 0.0.0.0 |'], 'guide line 104: a backtick with no closing backtick'],
    ['a fault in the second line of a note, with that line', ['> **Planned.** Not yet available;', '> see [the list](https://example.com).'], 'guide line 102: a link or an image'],
    ['a fault in a list item, with the line of the item', ['1. Build it.', '2. Run it.', '3. Open C:\\agent to check it.'], 'guide line 103: a backslash'],
    ['a fault in a heading, with the line of the heading', ['A paragraph.', '', '### The `agent.env file'], 'guide line 103: a backtick with no closing backtick'],
    ['bold that opens in one table cell and closes in the next', ['| Variable | Default |', '|---|---|', '| **PORT | 3001** |'], 'guide line 103: an asterisk is left over'],
    [
      'a no-break space and text after a comment that begins a line, which are not dropped silently',
      ['<!-- a cite --> \u00a0Text after a no-break space.'],
      'guide line 101: a comment begins the line and text follows it',
    ],
    [
      'a no-break space that a removed comment leaves at the end of a line, which is not dropped silently',
      ['Text before a no-break space\u00a0 <!-- a cite -->', 'and a second line.'],
      'guide line 101: the line ends with white space',
    ],
    ['a check box in a numbered item', ['1. [ ] Docker is installed.'], 'guide line 101: a check box is written "- [ ] text"'],
    [
      'a table written without a | at the start and the end of its rows',
      ['Variable | Default', ':-- | --:', 'PORT | 3001'],
      'guide line 102: a delimiter row of a table that does not begin and end with |',
    ],
    [
      'a comment inside the marker that begins a line, which would become a list item only when the comment is gone',
      ['A paragraph.', '', '-<!-- a cite --> An item.'],
      'guide line 103: a comment stands inside the marker that begins the line',
    ],
    [
      'a comment written <!-->, which would take the text up to the next --> with it',
      ['A first line.', 'Run the backup first. <!--> Then stop the agent. <!-- haiClient:src/app.ts:10-20 --> Then upgrade.'],
      'guide line 102: a comment that opens with <!--> or <!--->',
    ],
    ['a comment written <!--->, with a later comment on its line', ['A <!---> B <!-- c --> C'], 'guide line 101: a comment that opens with <!--> or <!--->'],
    ['a zero-width space in a code line', ['```bash', 'curl\u200b -s https://x', '```'], 'guide line 102: a character that does not print in a code line, U+200B'],
    ['a mark that turns the direction of the text, inside a code span', ['A first line.', 'Set `PORT=\u202e1003` and restart.'], 'guide line 102: a character that does not print in a line of text, U+202E'],
    [
      'two tables with no blank line between them, whose second delimiter row would be printed as a row of hyphens',
      ['| A | B |', '|---|---|', '| 1 | 2 |', '| C | D |', '|---|---|', '| 3 | 4 |'],
      'guide line 105: a row of hyphens that is not the second row of its table',
    ],
    ['a header row whose every cell is a hyphen', ['The settings:', '', '| - | - |', '|---|---|', '| 1 | 2 |'], 'guide line 103: a row of hyphens that is not the second row of its table'],
    [
      'a first body row whose every cell is one hyphen',
      ['| Tier | Cost basis | Margin |', '|---|---|---|', '| - | - | - |'],
      'guide line 103: a row of hyphens that is not the second row of its table',
    ],
    [
      'an asterisk between a letter and a bracket, which markdown readers show as an asterisk and do not open italic with',
      ['Total = n*(a+b)*m.'],
      'guide line 101: an asterisk is left over',
    ],
    [
      'an asterisk between a bracket and a letter, which markdown readers show as an asterisk and do not close italic with',
      ['*(*foo)'],
      'guide line 101: an asterisk is left over',
    ],
    [
      'a numbered list written with blank lines between its items, which markdown readers number 1, 2, 3 and the print would number 1, 1, 1',
      ['1. First step.', '', '1. Second step.', '', '1. Third step.'],
      'guide line 103: a list begins here right after another list',
    ],
    [
      'two bulleted lists with only a blank line between them, which markdown readers take for one list',
      ['- One.', '', '- Two.'],
      'guide line 103: a list begins here right after another list',
    ],
    [
      'a check-box list right after a bulleted list, which markdown readers take for one list that mixes the two',
      ['- A plain item.', '- Another one.', '', '', '- [ ] A check-box item.'],
      'guide line 105: a list begins here right after another list',
    ],
    [
      'a rule directly below a line of text, which markdown readers read as a heading and its underline',
      ['A paragraph.', '', 'The last line of a section.', '---'],
      'guide line 104: a rule directly below a line of text',
    ],
    [
      'a line that begins with a comment and holds text after it, which markdown readers show as it is written',
      ['The first line', '<!-- a cite --> and the second.'],
      'guide line 102: a comment begins the line and text follows it',
    ],
    ['a comment inside a code span, whose text is kept character for character', ['A first line.', 'Set `PORT <!-- a cite --> =3001` first.'], 'guide line 102: a comment inside a code span'],
    [
      'a comment inside a code span that crosses the join of two lines, on the span\'s second line',
      ['Run `docker compose', 'up <!-- a cite --> -d` now.'],
      'guide line 102: a comment inside a code span',
    ],
    [
      'a comment on a line of its own inside a code span that crosses that line',
      ['Run `docker compose', '<!-- a cite -->', 'up -d` now.'],
      'guide line 102: a comment inside a code span',
    ],
    [
      'a backtick that never closes in a line of text, with a comment after it and a backtick in the list item right below: no code span runs from the text into the item',
      ['A lone ` backtick <!-- a cite --> in a line of text', '- An item with a ` backtick right below it.'],
      'guide line 101: a backtick with no closing backtick',
    ],
    [
      'a backtick that never closes in a list item, with a comment after it and a backtick in the next item: no code span runs from one item into the next',
      ['- A lone ` backtick <!-- a cite --> in the first item.', '- A backtick ` in the second.'],
      'guide line 101: a backtick with no closing backtick',
    ],
    [
      'a comment inside a code span that crosses the join of two lines of a note',
      ['> **Planned.** Run `docker compose', '> up <!-- a cite --> -d` later.'],
      'guide line 102: a comment inside a code span',
    ],
    [
      'a backtick that never closes in a table cell, with a comment after it and a backtick in the next cell: no code span runs from one cell into the next',
      ['| Variable | Default |', '|---|---|', '| `PORT <!-- a cite --> | `3001 |'],
      'guide line 103: a backtick with no closing backtick',
    ],
    [
      'a backtick that never closes above a code block, with a comment after it and a backtick in the text below the block: no code span runs past a code block',
      ['A lone ` backtick <!-- a cite --> above a code block', '```', 'docker ps', '```', 'More text with a ` backtick.'],
      'guide line 101: a backtick with no closing backtick',
    ],
    ['a hexadecimal HTML entity written with a capital X', ['Copyright &#XA9; HAIWAVE.'], 'guide line 101: an HTML entity'],
    ['a named HTML entity with digits in its name', ['Add &frac12; cup.'], 'guide line 101: an HTML entity'],
    ['a named HTML entity that begins with a capital letter', ['The letter &Auml; is one.'], 'guide line 101: an HTML entity'],
    ['an HTML element written in capitals', ['A first line<BR>and a second.'], 'guide line 101: an HTML element or tag'],
    ['an asterisk before white space, which opens nothing for the asterisk after the next word to close', ['The sizes are 2 * 3* by default.'], 'guide line 101: an asterisk is left over'],
    [
      'a backslash at the end of the second line of a paragraph, with that line',
      ['A first line of a paragraph,', 'a second line that ends with a backslash\\', 'and a third line.'],
      'guide line 102: a backslash',
    ],
    ['a backslash that begins the second line of a paragraph, after a code span on the first', ['Set `PORT` on the first line', 'C:\\data begins the second line.'], 'guide line 102: a backslash'],
    ['an asterisk that is left over on the second line of a paragraph, with that line', ['A first line', 'with 2 * 3 on its second line', 'and a third.'], 'guide line 102: an asterisk is left over'],
    ['a heading with two spaces after its # marks', ['##  First Steps'], 'guide line 101: a line that begins with # must be a heading'],
    ['a single = under a line of text', ['First Steps', '='], 'guide line 102: a rule is written as exactly ---'],
    ['a + alone on a line', ['A paragraph.', '', '+'], 'guide line 103: a bulleted item is written "- text"'],
    ['a ticked check box in a numbered item', ['1. [x] The agent is built.'], 'guide line 101: a check box is written "- [ ] text"'],
    ['a second row with an empty cell beside its hyphens', ['| Variable | Default |', '|---| |', '| PORT | 3001 |'], 'guide line 102: the second row of a table must be its delimiter row'],
    ['a second row of negative numbers', ['| Low | High |', '| -5 | -3 |'], 'guide line 102: the second row of a table must be its delimiter row'],
    ['a second row whose first cell alone is hyphens', ['| Variable | Default |', '|---| PORT |', '| HOST | 3001 |'], 'guide line 102: the second row of a table must be its delimiter row'],
    ['a code fence whose language holds a + sign', ['```c++', 'int a;', '```'], 'guide line 101: a code fence holds more than three backticks and a language name'],
    ['a comment right after the # marks of a heading', ['##<!-- a cite --> A heading'], 'guide line 101: a comment stands inside the marker that begins the line'],
    ['a comment right after the > of a note line', ['><!-- a cite --> A note.'], 'guide line 101: a comment stands inside the marker that begins the line'],
    ['a comment right after the number of a numbered item', ['1.<!-- a cite --> An item.'], 'guide line 101: a comment stands inside the marker that begins the line'],
    ['a comment right after the box of a check-box item', ['- [ ]<!-- a cite --> An item.'], 'guide line 101: a comment stands inside the marker that begins the line'],
    ['a comment right after the first | of a table row', ['|<!-- a cite --> Variable | Default |', '|---|---|'], 'guide line 101: a comment stands inside the marker that begins the line'],
    ['a paragraph separator character inside a line', ['The first line.\u2029The second line.'], 'guide line 101: a control character in a line of text, U+2029'],
    ['a delete character inside a line', ['A delete \u007f character.'], 'guide line 101: a control character in a line of text, U+007F'],
    ['a next-line character in a code line', ['```', 'a next-line \u0085 character', '```'], 'guide line 102: a control character in a code line, U+0085'],
    ['a link definition with no space after its colon', ['[documentation]:https://docs.example.com'], 'guide line 101: a link definition'],
    ['an asterisk between a letter and a currency sign, which counts as a punctuation mark', ['The price is n*$5* for each.'], 'guide line 101: an asterisk is left over'],
    ['an asterisk between a plus sign, which counts as a punctuation mark, and a letter', ['The sum *a+*b is small.'], 'guide line 101: an asterisk is left over'],
    ['a comment inside a code span in a table cell', ['| Variable | Default |', '|---|---|', '| `PORT <!-- a cite --> =3001` | none |'], 'guide line 103: a comment inside a code span'],
    ['a comment inside a code span that holds a pipe, in a line of text', ['Write `a | b <!-- a cite --> c` for either one.'], 'guide line 101: a comment inside a code span'],
    [
      'a second comment on a line that stands inside a code span, after a first one that does not',
      ['Set `PORT` first, <!-- a cite --> then `HOST <!-- another --> =1`.'],
      'guide line 101: a comment inside a code span',
    ],
    [
      'a backtick that never closes, with a comment after it on its line: there is no code span, and the backtick is named',
      ['A lone ` backtick <!-- a cite --> in the text.'],
      'guide line 101: a backtick with no closing backtick',
    ],
    [
      'a backtick that never closes in a paragraph, with a comment on a line of its own below it: the backtick is named, with its line',
      ['Run `docker compose', '<!-- a cite -->', '', 'Next.'],
      'guide line 101: a backtick with no closing backtick',
    ],
    [
      'a backtick that never closes on the first line of a paragraph, with a comment on its second line: the backtick is named, with its line',
      ['A first line with a lone ` backtick,', 'and a second line <!-- a cite --> after it.'],
      'guide line 101: a backtick with no closing backtick',
    ],
    [
      'comments on both lines of a code span that crosses the join of two lines: the first one is named, with its line',
      ['Run `docker <!-- one --> compose', 'up <!-- two --> -d` now.'],
      'guide line 101: a comment inside a code span',
    ],
    [
      'a comment in the first line of a code span and a comment on a line of its own inside the span: the first one is named, with its line',
      ['Run `docker <!-- one --> compose', '<!-- two -->', 'up -d` now.'],
      'guide line 101: a comment inside a code span',
    ],
    [
      'a comment whose text holds --!>, where HTML ends a comment too: the text up to the next --> would go with it',
      ['A first line.', 'Stop the agent first. <!-- haiClient:src/app.ts:10-20 --!> Then take the backup. <!-- haiClient:src/backup.ts:5-9 --> Then upgrade.'],
      'guide line 102: a comment holds --!>',
    ],
    [
      'a comment whose text holds --!>, on the first line of the body, with a later comment on its line',
      ['Run the backup first. <!-- cite --!> Then stop the agent. <!-- haiClient:src/app.ts:10-20 --> Then upgrade.'],
      'guide line 101: a comment holds --!>',
    ],
    [
      'a line that begins with a comment whose text holds --!>, which would be dropped whole as a line of comments',
      ['First line.', '<!-- x --!> Lost text <!-- y -->', 'Last line.'],
      'guide line 102: a comment holds --!>',
    ],
    [
      'a comment whose text holds --!>, after an earlier comment on its line',
      ['Stop the agent first. <!-- a cite --> Then take the backup. <!-- another --!> Then upgrade. <!-- a third -->'],
      'guide line 101: a comment holds --!>',
    ],
    [
      'a comment that touches the text on both of its sides, a word before it and a hyphen after it',
      ['Zero<!-- a cite -->-downtime rotation.'],
      'guide line 101: a comment touches the text beside it',
    ],
    ['a comment that touches the word before it, with a space after it', ['The console says why.<!-- a cite --> Then it stops.'], 'guide line 101: a comment touches the text beside it'],
    [
      'a comment that touches the word after it, with a space before it',
      ['A first line.', 'The console says why. <!-- a cite -->Then it stops.'],
      'guide line 102: a comment touches the text beside it',
    ],
    ['an asterisk right before a comment, which markdown readers show as an asterisk', ['x*<!-- c -->y*'], 'guide line 101: a comment touches the text beside it'],
    ['an asterisk right after a comment, which markdown readers show as an asterisk', ['*x<!-- c -->*y'], 'guide line 101: a comment touches the text beside it'],
    ['italic that would open right before a comment', ['x*<!-- c -->x*'], 'guide line 101: a comment touches the text beside it'],
    ['italic that would close right after a comment', ['A *word<!-- c -->*s here.'], 'guide line 101: a comment touches the text beside it'],
    ['a no-break space right before a comment, which is not a space', ['Text\u00a0<!-- a cite --> and more.'], 'guide line 101: a comment touches the text beside it'],
    ['a no-break space right after a comment, which is not a space', ['Text <!-- a cite -->\u00a0and more.'], 'guide line 101: a comment touches the text beside it'],
    ['a ">" that ends no comment, right before a comment', ['Use 3 ><!-- a cite --> 2 here.'], 'guide line 101: a comment touches the text beside it'],
    ['a "<" that opens no comment, right after a comment', ['Use 2 <!-- a cite --><3 here.'], 'guide line 101: a comment touches the text beside it'],
    [
      'a comment that begins the text of a note line, with text after it, which markdown readers show as it is written',
      ['> <!-- a cite --> **Planned.** Not yet.'],
      'guide line 101: a comment begins the text of a note line or of a list item',
    ],
    [
      'a comment that begins the text of the second line of a note, with text after it',
      ['> **Planned.** Not yet available;', '> <!-- a cite --> compare to **PDF** for now.'],
      'guide line 102: a comment begins the text of a note line or of a list item',
    ],
    [
      'a comment that begins the text of a bulleted item, with text after it',
      ['The settings:', '', '- <!-- a cite --> Set `PORT` first.'],
      'guide line 103: a comment begins the text of a note line or of a list item',
    ],
    [
      'a comment that begins the text of a bulleted item after two spaces, which would be a list item only once the comment is gone',
      ['-  <!-- a cite --> Run `a<b>c` now.'],
      'guide line 101: a comment begins the text of a note line or of a list item',
    ],
    [
      'a comment that begins the text of a numbered item, with text after it',
      ['1. Get the container.', '2. <!-- a cite --> **Build** it.'],
      'guide line 102: a comment begins the text of a note line or of a list item',
    ],
    [
      'a comment that begins the text of the tenth item of a numbered list, with text after it',
      [...Array.from({ length: 9 }, (_, index) => `${index + 1}. Step ${index + 1}.`), '10. <!-- a cite --> **Check** it.'],
      'guide line 110: a comment begins the text of a note line or of a list item',
    ],
    [
      'a comment that begins the text of a check-box item, with text after it',
      ['- [ ] Docker is installed.', '- [ ] <!-- a cite --> **Node** is installed.'],
      'guide line 102: a comment begins the text of a note line or of a list item',
    ],
    ['a note line that holds a comment and no text', ['> <!-- a cite -->'], 'guide line 101: a note line that is only ">"'],
    ['two asterisks before a space, which open nothing', ['A ** bold** word.'], 'guide line 101: an asterisk is left over'],
    ['two asterisks between a bracket and a letter, which close nothing', ['The sum **(a)**b is small.'], 'guide line 101: an asterisk is left over'],
    ['an asterisk between a letter and a bracket, with a punctuation mark earlier in the text', ['In short, n*(a)* holds.'], 'guide line 101: an asterisk is left over'],
  ])('refuses %s', (_label, markdown, message) => {
    expect(refusalAt101(markdown)).toMatch(beginning(message));
  });
});

describe('guideMarkdownToHtml: the form of its output', () => {
  it('writes one block after another, each on its own lines and with no blank line or indent between them', () => {
    const markdown = [
      '## §1 First Steps',
      '',
      '*Audience: A*',
      '',
      '1. **The Free Agent archive.** At ***Account › Agent Software***.',
      '2. Second item with `PARTICIPANT_ID`.',
      '',
      '- [ ] A check-box item.',
      '',
      '```bash',
      'PARTICIPANT_ID=<yours>',
      '```',
      '',
      '```',
      'a block with no language',
      '```',
      '',
      '> **Planned.** Not yet available.',
      '',
      '| Variable | Default |',
      '|---|---|',
      '| `PORT` | `3001` |',
      '',
      '---',
      '',
    ].join('\n');
    expect(guideMarkdownToHtml(markdown)).toBe(
      [
        '<h2>§1 First Steps</h2>',
        '<p><em>Audience: A</em></p>',
        '<ol>',
        '<li><strong>The Free Agent archive.</strong> At <strong><em>Account › Agent Software</em></strong>.</li>',
        '<li>Second item with <code>PARTICIPANT_ID</code>.</li>',
        '</ol>',
        '<ul class="checklist">',
        '<li>A check-box item.</li>',
        '</ul>',
        '<pre><code class="language-bash">PARTICIPANT_ID=&lt;yours&gt;',
        '</code></pre>',
        '<pre><code>a block with no language',
        '</code></pre>',
        '<blockquote class="planned">',
        '<p><strong>Planned.</strong> Not yet available.</p>',
        '</blockquote>',
        '<table>',
        '<thead>',
        '<tr><th>Variable</th><th>Default</th></tr>',
        '</thead>',
        '<tbody>',
        '<tr><td><code>PORT</code></td><td><code>3001</code></td></tr>',
        '</tbody>',
        '</table>',
        '<hr>',
        '',
      ].join('\n'),
    );
  });
});

/**
 * A guide body that uses every construct the guide's markdown has: both headings, a paragraph over several lines with
 * a code span across a line break, the three kinds of list (one directly below a paragraph line), code blocks in
 * bash, in ts and with no language, a table of six columns, the three kinds of note, rules, bold, italic, bold
 * italic, bold around a code span, and comments alone on a line and beside text.
 */
const EVERY_CONSTRUCT = [
  '<!-- a comment alone on its line -->',
  '## Contents',
  '',
  '**Enter here**',
  '- §0 How to fix this sheet',
  '- §1 First Steps',
  '',
  '---',
  '',
  '## §1 First Steps',
  '',
  "*Audience: A (every visitor's third week)*",
  '',
  'From a registered account to a working index, in two steps: get the container, <!-- a cite beside text -->',
  "and run it with a file named `agent.env`. The response is `{kind: 'value',",
  'nonce}` for a value. Set it to **`true`** to turn it on.',
  '',
  '### §1.1 What you want',
  '',
  '1. **The Free Agent archive.** At ***Account › Agent Software***.',
  '2. Second item with `PARTICIPANT_ID`.',
  '',
  '- [ ] A check-box item.',
  '- [ ] A second one, *with italic*.',
  '',
  '```bash',
  'PARTICIPANT_ID=<yours>',
  'docker run -d --name example-agent \\',
  '  -p 3001:3001 example-agent  # <!-- kept --> && done',
  '```',
  '',
  '```ts',
  'if (!result.ok) throw new Error(`extract failed: ${result.error.code}`);',
  '```',
  '',
  '```',
  'a block with no language',
  '```',
  '',
  '> **Planned.** Not yet available.',
  '',
  '> **Conventions.** Configuration is given as a variable (`MONOSPACE`).',
  '',
  '> A note with no label.',
  '',
  '| Field | Internal | Premier | Sharing Pair | Connection | Qualified |',
  '|---|---|---|---|---|---|',
  '| Name / SKU | ✓ | ✓ | ✓ | ✓ | ✓ |',
  '| `PORT` | `3001` | – | – | – | – |',
  '',
  '---',
  '',
].join('\n');

/** The element names and the class names in a piece of HTML, and its tags that carry anything but one class attribute. */
const vocabularyOf = (html: string) => {
  const tags = html.match(/<[a-z][^>]*>/g) ?? [];
  return {
    elements: [...new Set(tags.map((tag) => /^<([a-z][a-z0-9]*)/.exec(tag)?.[1]))].sort(),
    classes: [...new Set(tags.flatMap((tag) => /class="([^"]*)"/.exec(tag)?.[1].split(/\s+/) ?? []))].sort(),
    tagsWithOtherAttributes: tags.filter((tag) => !/^<[a-z][a-z0-9]*(?: class="[^"]*")?>$/.test(tag)),
  };
};

describe('the markup the print template styles', () => {
  const SAMPLE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'design', 'configuration-guide', 'guide-template-markup-sample.html');

  it('is what the converter emits: exactly the elements and classes of the committed markup sample, and no attribute but class', () => {
    // The sample opens with one HTML comment, which describes it and is not markup of the guide.
    const contract = vocabularyOf(readFileSync(SAMPLE, 'utf8').replace(/^<!--[\s\S]*?-->/, ''));
    const output = vocabularyOf(guideMarkdownToHtml(EVERY_CONSTRUCT));
    expect(output.elements).toEqual(contract.elements);
    expect(output.classes).toEqual(contract.classes);
    expect(output.tagsWithOtherAttributes).toEqual([]);
  });
});

describe('guideMarkdownToHtml: over a body that uses every construct', () => {
  it('gives the same string for the same input, each time', () => {
    const first = guideMarkdownToHtml(EVERY_CONSTRUCT);
    expect(guideMarkdownToHtml(EVERY_CONSTRUCT)).toBe(first);
    expect(guideMarkdownToHtml(EVERY_CONSTRUCT)).toBe(first);
  });

  it('ends its output with exactly one line break', () => {
    expect(guideMarkdownToHtml(EVERY_CONSTRUCT)).toMatch(/[^\n]\n$/);
    expect(guideMarkdownToHtml('A paragraph.\n\n\n')).toBe('<p>A paragraph.</p>\n');
  });
});

describe('verifyGuideHtml', () => {
  /** The converter's output for the body that uses every construct; made inside each test, so that a failure is that test's. */
  const converted = () => guideMarkdownToHtml(EVERY_CONSTRUCT);

  it("passes on the converter's own output for a body that uses every construct, and gives nothing back", () => {
    expect(verifyGuideHtml(EVERY_CONSTRUCT, converted())).toBeUndefined();
  });

  it.each<[string, (html: string) => string, string]>([
    ['a dropped <h3>', (html) => html.replace('<h3>§1.1 What you want</h3>\n', ''), 'subsection headings: 1 "### " lines in the markdown, 0 <h3> in the HTML'],
    ['a dropped <h2>', (html) => html.replace('<h2>Contents</h2>\n', ''), 'section headings: 2 "## " lines in the markdown, 1 <h2> in the HTML'],
    [
      'a changed character inside a <pre>',
      (html) => html.replace('PARTICIPANT_ID=&lt;yours&gt;', 'PARTICIPANT_ID=&lt;your&gt;'),
      "code block 1: its text in the HTML is not its fence's content, character for character (the first difference is at character 21; 114 characters in the markdown, 113 in the HTML)",
    ],
    [
      'a dropped <pre>',
      (html) => html.replace('<pre><code>a block with no language\n</code></pre>\n', ''),
      'code blocks: 3 fences in the markdown, 2 <pre> in the HTML',
    ],
    [
      'a dropped table row',
      (html) => html.replace('<tr><td>Name / SKU</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>\n', ''),
      'table rows: 3 rows in the markdown, 2 <tr> in the HTML',
    ],
    ['a table whose <table> tag is gone', (html) => html.replace('<table>\n', ''), 'tables: 1 delimiter rows in the markdown, 0 <table> in the HTML'],
    ['a dropped <li>', (html) => html.replace('<li>§1 First Steps</li>\n', ''), 'list items: 6 item lines in the markdown, 5 <li> in the HTML'],
    ['a dropped <hr>', (html) => html.replace('<hr>\n', ''), 'rules: 2 "---" lines in the markdown, 1 <hr> in the HTML'],
    [
      'a dropped note',
      (html) => html.replace('<blockquote>\n<p>A note with no label.</p>\n</blockquote>\n', ''),
      'notes: 3 notes in the markdown, 2 <blockquote> in the HTML',
    ],
    [
      'a planned note that lost its class',
      (html) => html.replace('<blockquote class="planned">', '<blockquote>'),
      'planned notes: 1 notes that begin "> **Planned.**" in the markdown, 0 class="planned" in the HTML',
    ],
    [
      'bold that was left as its asterisks',
      (html) => html.replace('<strong>Enter here</strong>', '**Enter here**'),
      'markdown left in the text outside <code>, "**": 0 expected, 2 in the HTML',
    ],
    [
      'a code span that was left as its backticks',
      (html) => html.replace('<code>agent.env</code>', '`agent.env`'),
      'markdown left in the text outside <code>, "`": 0 expected, 2 in the HTML',
    ],
    [
      'a link that was left as it was written',
      (html) => html.replace('<p>A note with no label.</p>', '<p>A note with [a link](https://example.com).</p>'),
      'markdown left in the text outside <code>, "](": 0 expected, 1 in the HTML',
    ],
    [
      'a comment of the markdown that went into the HTML as a comment',
      (html) => html.replace('get the container, and run', 'get the container, <!-- a cite beside text --> and run'),
      'markdown left in the text outside <code>, "<!--": 0 expected, 1 in the HTML',
    ],
    [
      'a comment of the markdown that went into the HTML as text',
      (html) => html.replace('get the container, and run', 'get the container, &lt;!-- a cite beside text --&gt; and run'),
      'markdown left in the text outside <code>, "<!--": 0 expected, 1 in the HTML',
    ],
  ])('refuses HTML with %s, and names the mismatch with both numbers', (_label, damage, mismatch) => {
    const html = converted();
    const damaged = damage(html);
    expect(damaged).not.toBe(html);
    expect(refusalOf(() => verifyGuideHtml(EVERY_CONSTRUCT, damaged))).toContain(mismatch);
  });

  /** A body with a list and three code blocks; the first block holds a blank line and a line that ends with two spaces. */
  const THREE_CODE_BLOCKS = [
    '## A section',
    '',
    '- One.',
    '- Two.',
    '',
    '```bash',
    'PARTICIPANT_ID=<yours>',
    '',
    '  indented, with two spaces at its end  ',
    '```',
    '',
    '```',
    'second block',
    '```',
    '',
    '```ts',
    'third block',
    '```',
    '',
  ].join('\n');

  it.each<[string, (html: string) => string, string]>([
    ['an added <li>', (html) => html.replace('<li>Two.</li>\n', '<li>Two.</li>\n<li>Three.</li>\n'), 'list items: 2 item lines in the markdown, 3 <li> in the HTML'],
    [
      'a changed character that keeps the length of a code block',
      (html) => html.replace('&lt;yours&gt;', '&lt;yourz&gt;'),
      "code block 1: its text in the HTML is not its fence's content, character for character (the first difference is at character 21; 65 characters in the markdown, 65 in the HTML)",
    ],
    [
      'a changed character in the third code block',
      (html) => html.replace('third block', 'third blocc'),
      "code block 3: its text in the HTML is not its fence's content, character for character (the first difference is at character 11; 12 characters in the markdown, 12 in the HTML)",
    ],
    [
      'two code blocks that changed places',
      (html) =>
        html.replace(
          '<pre><code>second block\n</code></pre>\n<pre><code class="language-ts">third block\n</code></pre>\n',
          '<pre><code class="language-ts">third block\n</code></pre>\n<pre><code>second block\n</code></pre>\n',
        ),
      "code block 2: its text in the HTML is not its fence's content, character for character (the first difference is at character 1; 13 characters in the markdown, 12 in the HTML)",
    ],
    [
      'a code block that lost its last line break',
      (html) => html.replace('second block\n</code>', 'second block</code>'),
      "code block 2: its text in the HTML is not its fence's content, character for character (the first difference is at character 13; 13 characters in the markdown, 12 in the HTML)",
    ],
    [
      'a code line that lost the two spaces at its end',
      (html) => html.replace('at its end  \n', 'at its end\n'),
      "code block 1: its text in the HTML is not its fence's content, character for character (the first difference is at character 63; 65 characters in the markdown, 63 in the HTML)",
    ],
    [
      'a code block that lost its blank line',
      (html) => html.replace('&lt;yours&gt;\n\n', '&lt;yours&gt;\n'),
      "code block 1: its text in the HTML is not its fence's content, character for character (the first difference is at character 24; 65 characters in the markdown, 64 in the HTML)",
    ],
  ])('refuses the HTML of a body with three code blocks and %s, and names the mismatch with both numbers', (_label, damage, mismatch) => {
    const html = guideMarkdownToHtml(THREE_CODE_BLOCKS);
    const damaged = damage(html);
    expect(damaged).not.toBe(html);
    expect(refusalOf(() => verifyGuideHtml(THREE_CODE_BLOCKS, damaged))).toContain(mismatch);
  });

  it('lists every mismatch in one refusal, one to a line', () => {
    const damaged = converted()
      .replace('<h3>§1.1 What you want</h3>\n', '')
      .replace('<hr>\n', '')
      .replace('<strong>Enter here</strong>', '**Enter here**');
    expect(refusalOf(() => verifyGuideHtml(EVERY_CONSTRUCT, damaged)).split('\n')).toEqual([
      "the guide's HTML does not match its markdown:",
      '- subsection headings: 1 "### " lines in the markdown, 0 <h3> in the HTML',
      '- rules: 2 "---" lines in the markdown, 1 <hr> in the HTML',
      '- markdown left in the text outside <code>, "**": 0 expected, 2 in the HTML',
    ]);
  });

  it.each<[string, string[]]>([
    [
      'a code fence that holds lines which look like headings, items, rows, rules and notes: none of them is counted',
      ['```', '## not a heading', '### nor this', '- not an item', '1. nor this', '| not | a row |', '|---|---|', '---', '> **Planned.** not a note', '```'],
    ],
    ['a note of two lines, which is one note', ['> **Conventions.** Configuration is given', '> as an environment variable.']],
    ['a note with a comment-only line between its two lines, which is still one note', ['> **Conventions.** Configuration is given', '<!-- a cite -->', '> as an environment variable.']],
    ['a note whose second line begins **Planned.**, which is not a planned note', ['> **Word files.** Their support is', '> **Planned.** and not here yet.']],
    [
      'comments that stand after a heading, at the end of a planned note, after a list item and after the rows of a table',
      ['## A heading <!-- a cite -->', '', '> **Planned.** Not yet. <!-- a cite -->', '', '- An item. <!-- one --><!-- two -->', '', '| A | B | <!-- four -->', '|---|---| <!-- five -->'],
    ],
    ['a code block that holds the texts &lt; and &amp;, which the HTML holds as &amp;lt; and &amp;amp;', ['```', 'echo "&lt; &amp; <b>"', '```']],
  ])("passes on the converter's own output for %s", (_label, markdown) => {
    const body = markdown.join('\n');
    expect(verifyGuideHtml(body, guideMarkdownToHtml(body))).toBeUndefined();
  });
});
