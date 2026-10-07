/**
 * The configuration guide's markdown, converted to the HTML that the print template styles.
 *
 * The guide is written in a small, fixed markdown: section and subsection headings, paragraphs, bulleted, numbered and
 * check-box lists, fenced code blocks, pipe tables, one-paragraph notes, rules, bold, italic, bold italic and code
 * spans, with HTML comments that are dropped. The template styles exactly the markup this module emits, which
 * design/configuration-guide/guide-template-markup-sample.html shows in full, and nothing else.
 *
 *   parseGuideSource     reads the file's header comment (its Version: and Dated: lines and its note for the designer)
 *                        and the three lines of the cover, and gives the cover's four values and the body
 *   guideMarkdownToHtml  converts the body
 *   verifyGuideHtml      counts the body's markdown with a line scan of its own and compares the counts, and every
 *                        code block character for character, with the HTML
 *
 * Customers copy commands out of the printed guide, so nothing is guessed, skipped or passed through: a line that is
 * not written in that markdown is refused with a thrown Error that begins `guide line <n>: `, where <n> is the 1-based
 * line number in the guide's file, and that says what is wrong and what is allowed. A text that markdown readers do
 * not all read the same way, or do not show as it would be printed, is refused as well: a line directly below a list,
 * a note or a table (each ends at a blank line), a rule directly below a line of text, two lists with only blank
 * lines between them, a comment that begins a line, a note line or a list item and has text after it, a comment that
 * touches the text beside it, a comment inside a code span, asterisks that markdown readers show as asterisks, an
 * indented line, white space at the end of a line, a control character and a character that does not print. A guide
 * that needs a new kind of element needs it in the template first.
 *
 * Pure functions: no import, and no file access.
 */

/**
 * The longest code line the converter accepts, in characters. The print template fits 97 characters of code on one
 * line and wraps the 98th; a wrapped line would put a command's trailing `\` on a line of its own.
 */
export const GUIDE_CODE_LINE_MAX = 96;

/**
 * Refuse the guide: every refusal names the line, says what is wrong and says what is allowed.
 * @param {number} line the 1-based line number in the guide's file
 * @param {string} problem
 * @returns {never}
 */
function refuse(line, problem) {
  throw new Error(`guide line ${line}: ${problem}`);
}

/**
 * The line of the header comment that carries `label`: its line number and its trimmed value. The label stands at the
 * start of its line, after optional spaces. The value is found by the label, never by a line number.
 * @param {string[]} headerLines
 * @param {string} label
 * @returns {{ line: number, value: string }}
 */
function labelledLine(headerLines, label) {
  /** @type {{ line: number, value: string }[]} */
  const found = [];
  headerLines.forEach((text, index) => {
    const m = new RegExp(`^[ \\t]*${label}:(.*)$`).exec(text);
    if (m) found.push({ line: index + 1, value: m[1].trim() });
  });
  if (found.length === 0) refuse(1, `the header comment has no line "${label}: <value>". It needs exactly one.`);
  if (found.length > 1) refuse(found[1].line, `a second "${label}:" line. The header comment holds exactly one.`);
  return found[0];
}

/**
 * True for a real day of the calendar written YYYY-MM-DD.
 * @param {string} value
 */
function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

/** How the header comment's note for the designer reads; every refusal of the note says it. */
const NOTE_FORM =
  'The note reads: For the designer: title "<title>"; cover line "<cover line>", with each value on one line in straight double quotes.';

/**
 * The title and the cover line that the header comment's note for the designer names. White space, line breaks
 * included, may stand between the note's words and before each quoted value.
 * @param {string[]} headerLines
 * @returns {{ title: string, coverLine: string }}
 */
function designerNote(headerLines) {
  const header = headerLines.join('\n');
  const labels = [...header.matchAll(/^[ \t]*For\s+the\s+designer:/gm)];
  if (labels.length === 0) refuse(1, `the header comment has no note for the designer. ${NOTE_FORM}`);
  /** @param {number} offset */
  const lineAt = (offset) => header.slice(0, offset).split('\n').length;
  if (labels.length > 1) {
    refuse(lineAt(labels[1].index), 'a second note "For the designer:". The header comment holds exactly one.');
  }
  const line = lineAt(labels[0].index);
  const rest = header.slice(labels[0].index + labels[0][0].length);
  const title = /^\s+title\s+"([^"\n]*)"/.exec(rest);
  if (!title) refuse(line, `the note for the designer has no title. ${NOTE_FORM}`);
  const coverLine = /^;\s+cover\s+line\s+"([^"\n]*)"/.exec(rest.slice(title[0].length));
  if (!coverLine) refuse(line, `the note for the designer has no cover line after its title. ${NOTE_FORM}`);
  for (const [name, value] of [['title', title[1]], ['cover line', coverLine[1]]]) {
    if (value === '') refuse(line, `the ${name} in the note for the designer is empty. ${NOTE_FORM}`);
    if (value.trim() !== value) {
      refuse(line, `the ${name} in the note for the designer begins or ends with white space. ${NOTE_FORM}`);
    }
  }
  return { title: title[1], coverLine: coverLine[1] };
}

/** What the cover is; every refusal of the cover says it. */
const COVER_FORM =
  'After the header comment come the three lines of the cover: the logo image, the title "# <title>" and the bold cover line.';

