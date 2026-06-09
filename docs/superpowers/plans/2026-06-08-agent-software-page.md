# Agent Software Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a gated "Agent Software" page to the HaiWeb console where a signed-in partner downloads the agent configuration guide (PDF) and a zip of the latest haiClient source.

**Architecture:** A new nav link → a server-rendered `/account/agent-software` page that lists two downloads. Both stream through an authenticated API route (`/api/agent-software/download/[file]`) that reads files from a non-public `private/agent-downloads/` dir. The zip is produced by a `git archive` build script (secret-safe: tracked files only). A shared `src/lib/agent-downloads.ts` is the tested core for manifest/spec resolution.

**Tech Stack:** Next.js 16 (app router, server components, Node runtime routes), TypeScript, Vitest + Testing Library, Tailwind, Keycloak session via `@/lib/auth` `getSession()`.

**Spec:** `docs/superpowers/specs/2026-06-08-agent-software-page-design.md`

**Branch:** `v1.49`

**Test command:** `npx vitest run <path>` (single file/pattern).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/account-nav.tsx` | add the bottom "Agent Software" nav section |
| `src/components/__tests__/account-nav.test.tsx` | assert the new nav link |
| `private/agent-downloads/{.gitkeep,.gitignore}` | non-public storage dir for PDF/zip/manifest |
| `src/lib/agent-downloads.ts` | shared: dir path, manifest loader, file-exists, download-spec allowlist |
| `src/lib/__tests__/agent-downloads.test.ts` | tests for the shared core |
| `src/app/api/agent-software/download/[file]/route.ts` | gated GET that streams a file |
| `src/app/api/agent-software/download/[file]/__tests__/route.test.ts` | route tests |
| `src/app/account/agent-software/page.tsx` | the page (server component) |
| `src/components/download-card.tsx` | presentational download row (available/disabled) |
| `src/components/__tests__/download-card.test.tsx` | card tests |
| `scripts/build-agent-zip.mjs` | `git archive` build script + manifest writer |
| `scripts/__tests__/build-agent-zip.test.ts` | build-script test (temp git fixture) |
| `package.json` | `build:agent-zip` npm script |

---

## Task 1: Storage directory

**Files:**
- Create: `private/agent-downloads/.gitkeep`
- Create: `private/agent-downloads/.gitignore`

No test (config only).

- [ ] **Step 1: Create the dir + keepfile**

Run:
```bash
mkdir -p private/agent-downloads
touch private/agent-downloads/.gitkeep
```

- [ ] **Step 2: Add the .gitignore** (ignore artifacts, keep the dir)

Create `private/agent-downloads/.gitignore`:
```gitignore
# Build artifacts + user-provided binaries — never commit these.
*
!.gitkeep
!.gitignore
```

- [ ] **Step 3: Commit**

```bash
git add private/agent-downloads/.gitkeep private/agent-downloads/.gitignore
git commit -m "chore(agent-software): non-public storage dir for agent downloads

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Nav link

