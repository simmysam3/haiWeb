import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Record the configuration guide PDF that the console serves.
 *
 * The PDF is not built here. `npm run render:guide-pdf` renders it from the guide's markdown source in haiCore
 * (docs/client-implementation-guidelines-v<version>.md), puts it at private/agent-downloads/configuration-guide.pdf
 * and records it itself, through recordGuidePdf below. This command is for a PDF that was placed there by hand. It
 * writes configuration-guide.json beside the PDF:
 *
 *   bodySha256    the SHA-256 of the PDF's raw bytes (what `shasum -a 256 configuration-guide.pdf` prints)
 *   edition       the version in the source's file name
 *   sourceFile    the source's bare file name
 *   sourceSha256  the SHA-256 of the source read as UTF-8 text, the call publish:help-pack makes on the same file
 *   builtAt       the time of the record
 *
 * The console sends bodySha256 to Central with every help message, and publish:help-pack refuses unless the PDF on disk
 * still hashes to it and the source still hashes to sourceSha256. So run this after every replacement of the PDF by
 * hand, in the tree whose private/agent-downloads/ goes into the haiWeb image.
 *
 *   HAICORE_DIR=<haiCore checkout> npm run record:guide-pdf -- client-implementation-guidelines-v<version>.md
 *
 * The one argument is the source's bare file name. It is required: there is no default, and the command has no flags.
 * HAICORE_DIR (default ../haiCore) is the haiCore checkout that holds the source in docs/.
 *
 * A run is refused when the argument is missing or is not such a name, when the PDF is missing, is not a regular file,
 * is empty or does not begin with %PDF-, or when the source cannot be read. A refusal writes nothing, and a record that
 * is already there stays as it was. The %PDF- check catches a wrong file saved under the name; it does not validate the
 * PDF, and nothing here proves that the PDF was rendered from the named source. Exit 0 = recorded; 1 = refused.
 *
 * Node built-ins only, and no import from another script, so the file runs from wherever it is copied to.
 */

/** The name the console serves the guide under (the download route serves exactly this file). */
export const GUIDE_PDF_FILE = 'configuration-guide.pdf';
/** The record beside the PDF. The console reads it on every help request, and publish:help-pack reads it too. */
export const GUIDE_RECORD_FILE = 'configuration-guide.json';

/** The five bytes every PDF begins with. A file without them is the wrong file; a file with them is not thereby a good PDF. */
const PDF_MAGIC = Buffer.from('%PDF-');