/**
 * Read the guide's header comment and its cover, and give back the cover's four values and the body.
 * @param {string} markdown the guide's whole file
 * @returns {{ slots: { title: string, coverLine: string, version: string, date: string }, body: string, bodyFirstLine: number }}
 *   `body` is the text after the cover's third line; `bodyFirstLine` is the line number of its first line in the file
 */
export function parseGuideSource(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  if (!lines[0].startsWith('<!--')) {
    refuse(1, 'the file must begin with its header comment, which opens with <!-- at the start of line 1.');
  }
  const close = lines.findIndex((line) => line.includes('-->'));
  if (close === -1) refuse(1, 'the header comment that opens here does not close. It closes with a line that ends with -->');
  if (!lines[close].endsWith('-->')) {
    refuse(close + 1, 'text follows the --> that closes the header comment. The cover begins on a later line.');
  }
  const headerLines = lines.slice(0, close + 1);
  const version = labelledLine(headerLines, 'Version');
  if (!/^\d+(?:\.\d+)+$/.test(version.value)) {
    refuse(
      version.line,
      `Version ${JSON.stringify(version.value)} is not a version. Write two or more groups of digits joined by single dots, for example 1.104.0.`,
    );
  }
  const date = labelledLine(headerLines, 'Dated');
  if (!isCalendarDate(date.value)) {
    refuse(date.line, `Dated ${JSON.stringify(date.value)} is not a date. Write a real date as YYYY-MM-DD, for example 2026-10-06.`);
  }
  const note = designerNote(headerLines);
  // The cover: the first three lines after the header comment that are not blank.
  /** @type {number[]} */
  const cover = [];
  for (let at = close + 1; at < lines.length && cover.length < 3; at += 1) if (lines[at] !== '') cover.push(at);
  if (cover.length < 3) {
    refuse(lines.length, `the cover is not complete: the file ends after ${cover.length} of its three lines. ${COVER_FORM}`);
  }
  const [image, title, coverLine] = cover;
  if (!/^!\[[^\]]*\]\([^()\s]+\)$/.test(lines[image])) {
    refuse(image + 1, `the first line after the header comment must be the logo image, written ![name](file). ${COVER_FORM}`);
  }
  if (!lines[title].startsWith('# ')) {
    refuse(title + 1, `the second line of the cover must be the title, written "# <title>". ${COVER_FORM}`);
  }
  const coverTitle = lines[title].slice(2);
  if (coverTitle !== note.title) {
    refuse(
      title + 1,
      `the title ${JSON.stringify(coverTitle)} differs from the title in the note for the designer, ${JSON.stringify(note.title)}. ` +
        'The two must be the same, character for character.',
    );
  }
  const coverParts = lines[coverLine].split('**');
  if (!lines[coverLine].startsWith('**') || coverParts.length % 2 === 0) {
    refuse(coverLine + 1, `the third line of the cover must be the bold cover line, which begins with ** and closes each ** it opens. ${COVER_FORM}`);
  }
  const coverText = coverParts.join('');
  if (coverText !== note.coverLine) {
    refuse(
      coverLine + 1,
      `the cover line ${JSON.stringify(coverText)} differs from the cover line in the note for the designer, ${JSON.stringify(note.coverLine)}. ` +
        'With its ** markers removed, the cover line must be the same, character for character.',
    );
  }
  return {
    slots: { title: note.title, coverLine: note.coverLine, version: version.value, date: date.value },
    body: lines.slice(coverLine + 1).join('\n'),
    bodyFirstLine: coverLine + 2,
  };
}

/** The three characters that HTML reads as markup, and what the output writes for each. No other character is changed. */
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

/** @param {string} text */
function escapeHtml(text) {
  return text.replace(/[&<>]/g, (character) => ENTITIES[character]);
}

/**
 * What may not stand in text outside a code span, each with what its refusal says.
 * @type {[RegExp, string][]}
 */
