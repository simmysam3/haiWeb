// src/components/help/help-markdown.tsx
'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';

/**
 * In-house safe Markdown subset for HAIWAVE Help answers (spec §7.2). No dependency
 * (SBOM footprint), React elements only — raw HTML in an answer is shown as text.
 */
export type HelpBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; start: number; items: string[] }
  | { kind: 'p'; text: string };

const FENCE_OPEN = /^\s*```\s*([\w+.-]*)\s*$/;
const FENCE_CLOSE = /^\s*```\s*$/;
const HEADING = /^(#{1,6})\s+(.+)$/;
const UL_ITEM = /^\s*[-*+]\s+(.*)$/;
const OL_ITEM = /^\s*(\d+)[.)]\s+(.*)$/;

function startsBlock(line: string): boolean {
  return FENCE_OPEN.test(line) || HEADING.test(line) || UL_ITEM.test(line) || OL_ITEM.test(line);
}

export function parseHelpMarkdown(source: string): HelpBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: HelpBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_CLOSE.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // the closing fence — absent while the answer is still streaming
      blocks.push({ kind: 'code', lang: fence[1], code: body.join('\n') });
      continue;
    }
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: Math.min(heading[1].length, 3) as 1 | 2 | 3, text: heading[2].trim() });
      i += 1;
      continue;
    }
    if (UL_ITEM.test(line)) {
      const items: string[] = [];
      let m: RegExpExecArray | null;
      while (i < lines.length && (m = UL_ITEM.exec(lines[i])) !== null) {
        items.push(m[1]);
        i += 1;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }
    const ol = OL_ITEM.exec(line);
    if (ol) {
      const items: string[] = [];
      let m: RegExpExecArray | null;
      while (i < lines.length && (m = OL_ITEM.exec(lines[i])) !== null) {
        items.push(m[2]);
        i += 1;
      }
      blocks.push({ kind: 'ol', start: Number(ol[1]), items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push({ kind: 'p', text: para.join('\n') });
  }
  return blocks;
}

// 1 code span · 2 link · 3 bold · 4 *italic* · 5 _italic_. Emphasis markers must not
// touch word characters, so `HAIWAVE_CENTRAL_CLIENT_ID` and `2 * 3 * 4` stay literal.
const INLINE =
  /(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\s]+\))|(?<![\w*])\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*(?![\w*])|(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])|(?<!\w)_(?!\s)([^_\n]+?)(?<!\s)_(?!\w)/g;
const LINK = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/;
const SAFE_HREF = /^https?:\/\/\S+$/i;

export function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}-${n}`;
    n += 1;
    if (m[1] !== undefined) {
      out.push(
        <code key={key} className="rounded bg-light-gray px-1 py-0.5 font-mono text-[0.85em] text-charcoal">
          {m[1].slice(1, -1)}
        </code>,
      );
    } else if (m[2] !== undefined) {
      const link = LINK.exec(m[2]);
      const label = link?.[1] ?? m[2];
      const href = link?.[2] ?? '';
      out.push(
        SAFE_HREF.test(href) ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-teal-dark underline">
            {label}
          </a>
        ) : (
          <span key={key}>{label}</span>
        ),
      );
    } else if (m[3] !== undefined) {
      out.push(<strong key={key}>{m[3]}</strong>);
    } else {
      out.push(<em key={key}>{m[4] ?? m[5]}</em>);
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Lines({ text, keyPrefix }: { text: string; keyPrefix: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <Fragment key={`${keyPrefix}-l${i}`}>
          {i > 0 && <br />}
          {renderInline(line, `${keyPrefix}-l${i}`)}
        </Fragment>
      ))}
    </>
  );
}

function CodeBlock({ code, lang, copyLabel, copiedLabel }: { code: string; lang: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    const pending = typeof navigator !== 'undefined' ? navigator.clipboard?.writeText(code) : undefined;
    pending?.then(
      () => setCopied(true),
      () => undefined,
    );
  };

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-navy p-3 pr-16 font-mono text-xs leading-relaxed text-white">
        <code data-lang={lang || undefined}>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded border border-white/30 px-2 py-0.5 text-[11px] text-white hover:bg-white/10"
      >
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}

const HEADING_TAGS = ['h3', 'h4', 'h5'] as const;

export function HelpMarkdown({ text, copyLabel, copiedLabel }: { text: string; copyLabel: string; copiedLabel: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-charcoal">
      {parseHelpMarkdown(text).map((block, i) => {
        const key = `b${i}`;
        switch (block.kind) {
          case 'heading': {
            const Tag = HEADING_TAGS[block.level - 1];
            return (
              <Tag key={key} className="font-semibold text-navy">
                {renderInline(block.text, key)}
              </Tag>
            );
          }
          case 'code':
            return <CodeBlock key={key} code={block.code} lang={block.lang} copyLabel={copyLabel} copiedLabel={copiedLabel} />;
          case 'ul':
            return (
              <ul key={key} className="list-disc space-y-1 pl-5">
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} start={block.start} className="list-decimal space-y-1 pl-5">
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </ol>
            );
          case 'p':
            return (
              <p key={key}>
                <Lines text={block.text} keyPrefix={key} />
              </p>
            );
        }
      })}
    </div>
  );
}