**Files:**
- Modify: `src/components/account-nav.tsx` (append a section to `navSections`)
- Test: `src/components/__tests__/account-nav.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this `it` block inside the existing `describe('AccountNav', …)` in `src/components/__tests__/account-nav.test.tsx`:
```tsx
  it('shows the Agent Software link in the bottom nav section', () => {
    render(<AccountNav userName="Test User" userEmail="test@example.com" />);
    const link = screen.getByRole('link', { name: 'Agent Software' });
    expect(link.getAttribute('href')).toBe('/account/agent-software');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/account-nav.test.tsx -t "Agent Software"`
Expected: FAIL — `Unable to find role="link" and name "Agent Software"`.

- [ ] **Step 3: Add the nav section**

In `src/components/account-nav.tsx`, append this object as the **final element** of the `navSections` array (after the last existing section, before the closing `];`):
```ts
  {
    label: "Agent Software",
    items: [
      {
        href: "/account/agent-software",
        label: "Agent Software",
        tooltip: "Download the agent configuration guide and the latest agent client software.",
      },
    ],
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/account-nav.test.tsx`
Expected: PASS (all account-nav tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/account-nav.tsx src/components/__tests__/account-nav.test.tsx
git commit -m "feat(agent-software): add Agent Software nav link

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Shared downloads lib (the tested core)

**Files:**
- Create: `src/lib/agent-downloads.ts`
- Test: `src/lib/__tests__/agent-downloads.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/agent-downloads.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { readFile, stat } = vi.hoisted(() => ({ readFile: vi.fn(), stat: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile, stat }));

import { loadManifest, fileExists, resolveDownloadSpec } from '../agent-downloads';

beforeEach(() => vi.clearAllMocks());

describe('loadManifest', () => {
  it('parses manifest.json', async () => {
    readFile.mockResolvedValue(JSON.stringify({ version: '1.2.3', zipFile: 'a.zip', zipBytes: 5, builtAt: 'x' }));
    expect(await loadManifest('/d')).toEqual({ version: '1.2.3', zipFile: 'a.zip', zipBytes: 5, builtAt: 'x' });
  });
  it('returns null when missing/unreadable', async () => {
    readFile.mockRejectedValue(new Error('ENOENT'));
    expect(await loadManifest('/d')).toBeNull();
  });
});

describe('fileExists', () => {
  it('true when stat resolves', async () => {
    stat.mockResolvedValue({});
    expect(await fileExists('x.pdf', '/d')).toBe(true);
  });
  it('false when stat rejects', async () => {
    stat.mockRejectedValue(new Error('ENOENT'));
    expect(await fileExists('x.pdf', '/d')).toBe(false);
  });
});

describe('resolveDownloadSpec', () => {
  it('maps "guide" to the fixed PDF (no manifest needed)', async () => {
    expect(await resolveDownloadSpec('guide', '/d')).toEqual({
      name: 'configuration-guide.pdf', contentType: 'application/pdf',
    });
  });
  it('maps "agent" to the manifest zip', async () => {
    readFile.mockResolvedValue(JSON.stringify({ zipFile: 'haiwave-agent-v9.9.9.zip' }));
    expect(await resolveDownloadSpec('agent', '/d')).toEqual({
      name: 'haiwave-agent-v9.9.9.zip', contentType: 'application/zip',
    });
  });
  it('returns null for "agent" when no manifest exists', async () => {
    readFile.mockRejectedValue(new Error('ENOENT'));
    expect(await resolveDownloadSpec('agent', '/d')).toBeNull();
  });
  it('returns null for an unknown key', async () => {
    expect(await resolveDownloadSpec('passwd', '/d')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/agent-downloads.test.ts`
Expected: FAIL — cannot resolve `../agent-downloads`.

- [ ] **Step 3: Implement the lib**

Create `src/lib/agent-downloads.ts`:
```ts
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** Non-public directory holding the agent downloads (outside `public/`). */
export const DOWNLOAD_DIR = join(process.cwd(), 'private', 'agent-downloads');

export interface AgentManifest {
  version: string;
  zipFile: string;
  zipBytes: number;
  builtAt: string;
}

export interface DownloadSpec {
  name: string;
  contentType: string;
}

export async function loadManifest(dir: string = DOWNLOAD_DIR): Promise<AgentManifest | null> {
  try {
    return JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as AgentManifest;
  } catch {
    return null;
  }
}

export async function fileExists(name: string, dir: string = DOWNLOAD_DIR): Promise<boolean> {
  try {
    await stat(join(dir, name));
    return true;
  } catch {
    return false;
  }
}

/**
 * Map an allowlisted public key to a fixed on-disk file. The key (not raw user
 * input) selects the filename, so there is no path-traversal surface. Returns
 * null for unknown keys, or for "agent" before the zip has been built.
 */
export async function resolveDownloadSpec(
  file: string,
  dir: string = DOWNLOAD_DIR,
): Promise<DownloadSpec | null> {
  if (file === 'guide') {
    return { name: 'configuration-guide.pdf', contentType: 'application/pdf' };
  }
  if (file === 'agent') {
    const manifest = await loadManifest(dir);
    return manifest?.zipFile ? { name: manifest.zipFile, contentType: 'application/zip' } : null;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/agent-downloads.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-downloads.ts src/lib/__tests__/agent-downloads.test.ts
git commit -m "feat(agent-software): shared downloads lib (manifest + spec allowlist)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Gated download route

**Files:**
- Create: `src/app/api/agent-software/download/[file]/route.ts`
- Test: `src/app/api/agent-software/download/[file]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/agent-software/download/[file]/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession }));

const { resolveDownloadSpec, fileExists, DOWNLOAD_DIR } = vi.hoisted(() => ({
  resolveDownloadSpec: vi.fn(),
  fileExists: vi.fn(),
  DOWNLOAD_DIR: '/downloads',
}));
vi.mock('@/lib/agent-downloads', () => ({ resolveDownloadSpec, fileExists, DOWNLOAD_DIR }));

const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile }));

import { GET } from '../route';

const call = (file: string) =>
  GET(
    new NextRequest(`http://localhost/api/agent-software/download/${file}`),
    { params: Promise.resolve({ file }) },
  );

describe('GET /api/agent-software/download/[file]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ participant: { id: 'p1' } });
    fileExists.mockResolvedValue(true);
    readFile.mockResolvedValue(Buffer.from('bytes'));
    resolveDownloadSpec.mockResolvedValue({ name: 'configuration-guide.pdf', contentType: 'application/pdf' });
  });

  it('401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await call('guide');
    expect(res.status).toBe(401);
    expect(resolveDownloadSpec).not.toHaveBeenCalled();
  });

  it('400 for an unknown / traversal key (not in the allowlist)', async () => {
    const res = await call('passwd');
    expect(res.status).toBe(400);
    expect(resolveDownloadSpec).not.toHaveBeenCalled();
  });

  it('404 for a known key whose file is not built yet (null spec)', async () => {
    resolveDownloadSpec.mockResolvedValue(null);
    const res = await call('agent');
    expect(res.status).toBe(404);
  });

  it('404 when the resolved file is not on disk', async () => {
    fileExists.mockResolvedValue(false);
    const res = await call('agent');
    expect(res.status).toBe(404);
  });

  it('streams the file with attachment headers on success', async () => {
    resolveDownloadSpec.mockResolvedValue({ name: 'haiwave-agent-v9.9.9.zip', contentType: 'application/zip' });
    const res = await call('agent');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="haiwave-agent-v9.9.9.zip"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/agent-software/download/[file]/__tests__/route.test.ts"`
Expected: FAIL — cannot resolve `../route`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/agent-software/download/[file]/route.ts`:
```ts
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
```

> Note: an unknown key (not in `KNOWN_DOWNLOADS`) → **400**; a known key that isn't built/present yet → **404** (matches the spec error table). The page (Task 6) renders the unbuilt case as a disabled button, so users never hit the 404 through the UI.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/api/agent-software/download/[file]/__tests__/route.test.ts"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/agent-software/download/[file]/route.ts" "src/app/api/agent-software/download/[file]/__tests__/route.test.ts"
git commit -m "feat(agent-software): gated download route (auth + allowlist + stream)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Download card component

**Files:**
- Create: `src/components/download-card.tsx`
- Test: `src/components/__tests__/download-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/download-card.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DownloadCard } from '../download-card';

describe('DownloadCard', () => {
  it('renders a Download link when available', () => {
    render(<DownloadCard title="Guide" subtitle="sub" href="/api/x" available />);
    const link = screen.getByRole('link', { name: 'Download' });
    expect(link.getAttribute('href')).toBe('/api/x');
  });

  it('renders a disabled "Not yet published" state when unavailable', () => {
    render(<DownloadCard title="Guide" subtitle="sub" href="/api/x" available={false} />);
    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull();
    expect(screen.getByText('Not yet published')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/download-card.test.tsx`
Expected: FAIL — cannot resolve `../download-card`.

- [ ] **Step 3: Implement the component**

Create `src/components/download-card.tsx`:
```tsx
interface DownloadCardProps {
  title: string;
  subtitle: string;
  href: string;
  available: boolean;
}

export function DownloadCard({ title, subtitle, href, available }: DownloadCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
      <div>
        <div className="font-medium text-slate-900">{title}</div>
        <div className="text-sm text-slate-500">{subtitle}</div>
      </div>
      {available ? (
        <a
          href={href}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Download
        </a>
      ) : (
        <span className="rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-400">
          Not yet published
        </span>
      )}
    </div>
  );
}
```

> Styling note: these Tailwind utilities are functional defaults. If the codebase has an established card/button token set (check existing `/account/*` pages and `globals.css`), prefer matching those classes — but keep the `Download` link text and `Not yet published` span text unchanged (the tests assert them).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/download-card.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/download-card.tsx src/components/__tests__/download-card.test.tsx
git commit -m "feat(agent-software): DownloadCard component (available / disabled)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Agent Software page

**Files:**
- Create: `src/app/account/agent-software/page.tsx`

No new unit test (logic lives in the tested `agent-downloads` lib + `DownloadCard`); verified by build/typecheck + manual load.

- [ ] **Step 1: Implement the page**

Create `src/app/account/agent-software/page.tsx`:
```tsx
import { PageHeader } from '@/components/page-header';
import { DownloadCard } from '@/components/download-card';
import { loadManifest, fileExists } from '@/lib/agent-downloads';

export const runtime = 'nodejs';

export default async function AgentSoftwarePage() {
  const manifest = await loadManifest();
  const guideAvailable = await fileExists('configuration-guide.pdf');
  const agentAvailable = manifest ? await fileExists(manifest.zipFile) : false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Software"
        description="Download the agent configuration guide and the latest HAIWAVE agent client software."
      />
      <div className="space-y-4">
        <DownloadCard
          title="Configuration Guide (PDF)"
          subtitle="Step-by-step setup and configuration for your agent."
          href="/api/agent-software/download/guide"
          available={guideAvailable}
        />
        <DownloadCard
          title={`Agent — Latest Version${manifest ? ` (v${manifest.version})` : ''}`}
          subtitle={
            manifest
              ? `Built ${new Date(manifest.builtAt).toLocaleDateString()}`
              : 'Source archive of the latest agent client.'
          }
          href="/api/agent-software/download/agent"
          available={agentAvailable}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks and builds**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Run the dev server, sign in, visit `/account/agent-software`. Both cards show "Not yet published" until Task 7 builds the zip and you drop in the PDF.

- [ ] **Step 4: Commit**

```bash
git add src/app/account/agent-software/page.tsx
git commit -m "feat(agent-software): Agent Software console page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Build script (`git archive`)

**Files:**
- Create: `scripts/build-agent-zip.mjs`
- Test: `scripts/__tests__/build-agent-zip.test.ts`
- Modify: `package.json` (add `build:agent-zip` script)

> Requires `git` and `unzip` on PATH (both present on macOS dev). The test creates a throwaway git repo in the OS temp dir.

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/build-agent-zip.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAgentZip } from '../build-agent-zip.mjs';

const created: string[] = [];
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  created.push(d);
  return d;
}
afterEach(() => {
  created.forEach((d) => rmSync(d, { recursive: true, force: true }));
  created.length = 0;
});

function initRepo(): string {
  const dir = tmp('agentzip-repo-');
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 'T');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'agent', version: '9.9.9' }));
  writeFileSync(join(dir, 'index.ts'), 'export const x = 1;\n');
  writeFileSync(join(dir, '.gitignore'), '.env\n');
  writeFileSync(join(dir, '.env'), 'SECRET=shh\n'); // gitignored → must be excluded
  git('add', '-A');
  git('commit', '-qm', 'init');
  return dir;
}

describe('buildAgentZip', () => {
  it('archives tracked files, excludes gitignored secrets, writes manifest', () => {
    const repo = initRepo();
    const out = tmp('agentzip-out-');

    const manifest = buildAgentZip({ repoPath: repo, outDir: out, now: new Date('2026-06-08T00:00:00Z') });

    expect(manifest.version).toBe('9.9.9');
    expect(manifest.zipFile).toBe('haiwave-agent-v9.9.9.zip');
    expect(manifest.builtAt).toBe('2026-06-08T00:00:00.000Z');
    expect(existsSync(join(out, 'haiwave-agent-v9.9.9.zip'))).toBe(true);

    const onDisk = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    expect(onDisk).toEqual(manifest);

    const entries = execFileSync('unzip', ['-Z1', join(out, manifest.zipFile)]).toString();
    expect(entries).toContain('index.ts');
    expect(entries).toContain('package.json');
    expect(entries).not.toContain('.env');
  });

  it('throws on a non-git path', () => {
    const out = tmp('agentzip-out-');
    expect(() => buildAgentZip({ repoPath: out, outDir: out })).toThrow(/git repository/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/build-agent-zip.test.ts`
Expected: FAIL — cannot resolve `../build-agent-zip.mjs`.

- [ ] **Step 3: Implement the build script**

Create `scripts/build-agent-zip.mjs`:
```js
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Build a secret-safe source archive of the haiClient agent via `git archive`
 * (tracked files only — .env*, data/, *.duckdb, node_modules are gitignored and
 * therefore excluded), and write a manifest describing it.
 *
 * @param {{ repoPath: string, outDir: string, now?: Date }} opts
 * @returns {{ version: string, zipFile: string, zipBytes: number, builtAt: string }}
 */
export function buildAgentZip({ repoPath, outDir, now = new Date() }) {
  const repo = resolve(repoPath);
  if (!existsSync(join(repo, '.git'))) {
    throw new Error(`Not a git repository: ${repo}`);
  }

  const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
  const version = pkg.version;
  if (!version) {
    throw new Error(`No "version" in ${join(repo, 'package.json')}`);
  }

  mkdirSync(outDir, { recursive: true });
  const zipFile = `haiwave-agent-v${version}.zip`;
  const zipPath = join(outDir, zipFile);

  execFileSync('git', ['-C', repo, 'archive', '--format=zip', '-o', zipPath, 'HEAD'], { stdio: 'pipe' });

  const manifest = {
    version,
    zipFile,
    zipBytes: statSync(zipPath).size,
    builtAt: now.toISOString(),
  };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

// CLI entrypoint: `node scripts/build-agent-zip.mjs`
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const repoPath = process.env.AGENT_SOURCE_REPO ?? '../haiClient';
  const outDir = resolve('private/agent-downloads');
  const manifest = buildAgentZip({ repoPath, outDir });
  console.log(`Built ${manifest.zipFile} (${manifest.zipBytes} bytes) for agent v${manifest.version}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/__tests__/build-agent-zip.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the npm script**

In `package.json`, add to `"scripts"`:
```json
    "build:agent-zip": "node scripts/build-agent-zip.mjs",
```

- [ ] **Step 6: Run the real build once + verify secret-safety**

Run:
```bash
npm run build:agent-zip
unzip -Z1 private/agent-downloads/haiwave-agent-v*.zip | grep -E '^\.env|/\.env|\.duckdb$|^data/' || echo "OK: no secrets/data in archive"
cat private/agent-downloads/manifest.json
```
Expected: prints `OK: no secrets/data in archive` and a manifest with the haiClient version. (The zip + manifest are gitignored by Task 1's `.gitignore`.)

- [ ] **Step 7: Commit**

```bash
git add scripts/build-agent-zip.mjs scripts/__tests__/build-agent-zip.test.ts package.json
git commit -m "feat(agent-software): git-archive build script for the agent source zip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run the full HaiWeb test suite**

Run: `npx vitest run`
Expected: all green (including the 4 new test files).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual end-to-end**

1. Drop a real `configuration-guide.pdf` into `private/agent-downloads/`.
2. `npm run build:agent-zip` (produces the zip + manifest).
3. `npm run dev`, sign in, open **Agent Software** from the bottom of the console nav.
4. Both cards show as available with the version + date; clicking each downloads the file.
5. Signed out / no cookie: `GET /api/agent-software/download/agent` returns 401.

---

## Notes

- **No CI wiring** — `build:agent-zip` is run manually per agent release (per spec non-goals).
- **The PDF is user-provided** — the page shows "Not yet published" for the guide until the file is dropped into `private/agent-downloads/`.
- **DRY:** the route and the page both consume `src/lib/agent-downloads.ts`; manifest shape and the download allowlist live there only.