/** @param {Buffer} bytes */
function sha256OfBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** @param {string} text */
function sha256OfText(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * The SHA-256 of a file's raw bytes, in lowercase hex: what `shasum -a 256 <path>` prints.
 * @param {string} path
 */
export function sha256OfFile(path) {
  return sha256OfBytes(readFileSync(path));
}

const SOURCE_FILE_RE = /^client-implementation-guidelines-v(\d+(?:\.\d+)+)\.md$/;

/**
 * The guide source's bare file name and the edition in it, or a refusal that quotes the name. Every name accepted here
 * also passes the protocol's pattern for manifest.guide.source_file, and the edition is the one Central reads from it.
 * @param {string} name
 * @returns {{ sourceFile: string, edition: string }}
 */
export function parseGuideSourceFile(name) {
  const m = SOURCE_FILE_RE.exec(name);
  if (!m) {
    throw new Error(
      `parseGuideSourceFile: ${JSON.stringify(name)} is not a guide source file name. Give the bare file name ` +
        'client-implementation-guidelines-v<version>.md, where <version> is two or more groups of digits joined by ' +
        'single dots, with no directory before it and nothing after it.',
    );
  }
  return { sourceFile: name, edition: m[1] };
}

/**
 * The PDF's bytes, or a refusal that names the path.
 * @param {string} pdfPath
 */
function readGuidePdf(pdfPath) {
  const stat = statSync(pdfPath, { throwIfNoEntry: false });
  if (!stat) throw new Error(`recordGuidePdf: ${pdfPath} is missing. Put the PDF there, under exactly that name.`);
  if (!stat.isFile()) throw new Error(`recordGuidePdf: ${pdfPath} is not a regular file.`);
  const pdf = readFileSync(pdfPath);
  if (pdf.length === 0) throw new Error(`recordGuidePdf: ${pdfPath} is empty.`);
  if (!pdf.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    throw new Error(`recordGuidePdf: ${pdfPath} does not begin with %PDF-, so it is not a PDF.`);
  }
  return pdf;
}

/**
 * Record the PDF in `downloadsDir` as the guide rendered from `sourceFile`. Every check runs first; the record is
 * written once, at the end, so a refusal (a thrown Error that says what is wrong) writes nothing.
 * @param {{ downloadsDir: string, haicoreDocsDir: string, sourceFile: string, now?: Date }} opts
 * @returns {{ record: { bodySha256: string, edition: string, sourceFile: string, sourceSha256: string, builtAt: string }, pdfBytes: number }}
 */
export function recordGuidePdf({ downloadsDir, haicoreDocsDir, sourceFile, now = new Date() }) {
  const { edition } = parseGuideSourceFile(sourceFile);
  const pdf = readGuidePdf(join(downloadsDir, GUIDE_PDF_FILE));
  const sourcePath = join(haicoreDocsDir, sourceFile);
  let source;
  try {
    source = readFileSync(sourcePath, 'utf8');
  } catch {
    throw new Error(`recordGuidePdf: cannot read the guide source ${sourcePath}. Set HAICORE_DIR to the haiCore checkout that holds it.`);
  }
  const record = {
    bodySha256: sha256OfBytes(pdf),
    edition,
    sourceFile,
    sourceSha256: sha256OfText(source),
    builtAt: now.toISOString(),
  };
  writeFileSync(join(downloadsDir, GUIDE_RECORD_FILE), JSON.stringify(record, null, 2) + '\n');
  return { record, pdfBytes: pdf.length };
}

const USAGE = 'Usage: HAICORE_DIR=<haiCore checkout> npm run record:guide-pdf -- client-implementation-guidelines-v<version>.md';

/**
 * The command: `args` must be exactly one string, the guide source's bare file name. A refusal is one `warn` call with
 * the reason, and never a thrown error.
 * @param {{ args: string[], haiwebDir: string, haicoreDir: string, now?: Date,
 *           log?: (message: string) => void, warn?: (message: string) => void }} opts
 * @returns {number} the exit code: 0 = recorded, 1 = refused
 */
export function main({ args, haiwebDir, haicoreDir, now, log = console.log, warn = console.error }) {
  try {
    if (args.length !== 1) {
      throw new Error(`record:guide-pdf takes exactly one argument, the guide source's bare file name, and ${args.length} came.`);
    }
    const { record, pdfBytes } = recordGuidePdf({
      downloadsDir: join(haiwebDir, 'private', 'agent-downloads'),
      haicoreDocsDir: join(haicoreDir, 'docs'),
      sourceFile: args[0],
      now,
    });
    log(
      `Recorded ${GUIDE_PDF_FILE} (${pdfBytes} bytes, sha256 ${record.bodySha256}) as edition ${record.edition}, ` +
        `source ${record.sourceFile} (sha256 ${record.sourceSha256}) → ${GUIDE_RECORD_FILE}`,
    );
    return 0;
  } catch (err) {
    warn(`${err instanceof Error ? err.message : String(err)}\nRefused: nothing was written.\n${USAGE}`);
    return 1;
  }
}

/**
 * True when this file is the process's entry point, false when it is imported (the tests import its functions).
 * Real paths on both sides. A file URL encodes a space, `#`, `%` and every non-ASCII character, and through a symlink
 * argv[1] is the link while import.meta.url is the file it points to: compared as text the two can differ, and the
 * command would then print nothing, write nothing and exit 0. An argv[1] that is absent or names no file has no real
 * path (realpathSync throws): it is not this file, and importing the module must not throw.
 */
function isEntryPoint() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  process.exit(
    main({
      args: process.argv.slice(2),
      haiwebDir: resolve('.'),
      haicoreDir: resolve(process.env.HAICORE_DIR ?? '../haiCore'),
    }),
  );
}
