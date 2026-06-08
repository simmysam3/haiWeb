import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSession } from '@/lib/auth';
import { resolveDownloadSpec, fileExists, DOWNLOAD_DIR } from '@/lib/agent-downloads';

// fs access requires the Node.js runtime (not edge).
export const runtime = 'nodejs';

// Public download keys allowlist — anything else is a 400, never touches fs.
const KNOWN_DOWNLOADS = new Set(['guide', 'agent']);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ file: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { file } = await params;
  if (!KNOWN_DOWNLOADS.has(file)) {
    return NextResponse.json({ error: 'Unknown download' }, { status: 400 });
  }

  // Known key but not built yet (null spec), or the file is missing on disk → 404.
  const spec = await resolveDownloadSpec(file);
  if (!spec || !(await fileExists(spec.name))) {
    return NextResponse.json({ error: 'Not yet published' }, { status: 404 });
  }

  const data = await readFile(join(DOWNLOAD_DIR, spec.name));
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': spec.contentType,
      'Content-Disposition': `attachment; filename="${spec.name}"`,
      'Content-Length': String(data.length),
    },
  });
}