const NOT_TEXT = [
  [/\]\(/, 'a link or an image, "](". The template has no links and prints no image but the logo: write an address as text or in a code span.'],
  [/\[\^/, 'a footnote, "[^". The template has no footnotes: say it in the text.'],
  [/\\/, 'a backslash outside a code span. Markdown reads it as an escape: put the text that holds it in a code span.'],
  [/&(?:[A-Za-z][A-Za-z0-9]*|#[0-9]+|#[xX][0-9A-Fa-f]+);/, 'an HTML entity. Write the character itself: the converter writes &, < and > out for HTML.'],
  [/<[A-Za-z/!?]/, 'an HTML element or tag: a "<" followed by a letter, "/", "!" or "?". Put text of that kind in a code span.'],
  [/~~/, 'a strike-through, "~~". The template has none: remove the text or keep it.'],
];

/** How a code span is written; every refusal of a backtick says it. */
const CODE_SPAN_FORM = 'A code span is written `code`, with one backtick on each side and none inside.';

/** How bold and italic are written; every refusal of an asterisk says it. */
const EMPHASIS_FORM =
  'Bold is **text**, italic is *text* and bold italic is ***text***: the asterisks open right before the text and close right ' +
  'after it. They do not open after a letter or a digit when a punctuation mark follows them, as in n*(a), and do not close ' +
  'after a punctuation mark when a letter or a digit follows them, as in (a)*n. Bold may hold an italic span, and nothing else ' +
  'nests. An asterisk that is itself text goes in a code span.';

/** A punctuation mark or a symbol at the start of a text, and at its end: what markdown readers count as punctuation beside an asterisk. */
const MARK_AT_START = /^[\p{P}\p{S}]/u;
const MARK_AT_END = /[\p{P}\p{S}]$/u;

/** The tags of each emphasis, by the number of asterisks that open and close it. */
const EMPHASIS = {
  1: ['<em>', '</em>'],
  2: ['<strong>', '</strong>'],
  3: ['<strong><em>', '</em></strong>'],
};

/**
 * One source line's share of a text that the inline rules read as a whole.
 * @typedef {{ text: string, line: number }} Piece
 */

/**
 * The inline rules, over the lines of one paragraph, list item, table cell, heading or note joined with single spaces.
 * @param {Piece[]} pieces
 * @returns {string} HTML
 */
function inlineHtml(pieces) {
  const text = pieces.map((piece) => piece.text).join(' ');
  /**
   * The line that holds the character at `offset` of the joined text; the space that joins two lines counts to the
   * first of them.
   * @param {number} offset
   */
  const lineAt = (offset) => {
    let end = -1;
    for (const piece of pieces) {
      end += piece.text.length + 1;
      if (offset <= end) return piece.line;
    }
    return pieces[pieces.length - 1].line;
  };
  let html = '';
  // The emphasis that is open, innermost last: each with its number of asterisks and where it opened.
  /** @type {{ run: number, at: number }[]} */
  const open = [];
  let at = 0;
  while (at < text.length) {
    let end = at;
    if (text[at] === '`') {
      const close = text.indexOf('`', at + 1);
      if (close === -1) refuse(lineAt(at), `a backtick with no closing backtick. ${CODE_SPAN_FORM}`);
      if (close === at + 1) refuse(lineAt(at), `two backticks in a row. ${CODE_SPAN_FORM}`);
      if (text[close + 1] === '`') refuse(lineAt(close), `two backticks in a row. ${CODE_SPAN_FORM}`);
      html += `<code>${escapeHtml(text.slice(at + 1, close))}</code>`;
      end = close + 1;
    } else if (text[at] === '*') {
      while (text[end] === '*') end += 1;
      const run = end - at;
      const top = open.length > 0 ? open[open.length - 1].run : 0;
      // What stands on each side of the asterisks. The start and the end of the text count as white space.
      const before = text.slice(0, at);
      const after = text.slice(end);
      const spaceBefore = /(?:^|\s)$/.test(before);
      const spaceAfter = /^(?:\s|$)/.test(after);
      const markBefore = MARK_AT_END.test(before);
      const markAfter = MARK_AT_START.test(after);
      // As markdown readers read them: asterisks open only right before text, and before a punctuation mark only when
      // white space or another punctuation mark stands before them; they close only right after text, and after a
      // punctuation mark only when white space or another punctuation mark follows them.
      const opens = !spaceAfter && (!markAfter || spaceBefore || markBefore);
      const closes = !spaceBefore && (!markBefore || spaceAfter || markAfter);
      if (run === top && closes) {
        html += EMPHASIS[run][1];
        open.pop();
      } else if (run <= 3 && (top === 0 || (top === 2 && run === 1)) && opens) {
        html += EMPHASIS[run][0];
        open.push({ run, at });
      } else {
        refuse(lineAt(at), `an asterisk is left over: it neither opens nor closes bold or italic. ${EMPHASIS_FORM}`);
      }
    } else {
      while (end < text.length && text[end] !== '*' && text[end] !== '`') end += 1;
      const plain = text.slice(at, end);
      // Of several faults the first in the text is the one refused, so that the line named is the first to correct.
      /** @type {{ index: number, problem: string } | null} */
      let fault = null;
      for (const [pattern, problem] of NOT_TEXT) {
        const found = pattern.exec(plain);
        if (found && (fault === null || found.index < fault.index)) fault = { index: found.index, problem };
      }
      if (fault !== null) refuse(lineAt(at + fault.index), fault.problem);
      html += escapeHtml(plain);
    }
    at = end;
  }
  if (open.length > 0) {
    refuse(lineAt(open[open.length - 1].at), `an asterisk is left over: what opens here does not close. ${EMPHASIS_FORM}`);
  }
  return html;
}

/** What the refusal of a line that begins with white space says. */
const INDENTED = 'the line begins with white space. No line is indented: there is no nested list, no continuation line and no indented code.';

/** What the refusal of a line that ends with white space says. */
const TRAILING = 'the line ends with white space. Markdown reads spaces at the end of a line as a line break, and the template has none: remove them.';

/** What the refusal of a comment that stands inside a code span says. */
const COMMENT_IN_SPAN =
  'a comment inside a code span. A code span is kept character for character, so nothing is taken out of it: put the comment ' +
  'after the code span, or show the text in a code block, where a comment is code.';

/** What the refusal of a comment that touches the text of its line says. */
const COMMENT_TOUCHES =
  'a comment touches the text beside it. A comment stands apart: on each side of it stands a space, another comment, or the ' +
  'start or the end of the line. Markdown readers read the marks of a line with its comments in place, and the comments ' +
  'are gone before the line is converted: put a space between the comment and the text.';

/** How a code block is fenced; every refusal of a fence line says it. */
const FENCE_FORM =
  'A code block opens with a line that is exactly ``` or ``` and a language name in lower-case letters and digits, ' +
  'and closes with a line that is exactly ```, each at the start of its line.';

/** How a table is written; every refusal of a table says it. */
const TABLE_FORM =
  'A table is a header row, | a | b |, then a delimiter row of hyphens, |---|---|, then its body rows, each with the ' +
  "header's number of cells, and it ends at a blank line.";

/** How a note is written; every refusal of a note line says it. */
const NOTE_LINE_FORM = 'Each line of a note is written "> text", and the lines of one note stand together and form one paragraph.';

/** How a list is written; every refusal of a list says it. */
const LIST_FORM =
  'A list is one kind of item, one item per line, with no line indented: "- text" for a bulleted list, "- [ ] text" for a ' +
  'check-box list, or "1. text", "2. text" and so on for a numbered list. A list ends at a blank line.';

/** What the refusal of a check box that is not a line "- [ ] text" says. */
const NOT_A_CHECK_BOX = `a check box is written "- [ ] text", and it is never ticked: the template prints an empty box. ${LIST_FORM}`;

/**
 * Refuse a line that holds a tab, any other control character, or a format character, which does not print (a
 * zero-width space, a soft hyphen, a mark that turns the direction of the text): only printing characters may stand
 * in a line.
 * @param {string} text
 * @param {number} line
 * @param {string} where what kind of line it is, for the refusal
 */
function refuseControlCharacter(text, line, where) {
  const found = /[\p{Cc}\p{Cf}\u2028\u2029]/u.exec(text);
  if (!found) return;
  if (found[0] === '\t') refuse(line, `a tab ${where}. Write spaces: a tab has no fixed width in print.`);
  const code = found[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
  if (/\p{Cf}/u.test(found[0])) {
    refuse(line, `a character that does not print ${where}, U+${code}. It cannot be seen, and a command that is copied with it fails: remove it.`);
  }
  refuse(line, `a control character ${where}, U+${code}. Only printing characters may stand in a line.`);
}

/**
 * A line of the body without its HTML comments. Where a comment, or several in a row, stood, one space is left, and
 * none is left at either end of the line.
 *
 * A comment stands apart from the text of its line: on each side of it stands a space, another comment, or the start
 * or the end of the line, and a comment that touches text is refused. Markdown readers judge the marks of a line
 * (asterisks, backticks and the rest) with its comments in place, where a comment's `<` and `>` count as punctuation
 * marks, and this converter judges them once the comments are gone; with a space between a comment and the text, the
 * two read the line alike.
 *
 * Refused as well, because HTML ends a comment there and the text after it would be taken for the comment's and
 * lost: a comment written `<!-->` or `<!--->`, and a comment whose text holds `--!>`.
 * @param {string} text
 * @param {number} line
 */
function withoutComments(text, line) {
  if (/<!---?>/.test(text)) {
    refuse(
      line,
      'a comment that opens with <!--> or <!--->. HTML reads those characters as a whole comment with nothing in it, so the text ' +
        'after them is not in a comment: write a comment as <!-- text -->.',
    );
  }
  for (const [, inside] of text.matchAll(/<!--(.*?)-->/g)) {
    if (inside.includes('--!>')) {
      refuse(
        line,
        'a comment holds --!>. HTML ends a comment there as well as at -->, so the text after it is not in a comment: ' +
          'close a comment with --> alone, and keep --!> out of its text.',
      );
    }
  }
  // The texts around the comments. An empty one is the start or the end of the line, or two comments that touch.
  text.split(/<!--.*?-->/).forEach((piece, index, pieces) => {
    const touchesTheCommentAfter = index < pieces.length - 1 && piece !== '' && !piece.endsWith(' ');
    const touchesTheCommentBefore = index > 0 && piece !== '' && !piece.startsWith(' ');
    if (touchesTheCommentAfter || touchesTheCommentBefore) refuse(line, COMMENT_TOUCHES);
  });
  const cleaned = text.replace(/ *(?:<!--.*?--> *)+/g, ' ').replace(/^ +| +$/g, '');
  if (cleaned.includes('<!--')) {
    refuse(line, 'a comment opens with <!-- and does not close with --> on the same line. A comment opens and closes on one line.');
  }
  return cleaned;
}

/**
 * One line of the body, read on its own: what kind of line it is, and its text without the marker of its kind. A whole
 * code block is one entry of kind `fence`: its text is the block's content, and `language` is what its fence names.
 * A numbered item carries its `number` as it is written.
 * @typedef {{ kind: 'blank' | 'h2' | 'h3' | 'rule' | 'bullet' | 'check' | 'number' | 'row' | 'note' | 'text' | 'fence', line: number,
 *             text: string, language?: string, number?: string }} BodyLine
 */

/**
 * The text of a note line or of a list item, which must be text and nothing else: nothing nests. A text that would
 * itself begin a block, or that would be refused as a line of its own, is refused.
 * @param {string} text
 * @param {number} line
 * @param {string} holder what holds the text, for the refusal
 */
function textOnly(text, line, holder) {
  let kind;
  try {
    kind = readLine(text, line).kind;
  } catch {
    kind = 'refused';
  }
  if (kind !== 'text') {
    refuse(
      line,
      `${holder} holds text only, and this one begins as another block would (a heading, a list item, a note, a table row, a rule or a code fence). ` +
        'Nothing nests.',
    );
  }
  return text;
}

/**
 * @param {string} text one line of the body
 * @param {number} line its line number in the guide's file
 * @returns {BodyLine}
 */
function readLine(text, line) {
  if (text === '') return { kind: 'blank', line, text };
  // A fence line never comes here as a line of the body: the code blocks are taken out of the lines first. This is
  // the text of a note line or of a list item.
  if (text.startsWith('```')) refuse(line, `a code fence stands inside a note or a list item. ${FENCE_FORM}`);
  if (text.startsWith('#')) {
    const heading = /^(#{2,3}) (\S.*)$/.exec(text);
    if (!heading) {
      refuse(
        line,
        'a line that begins with # must be a heading: "## text" for a section or "### text" for a subsection. ' +
          'The title "# text" belongs to the cover alone, and the template has no deeper heading.',
      );
    }
    if (/ #+$/.test(heading[2])) refuse(line, 'a heading closes with # marks. Write it with the opening marks alone: "## text".');
    return { kind: heading[1].length === 2 ? 'h2' : 'h3', line, text: heading[2] };
  }
  if (text === '---') return { kind: 'rule', line, text };
  if (/^(?:([-*_])(?: *\1){2,}|=+)$/.test(text)) {
    refuse(line, 'a rule is written as exactly ---, and a heading as "## text" or "### text", never as a line of marks under its text.');
  }
  if (text.startsWith('|')) return { kind: 'row', line, text };
  if (text.startsWith('>')) {
    if (text === '>') refuse(line, `a note line that is only ">": a note is one paragraph. ${NOTE_LINE_FORM}`);
    if (/^> *>/.test(text)) refuse(line, `a note inside a note: notes do not nest. ${NOTE_LINE_FORM}`);
    const note = /^> (\S.*)$/.exec(text);
    if (!note) refuse(line, `a note line must be written "> text", with one space between the > and the text. ${NOTE_LINE_FORM}`);
    return { kind: 'note', line, text: textOnly(note[1], line, 'a note') };
  }
  const check = /^- \[ \] (\S.*)$/.exec(text);
  if (check) return { kind: 'check', line, text: textOnly(check[1], line, 'a list item') };
  if (/^- \[[ xX]?\]/.test(text)) refuse(line, NOT_A_CHECK_BOX);
  const bullet = /^- (\S.*)$/.exec(text);
  if (bullet) return { kind: 'bullet', line, text: textOnly(bullet[1], line, 'a list item') };
  if (text.startsWith('-')) {
    refuse(line, `a line that begins with - must be a list item, "- text" or "- [ ] text", or the rule, which is exactly ---. ${LIST_FORM}`);
  }
  if (/^[*+](?: |$)/.test(text)) refuse(line, `a bulleted item is written "- text", with a hyphen. ${LIST_FORM}`);
  const number = /^(\d+)([.)])(?: (.*))?$/.exec(text);
  if (number) {
    if (number[2] === ')' || number[3] === undefined || !/^\S/.test(number[3])) {
      refuse(line, `a numbered item is written "1. text", with a full stop after its number and one space before its text. ${LIST_FORM}`);
    }
    if (/^\[[ xX]?\]/.test(number[3])) refuse(line, NOT_A_CHECK_BOX);
    return { kind: 'number', line, text: textOnly(number[3], line, 'a list item'), number: number[1] };
  }
  if (text.startsWith('![')) {
    refuse(line, 'an image. The template prints no image but the logo of the cover: show the content as a table or as a numbered list.');
  }
  if (/^\[[^\]]*\]:/.test(text)) {
    refuse(line, 'a link definition, "[name]: address". Markdown readers do not show such a line, and the template has no links: write the address as text.');
  }
  if (/^[:| -]*-[:| -]*$/.test(text)) {
    refuse(line, `a delimiter row of a table that does not begin and end with |. ${TABLE_FORM}`);
  }
  return { kind: 'text', line, text };
}

/** The list that each kind of item line makes: its opening tag and its closing tag. */
const LISTS = {
  bullet: ['<ul>', '</ul>'],
  check: ['<ul class="checklist">', '</ul>'],
  number: ['<ol>', '</ol>'],
};

/**
 * The cells of one row of a table: the texts between its pipes, trimmed.
 * @param {BodyLine} row
 */
function cellsOf(row) {
  if (row.text.includes('\\|')) {
    refuse(row.line, `an escaped pipe, \\|, in a table row: a pipe always divides two cells. ${TABLE_FORM}`);
  }
  if (row.text.length < 2 || !row.text.endsWith('|')) refuse(row.line, `a table row must begin and end with |. ${TABLE_FORM}`);
  return row.text.slice(1, -1).split('|').map((cell) => cell.trim());
}

/**
 * A table as HTML.
 * @param {BodyLine[]} rows the table's lines: its header row, its delimiter row, then its body rows
 */
function tableHtml(rows) {
  const [header, delimiter, ...body] = rows;
  /**
   * @param {BodyLine} row
   * @param {'th' | 'td'} tag
   */
  const rowHtml = (row, tag) =>
    `<tr>${cellsOf(row).map((cell) => `<${tag}>${inlineHtml([{ text: cell, line: row.line }])}</${tag}>`).join('')}</tr>`;
  if (!delimiter) refuse(header.line, `a table needs a delimiter row below its header row. ${TABLE_FORM}`);
  if (cellsOf(delimiter).some((marks) => marks.includes(':'))) {
    refuse(delimiter.line, `a colon in the delimiter row of a table: the template does not align columns. ${TABLE_FORM}`);
  }
  /**
   * True for a row that reads as a delimiter row: hyphens alone in each of its cells.
   * @param {BodyLine} row
   */
  const hyphensOnly = (row) => cellsOf(row).every((marks) => /^-+$/.test(marks));
  if (!hyphensOnly(delimiter)) {
    refuse(delimiter.line, `the second row of a table must be its delimiter row, with hyphens alone in each cell. ${TABLE_FORM}`);
  }
  const columns = cellsOf(header).length;
  for (const row of [delimiter, ...body]) {
    const cells = cellsOf(row).length;
    if (cells !== columns) refuse(row.line, `the cell count of this table row is ${cells} and the header's is ${columns}. ${TABLE_FORM}`);
  }
  for (const row of [header, ...body]) {
    if (hyphensOnly(row)) {
      refuse(
        row.line,
        'a row of hyphens that is not the second row of its table. Only the second row is the delimiter row: put a blank line ' +
          `between two tables, and write an empty value as a dash (–), not as a hyphen in every cell of a row. ${TABLE_FORM}`,
      );
    }
  }
  return ['<table>', '<thead>', rowHtml(header, 'th'), '</thead>', '<tbody>', ...body.map((row) => rowHtml(row, 'td')), '</tbody>', '</table>'].join('\n');
}

/**
 * Convert the guide's body to the HTML that fills the print template's body.
 * @param {string} body the guide's text after its cover
 * @param {{ firstLine?: number }} [options] `firstLine` is the line number of `body`'s first line in the guide's file,
 *   which the refusals count from; 1 when it is not given
 * @returns {string} one block after another, each followed by one line break
 */
export function guideMarkdownToHtml(body, { firstLine = 1 } = {}) {
  /** @type {BodyLine[]} */
  const lines = [];
  // The code block that is open: its language, its lines so far, and the line of its opening fence.
  /** @type {{ language: string, code: string[], line: number } | null} */
  let fence = null;
  // The code span that is open at the end of the line above, when a next line may go on with it (the line above is a
  // line of a paragraph or of a note): `comment` is the line of the first comment that stands in it, if one does.
  /** @type {{ comment: number | null } | null} */
  let span = null;
  body.split('\n').forEach((text, index) => {
    const line = firstLine + index;
    if (/^\s+```/.test(text)) {
      refuse(line, `a code fence is indented. ${FENCE_FORM}`);
    }
    if (fence) {
      if (text === '```') {
        lines.push({ kind: 'fence', line: fence.line, text: fence.code.map((code) => `${code}\n`).join(''), language: fence.language });
        fence = null;
      } else if (text.startsWith('```')) {
        refuse(line, `inside a code block, a line begins with three backticks and is not the closing fence. ${FENCE_FORM}`);
      } else {
        refuseControlCharacter(text, line, 'in a code line');
        if (text.length > GUIDE_CODE_LINE_MAX) {
          refuse(
            line,
            `a code line of ${text.length} characters. The limit is ${GUIDE_CODE_LINE_MAX}: a longer line wraps in print, and a wrapped command ` +
              'breaks when it is copied. Shorten the line or split it.',
          );
        }
        fence.code.push(text);
      }
      return;
    }
    if (text.startsWith('```')) {
      const opening = /^```([a-z0-9]*)$/.exec(text);
      if (!opening) refuse(line, `a code fence holds more than three backticks and a language name. ${FENCE_FORM}`);
      fence = { language: opening[1], code: [], line };
      return;
    }
    if (/^\s/.test(text)) refuse(line, INDENTED);
    refuseControlCharacter(text, line, 'in a line of text');
    if (/\s$/.test(text)) refuse(line, TRAILING);
    // The marker that begins a line is written whole: "-<!-- … --> text" is a list item only once its comment is gone.
    if (/^[-#>*+|\d.)[\] ]*[-#>*+|\d.)[\]]<!--/.test(text)) {
      refuse(line, 'a comment stands inside the marker that begins the line. Put the comment after the text of the line.');
    }
    const cleaned = withoutComments(text, line);
    // A line that begins with a comment holds comments only: markdown readers read such a line as HTML, and show text
    // that follows the comment as it is written, with its marks.
    if (text.startsWith('<!--') && cleaned !== '') {
      refuse(
        line,
        'a comment begins the line and text follows it. Markdown readers read such a line as HTML and show its text as it is ' +
          'written, with its marks: put the comment after the text of the line, or on a line of its own.',
      );
    }
    // The same holds where a comment begins the text of a note line or of a list item: the rest of that line is shown
    // as it is written. (A heading and a table cell that begin with a comment are shown formatted, and stay.) The line
    // is read as it is written, with any number of spaces before the comment: once the comment is gone those spaces
    // are one space, and "-  <!-- … --> text" would pass for a list item.
    const begun = /^(>|- \[ \]|-|\d+\.) +<!--/.exec(text);
    if (begun && cleaned !== begun[1]) {
      refuse(
        line,
        'a comment begins the text of a note line or of a list item, and text follows it. Markdown readers show the rest of ' +
          'such a line as it is written, with its marks: put the comment after the text of the line.',
      );
    }
    // Other white space than spaces, left at the end of the line by a comment that stood there.
    if (/\s$/.test(cleaned)) refuse(line, TRAILING);
    // A line that held only comments is dropped. It is not a blank line: the block around it goes on, and so does a
    // code span that is open.
    if (cleaned === '' && text !== '') {
      if (span !== null && span.comment === null) span.comment = line;
      return;
    }
    const read = readLine(cleaned, line);
    // The backticks and the comments of the line, in order. A comment may not stand inside a code span: it is refused
    // where the backtick that closes its span is found, so that a backtick that never closes is named itself. A span
    // that is open at the end of the line above runs on only where this line goes on with that line's text, and in a
    // table row no span runs past the pipe that ends its cell.
    let open = span !== null && lines[lines.length - 1].kind === read.kind ? span : null;
    for (const [mark] of text.matchAll(/<!--.*?-->|[`|]/g)) {
      if (mark === '`') {
        if (open !== null && open.comment !== null) refuse(open.comment, COMMENT_IN_SPAN);
        open = open === null ? { comment: null } : null;
      } else if (mark === '|') {
        if (read.kind === 'row') open = null;
      } else if (open !== null && open.comment === null) {
        open.comment = line;
      }
    }
    span = open !== null && (read.kind === 'text' || read.kind === 'note') ? open : null;
    lines.push(read);
  });
  if (fence) refuse(fence.line, `the code block that opens here does not close. ${FENCE_FORM}`);
  /** @type {string[]} */
  const blocks = [];
  let at = 0;
  /**
   * The lines of one kind that stand together from `at` on; `at` moves past them.
   * @param {BodyLine['kind']} kind
   */
  const run = (kind) => {
    const start = at;
    while (at < lines.length && lines[at].kind === kind) at += 1;
    return lines.slice(start, at);
  };
  /**
   * A table, a note and a list each end at a blank line or at the end of the body. Markdown readers do not agree on
   * a line that follows one directly, so that line is refused.
   * @param {string} problem
   */
  const endsAtBlankLine = (problem) => {
    if (at < lines.length && lines[at].kind !== 'blank') refuse(lines[at].line, problem);
  };
  while (at < lines.length) {
    const first = lines[at];
    if (first.kind === 'blank') {
      at += 1;
    } else if (first.kind === 'h2' || first.kind === 'h3') {
      blocks.push(`<${first.kind}>${inlineHtml([first])}</${first.kind}>`);
      at += 1;
    } else if (first.kind === 'fence') {
      const open = first.language ? `<pre><code class="language-${first.language}">` : '<pre><code>';
      blocks.push(`${open}${escapeHtml(first.text)}</code></pre>`);
      at += 1;
    } else if (first.kind === 'rule') {
      blocks.push('<hr>');
      at += 1;
    } else if (first.kind === 'note') {
      const open = first.text.startsWith('**Planned.**') ? '<blockquote class="planned">' : '<blockquote>';
      blocks.push([open, `<p>${inlineHtml(run('note'))}</p>`, '</blockquote>'].join('\n'));
      endsAtBlankLine(`a note ends at a blank line, and this line stands directly below one. ${NOTE_LINE_FORM}`);
    } else if (first.kind === 'row') {
      blocks.push(tableHtml(run('row')));
      endsAtBlankLine(`a table row must begin and end with |, and this line stands directly below a table. ${TABLE_FORM}`);
    } else if (first.kind === 'bullet' || first.kind === 'check' || first.kind === 'number') {
      const [open, close] = LISTS[first.kind];
      const items = run(first.kind);
      if (first.kind === 'number') {
        items.forEach((item, index) => {
          const expected = String(index + 1);
          if (item.number === expected) return;
          if (index === 0) refuse(item.line, `a numbered list starts at 1, and this one starts at ${item.number}. ${LIST_FORM}`);
          refuse(item.line, `a numbered list counts up by one, so this item must be ${expected}. and it is ${item.number}. ${LIST_FORM}`);
        });
      }
      blocks.push([open, ...items.map((item) => `<li>${inlineHtml([item])}</li>`), close].join('\n'));
      if (at < lines.length && lines[at].kind === { bullet: 'check', check: 'bullet', number: '' }[first.kind]) {
        refuse(lines[at].line, `a list mixes check-box items and plain items. ${LIST_FORM}`);
      }
      endsAtBlankLine(`a list ends at a blank line, and this line stands directly below one. ${LIST_FORM}`);
      // The next line that is not blank: a list that begins there has only blank lines between it and this one. Markdown
      // readers join the two when both are numbered, and when both are written with a hyphen.
      let next = at;
      while (next < lines.length && lines[next].kind === 'blank') next += 1;
      if (next < lines.length && lines[next].kind in LISTS && (lines[next].kind === 'number') === (first.kind === 'number')) {
        refuse(
          lines[next].line,
          'a list begins here right after another list, with no line of text between the two. Markdown readers take lists that ' +
            'only blank lines separate for one list, and number a numbered one on (1, 2, 3), so the print would not be what they ' +
            'show: ' +
            `put a line of text or a heading between two lists, or write one list with no blank line between its items. ${LIST_FORM}`,
        );
      }
    } else {
      blocks.push(`<p>${inlineHtml(run('text'))}</p>`);
      if (at < lines.length && lines[at].kind === 'rule') {
        refuse(
          lines[at].line,
          'a rule directly below a line of text. Markdown readers read the two lines as a heading and its underline: put a blank line above the rule.',
        );
      }
    }
  }
  if (blocks.length === 0) refuse(firstLine, 'the body holds no content: nothing but blank lines and comments follows the cover.');
  return blocks.map((block) => `${block}\n`).join('');
}

/**
 * Text as it was before its &, < and > were written out for HTML. One pass, so that the text `&lt;` of a code line,
 * which the HTML holds as `&amp;lt;`, comes back as `&lt;` and not as `<`.
 * @param {string} text
 */
function unescapeHtml(text) {
  return text.replace(/&(amp|lt|gt);/g, (_entity, name) => ({ amp: '&', lt: '<', gt: '>' })[name]);
}

/**
 * Check converted HTML against the markdown it came from, with a count of the markdown that does not use the
 * converter: a gap in the converter on text that no test has seen shows up here as a mismatch.
 * @param {string} body the guide's body, as it was given to guideMarkdownToHtml
 * @param {string} html what guideMarkdownToHtml gave for it
 * @returns {void} nothing when the two agree; it throws one Error that lists every mismatch
 */
export function verifyGuideHtml(body, html) {
  // The markdown, counted by a line scan of its own: each line outside a code fence, with its comments removed.
  const counted = { h2: 0, h3: 0, delimiterRows: 0, rows: 0, items: 0, rules: 0, notes: 0, planned: 0 };
  // The content of each code fence, in order, and the lines of the fence that is open.
  /** @type {string[]} */
  const fences = [];
  /** @type {string[] | null} */
  let open = null;
  let inNote = false;
  for (const raw of body.split('\n')) {
    if (open !== null) {
      if (raw === '```') {
        fences.push(open.map((code) => `${code}\n`).join(''));
        open = null;
      } else {
        open.push(raw);
      }
      continue;
    }
    if (raw.startsWith('```')) {
      open = [];
      continue;
    }
    const line = raw.replace(/\s*(?:<!--.*?-->\s*)+/g, ' ').trim();
    // A line that held only comments is not a blank line: it does not end the note around it.
    if (line === '' && raw !== '') continue;
    if (line.startsWith('## ')) counted.h2 += 1;
    if (line.startsWith('### ')) counted.h3 += 1;
    if (/^\|(?:\s*-+\s*\|)+$/.test(line)) counted.delimiterRows += 1;
    else if (line.startsWith('|')) counted.rows += 1;
    if (/^(?:- |\d+\. )/.test(line)) counted.items += 1;
    if (line === '---') counted.rules += 1;
    // The lines of a note stand together: a note is counted where one begins.
    const noteLine = line.startsWith('>');
    if (noteLine && !inNote) {
      counted.notes += 1;
      if (line.startsWith('> **Planned.**')) counted.planned += 1;
    }
    inNote = noteLine;
  }
  /** @type {string[]} */
  const mismatches = [];
  /**
   * One count of the markdown against one count of the HTML.
   * @param {string} what
   * @param {number} inMarkdown
   * @param {string} markdownUnit
   * @param {RegExp} htmlPattern
   * @param {string} htmlUnit
   */
  const compare = (what, inMarkdown, markdownUnit, htmlPattern, htmlUnit) => {
    const inHtml = (html.match(htmlPattern) ?? []).length;
    if (inMarkdown !== inHtml) mismatches.push(`${what}: ${inMarkdown} ${markdownUnit} in the markdown, ${inHtml} ${htmlUnit} in the HTML`);
  };
  compare('section headings', counted.h2, '"## " lines', /<h2>/g, '<h2>');
  compare('subsection headings', counted.h3, '"### " lines', /<h3>/g, '<h3>');
  compare('tables', counted.delimiterRows, 'delimiter rows', /<table>/g, '<table>');
  compare('table rows', counted.rows, 'rows', /<tr>/g, '<tr>');
  compare('list items', counted.items, 'item lines', /<li>/g, '<li>');
  compare('rules', counted.rules, '"---" lines', /<hr>/g, '<hr>');
  compare('notes', counted.notes, 'notes', /<blockquote/g, '<blockquote>');
  compare('planned notes', counted.planned, 'notes that begin "> **Planned.**"', /class="planned"/g, 'class="planned"');
  compare('code blocks', fences.length, 'fences', /<pre>/g, '<pre>');
  // Each code block's text, with the three entities turned back, against its fence's content.
  const blocks = [...html.matchAll(/<pre><code(?: class="[^"]*")?>([\s\S]*?)<\/code><\/pre>/g)].map((found) => unescapeHtml(found[1]));
  fences.forEach((content, index) => {
    const block = blocks[index] ?? '';
    if (block === content) return;
    let at = 0;
    while (block[at] === content[at]) at += 1;
    mismatches.push(
      `code block ${index + 1}: its text in the HTML is not its fence's content, character for character ` +
        `(the first difference is at character ${at + 1}; ${content.length} characters in the markdown, ${block.length} in the HTML)`,
    );
  });
  // The text outside code, in which no markdown may be left.
  const text = unescapeHtml(html.replace(/<code(?: class="[^"]*")?>[\s\S]*?<\/code>/g, ''));
  for (const mark of ['**', '`', '](', '<!--']) {
    const left = text.split(mark).length - 1;
    if (left > 0) mismatches.push(`markdown left in the text outside <code>, ${JSON.stringify(mark)}: 0 expected, ${left} in the HTML`);
  }
  if (mismatches.length > 0) {
    throw new Error(`the guide's HTML does not match its markdown:\n${mismatches.map((mismatch) => `- ${mismatch}`).join('\n')}`);
  }
}
