# Run disposition on definition delete — HaiWeb Implementation Plan (v1.85 PR 2, part 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The console's delete dialog offers the run disposition (watchers: delete / archive / keep, default archive; audits: archive only, stated; phantom demand: unchanged), forwards it to haiCore, and both Runs lists plus both definition pages gain an Active | Archived toggle that shows archived runs with an `archived` pill.

**Architecture:** The HaiWeb haiCore client gains `runs` on `deleteRunTemplate` and `archived` on the two run-list calls; the BFF routes forward `?runs=` and `?archived=`. The shared `DefinitionEditor` dialog (shipped plain in PR 1) renders per-modality disposition UI and maps 409 `RUNS_IN_FLIGHT` to a form error. A small client `RunsFilterToggle` writes `?runs=archived` to the URL; the four server pages read it and pass `archived` to their history tables, which poll the scoped endpoint. The history column packs render an `archived` pill when `archived_at` is set.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, vitest 4.1.4 + Testing Library (jsdom), `@haiwave/protocol` via symlink.

**Spec:** `docs/superpowers/specs/2026-09-02-run-disposition-on-delete-design.md` §2 and §4. **Prerequisite:** the haiCore plan (`2026-09-02-run-disposition-haicore.md`) Tasks 1–6 merged, or at least built on the lane worktree, because this plan's types come from protocol 3.80.0.

## Global Constraints

- Work ONLY in `/Users/samfleming/dev/hw/haiWeb-v185` on branch `v1.85-run-disposition`. Start every shell command with `cd /Users/samfleming/dev/hw/haiWeb-v185 &&`. The primary `~/dev/hw/haiWeb` is the :3001 runtime — never touch it. `haiWeb-v185-scoring` belongs to another task — never touch it.
- Protocol during development: point this worktree at the lane haiCore build — `ln -sfn ../../../haiCore-v185/packages/protocol node_modules/@haiwave/protocol` — and verify `node -e 'console.log(require("@haiwave/protocol").PROTOCOL_VERSION)'` prints `3.80.0`. Restore to `../../../haiCore/packages/protocol` only after the haiCore PR merges and the primary is rebuilt. Never edit anything under `haiCore-v185/packages/protocol` from this plan.
- `npm run build` is the ONLY typecheck; run it foreground and read the exit code from the command itself. vitest: `npx vitest run … --maxWorkers=3` — this repo's vitest 4 rejects `--minWorkers`. The suite has `retry: 2`; a `(retry x` green is not green.
- Every pill goes through `<Pill>` with a `PILL_DEFINITIONS` entry; every drill-down chevron is `<DetailChevron/>` (repo CLAUDE.md).
- Copy is plain and specific; no "successfully"; consequences stated in one sentence. Wire fields snake_case.
- Commit after every green task with a conventional message ending in `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Do not push until Task 7.

---

### Task 1: haiCore client — `deleteRunTemplate(id, { runs })`, `archived` on both run lists

**Files:**
- Modify: `src/lib/haiwave-api.ts:672` (listWatcherRuns type), `:730` (deleteRunTemplate type), `:1562-1574` (listAuditRuns impl), `:1740-1751` (listWatcherRuns impl), `:1915-1920` (deleteRunTemplate impl)
- Test: `src/lib/__tests__/haiwave-api-run-disposition.test.ts`

**Interfaces:**
- Produces: `deleteRunTemplate(templateId: string, opts?: { runs?: RunsDisposition }): Promise<RunTemplateDeleteResponse>`; `listWatcherRuns(opts?: { limit?; template_id?; archived?: boolean })`; `listAuditRuns(opts?: { status?; limit?; template_id?; archived?: boolean })`. `RunsDisposition`, `RunTemplateDeleteResponse` imported from `@haiwave/protocol`.

- [ ] **Step 1: Write the failing test** (mirror the fetch-stub style of `src/lib/__tests__/haiwave-api-encoding.test.ts` — read it first for how the client is constructed and how `fetch` is stubbed; reuse its helper names)

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
// import the same client factory + fetch stub helpers the encoding test uses

describe('haiwave-api run disposition (3.80.0)', () => {
  it('deleteRunTemplate sends ?runs= and returns the disposition body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { deleted: true, runs: { disposition: 'archive', affected: 3 } }));
    const res = await client.deleteRunTemplate('t-1', { runs: 'archive' });
    expect(lastUrl()).toMatch(/\/sonar\/templates\/t-1\?runs=archive$/);
    expect(lastInit().method).toBe('DELETE');
    expect(res).toEqual({ deleted: true, runs: { disposition: 'archive', affected: 3 } });
  });
  it('deleteRunTemplate without opts sends no query string', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { deleted: true, runs: { disposition: 'keep', affected: 0 } }));
    await client.deleteRunTemplate('t-1');
    expect(lastUrl()).toMatch(/\/sonar\/templates\/t-1$/);
  });
  it('listWatcherRuns forwards archived=true and still filters template_id client-side', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { runs: [{ run_id: 'a', template_id: 't-1' }, { run_id: 'b', template_id: 't-2' }] }));
    const res = await client.listWatcherRuns({ archived: true, template_id: 't-1' });
    expect(lastUrl()).toMatch(/\/sonar\/watcher\/runs\?archived=true$/);
    expect(res.runs.map((r) => r.run_id)).toEqual(['a']);
  });
  it('listAuditRuns forwards archived=true alongside status/limit', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { runs: [] }));
    await client.listAuditRuns({ status: 'complete', limit: 5, archived: true });
    expect(lastUrl()).toMatch(/\/source-audit\/runs\?status=complete&limit=5&archived=true$/);
  });
});
```

- [ ] **Step 2: Run — must fail** (`archived` ignored → URL has no `archived`; `deleteRunTemplate` ignores opts)

```bash
cd /Users/samfleming/dev/hw/haiWeb-v185 && npx vitest run src/lib/__tests__/haiwave-api-run-disposition.test.ts --maxWorkers=1
```

- [ ] **Step 3: Implement**

Interface (line 672): `listWatcherRuns(opts?: { limit?: number; template_id?: string; archived?: boolean }): Promise<{ runs: WatcherRun[] }>;`
Interface (line 636): add `archived?: boolean` to `listAuditRuns` opts. Interface (line 730): `deleteRunTemplate(templateId: string, opts?: { runs?: RunsDisposition }): Promise<RunTemplateDeleteResponse>;` and add `RunsDisposition, RunTemplateDeleteResponse` to the `@haiwave/protocol` type import at the top of the file.

Impl `listWatcherRuns`: after the `limit` line add `if (opts.archived) params.set('archived', 'true');`. Impl `listAuditRuns`: after the `limit` line add `if (opts.archived) params.set('archived', 'true');`. Impl `deleteRunTemplate`:
```ts
    // v1.85 (D-206): the caller's disposition for the template's prior runs.
    deleteRunTemplate(templateId, opts = {}) {
      const q = opts.runs ? `?runs=${opts.runs}` : '';
      return request<RunTemplateDeleteResponse>('DELETE', `/sonar/templates/${templateId}${q}`);
    },
```
If `request()` special-cases 204 into `{ deleted: true }` (read `src/lib/haiwave-api.ts:912-940`), keep that branch — haiCore now answers 200 with a body, and older haiCore (204) must still resolve to something truthy.

- [ ] **Step 4: Green; run the other client tests; commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-v185 && npx vitest run src/lib/__tests__ --maxWorkers=3
cd /Users/samfleming/dev/hw/haiWeb-v185 && git add src/lib/haiwave-api.ts src/lib/__tests__/haiwave-api-run-disposition.test.ts && git commit -m "feat(api-client): deleteRunTemplate runs disposition; archived filter on run lists (3.80.0)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: BFF routes forward `?runs=` and `?archived=`

**Files:**
- Modify: `src/app/api/account/sonar/watcher/definitions/[template_id]/route.ts` (DELETE), `src/app/api/account/sonar/audit/definitions/[template_id]/route.ts` (DELETE), `src/app/api/account/sonar/templates/[id]/route.ts:16-18` (DELETE), `src/app/api/account/sonar/watcher/runs/route.ts` (GET), `src/app/api/account/sonar/audit/runs/route.ts` (GET)
- Test: `src/app/api/account/sonar/watcher/definitions/[template_id]/__tests__/route.test.ts` (new), `src/app/api/account/sonar/audit/definitions/[template_id]/__tests__/route.test.ts` (new), `src/app/api/account/sonar/templates/[id]/__tests__/route.test.ts` (new), `src/app/api/account/sonar/watcher/runs/__tests__/route.test.ts` (new), `src/app/api/account/sonar/audit/runs/__tests__/route.test.ts` (append)

**Interfaces:**
- Consumes: Task 1 client methods.
- Produces: `DELETE /api/account/sonar/{watcher,audit}/definitions/[id]?runs=` and `/api/account/sonar/templates/[id]?runs=` → haiCore's body passed through, haiCore 4xx passed through with its status and body; `GET …/watcher/runs?archived=true`, `GET …/audit/runs?archived=true`.

- [ ] **Step 1: Failing tests** — the `withHaiCore` mock pattern from `src/app/api/account/sonar/audit/runs/__tests__/route.test.ts` (top of file: `vi.mock('@/lib/with-hai-core', …)` handing `{ client, request, session, params }`). For each route:
  - definitions DELETE (watcher): client stub `getRunTemplate` → `{ template: { observation_class: 'watcher' } }`, `deleteRunTemplate: vi.fn(async (id, opts) => ({ deleted: true, runs: { disposition: opts?.runs ?? 'keep', affected: 2 } }))`; `DELETE …/t-1?runs=archive` → body `{ deleted: true, runs: { disposition: 'archive', affected: 2 } }` and `deleteRunTemplate` called with `('t-1', { runs: 'archive' })`; without `runs` → called with `('t-1', { runs: undefined })` or `('t-1', {})` — assert the body says `keep`.
  - definitions DELETE (audit): same with `observation_class: 'audit'`.
  - a 409 from the client: make `deleteRunTemplate` reject with an error carrying `status: 409` and `body: { error: { code: 'RUNS_IN_FLIGHT', details: { running_count: 1 } } }` (the shape `request()` attaches — read lines 912–940 for the exact property names); assert the route answers 409 with that body. (Read how `withHaiCore` maps thrown client errors today — `src/lib/with-hai-core.ts` — and assert the status it produces; if it already passes the status through, the test pins it; if it turns everything into 500, add the pass-through in `with-hai-core.ts` as part of this task.)
  - templates/[id] DELETE: same forwarding.
  - watcher/runs GET: `?archived=true` → `listWatcherRuns` called with `{ archived: true }`; `?template_id=x&archived=true` → `{ template_id: 'x', archived: true }`; none → `undefined` or `{}`.
  - audit/runs GET: `?archived=true` → `listAuditRuns` called with `{ status: undefined, limit: undefined, template_id: undefined, archived: true }` (match the route's existing call shape).

- [ ] **Step 2: Run — must fail**

```bash
cd /Users/samfleming/dev/hw/haiWeb-v185 && npx vitest run src/app/api/account/sonar --maxWorkers=3
```

- [ ] **Step 3: Implement** — in each DELETE: `const runs = new URL(request.url).searchParams.get('runs') ?? undefined;` then `client.deleteRunTemplate(params.template_id, { runs: runs as RunsDisposition | undefined })` (validate with `RunsDispositionSchema.optional().safeParse(runs)` from `@haiwave/protocol`; on failure return `NextResponse.json({ error: 'invalid_runs' }, { status: 400 })`). In the two GETs: read `archived === 'true'` and pass `archived: true` only when set. Add `request` to the destructured handler args where missing.

- [ ] **Step 4: Green, commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-v185 && npx vitest run src/app/api/account/sonar --maxWorkers=3
cd /Users/samfleming/dev/hw/haiWeb-v185 && git add src/app/api src/lib && git commit -m "feat(bff): forward runs disposition on definition delete and archived filter on run lists (D-206)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Delete dialog — per-modality disposition

**Files:**
- Modify: `src/app/account/sonar/_components/definition-editor.tsx` (state, `remove()`, the `<Modal>` body added in PR 1)
- Test: `src/app/account/sonar/_components/__tests__/definition-editor.test.tsx` (extend the three dialog tests from PR 1)

**Interfaces:**
- Consumes: BFF DELETE `?runs=` (Task 2).
- Produces: dialog copy and controls per `observationClass`; DELETE URL carries `?runs=<disposition>` for watcher; nothing for phantom_demand; `?runs=archive` for audit; 409 → `FormError` text.

- [ ] **Step 1: Failing tests** (append inside `describe('DefinitionEditor (audit)')` and the watcher describe; use the file's `renderAuditEditor` and the watcher render helper):

```ts
  it('audit dialog states archive-only and sends runs=archive', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ deleted: true, runs: { disposition: 'archive', affected: 4 } }) } as Response);
    renderAuditEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/its runs will be archived/i);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete audit' }));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/sonar/audit/definitions/def-1?runs=archive');
  });
```
In the watcher describe (`renderWatcherEditor` or equivalent helper; the template there is `watch-1` with endpointBase `/api/account/sonar/watcher/definitions`):
```ts
  it('watcher dialog offers three dispositions with Archive selected by default', async () => {
    renderWatcherEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const group = screen.getByRole('radiogroup', { name: 'Prior runs' });
    expect(within(group).getByRole('radio', { name: /archive prior runs/i })).toBeChecked();
    expect(within(group).getByRole('radio', { name: /delete prior runs/i })).not.toBeChecked();
    expect(within(group).getByRole('radio', { name: /keep in active history/i })).not.toBeChecked();
  });
  it('watcher dialog sends the chosen disposition', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ deleted: true, runs: { disposition: 'delete', affected: 2 } }) } as Response);
    renderWatcherEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('radio', { name: /delete prior runs/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete watcher' }));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/sonar/watcher/definitions/watch-1?runs=delete');
  });
  it('a 409 RUNS_IN_FLIGHT reply becomes a form error naming the count', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: { code: 'RUNS_IN_FLIGHT', message: 'x', details: { running_count: 2 } } }) } as Response);
    renderWatcherEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete watcher' }));
    expect(await screen.findByText(/2 runs are still running/i)).toBeInTheDocument();
  });
```
(Import `within` from Testing Library. If `describeApiError` does not expose `details`, read `src/lib/api-error.ts` and extend `describeApiError` to return `details?: Record<string, unknown>` in this task — with a unit test in `src/lib/__tests__/api-error.test.ts` if one exists, else add one.)

- [ ] **Step 2: Run — must fail**

```bash
cd /Users/samfleming/dev/hw/haiWeb-v185 && npx vitest run src/app/account/sonar/_components/__tests__/definition-editor.test.tsx --maxWorkers=1
```

- [ ] **Step 3: Implement** in `definition-editor.tsx`:
  - `import type { RunsDisposition } from '@haiwave/protocol';`
  - state: `const [runsDisposition, setRunsDisposition] = useState<RunsDisposition>('archive');`
  - `remove()`: build the URL — `const query = observationClass === 'audit' ? '?runs=archive' : observationClass === 'watcher' ? `?runs=${runsDisposition}` : '';` and `fetch(`${endpointBase}/${template.template_id}${query}`, { method: 'DELETE' })`. On `!res.ok`: `const info = await describeApiError(res); const running = (info.details as { running_count?: number } | undefined)?.running_count; setError(res.status === 409 && running !== undefined ? `${running} run${running === 1 ? ' is' : 's are'} still running. Wait for ${running === 1 ? 'it' : 'them'} to finish or cancel ${running === 1 ? 'it' : 'them'}, then delete.` : info.message);`
  - Dialog body, replacing the single paragraph:
```tsx
          <p className="text-sm text-charcoal">This cannot be undone.</p>
          {observationClass === 'watcher' && (
            <fieldset className="mt-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate">Prior runs</legend>
              <div role="radiogroup" aria-label="Prior runs" className="mt-2 space-y-2">
                {([
                  ['archive', 'Archive prior runs', 'Hidden from the Runs list and dashboards; still viewable under Runs → Archived.'],
                  ['delete', 'Delete prior runs', 'Removed for good, with their results and drift history.'],
                  ['keep', 'Keep in active history', 'Stay on the Runs list under this watcher\'s name.'],
                ] as const).map(([value, label, hint]) => (
                  <label key={value} className="flex items-start gap-2 text-sm text-charcoal">
                    <input type="radio" name="runs-disposition" value={value} checked={runsDisposition === value} onChange={() => setRunsDisposition(value)} className="mt-0.5 text-teal focus:ring-teal" />
                    <span><span className="font-medium">{label}</span><span className="block text-xs text-slate">{hint}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {observationClass === 'audit' && (
            <p className="mt-2 text-sm text-charcoal">Its runs will be archived: hidden from the Runs list and dashboards, still viewable under Runs → Archived, never deleted.</p>
          )}
          {observationClass === 'phantom_demand' && (
            <p className="mt-2 text-sm text-charcoal">Its past runs stay in the run history, listed without this name.</p>
          )}
```
  Keep the Cancel / `Delete {noun}` buttons from PR 1.

- [ ] **Step 4: Green; the whole sonar components dir; commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-v185 && npx vitest run src/app/account/sonar/_components src/lib --maxWorkers=3
cd /Users/samfleming/dev/hw/haiWeb-v185 && git add src/app/account/sonar/_components src/lib && git commit -m "feat(sonar): delete dialog offers the run disposition; audits archive-only; 409 copy (D-206)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `RunsFilterToggle` + `archived` pill

**Files:**
- Create: `src/components/sonar/observations/runs-filter-toggle.tsx`; export from `src/components/sonar/observations/index.ts`
- Modify: `src/components/pill.tsx` (`run_status` definitions: add `archived`)
- Modify: `src/app/account/sonar/watchers/_components/watcher-column-packs.tsx` (history pack `status` cell), `src/app/account/sonar/audit/_components/audit-column-packs.tsx` (history pack `status` cell)
- Test: `src/components/sonar/observations/__tests__/runs-filter-toggle.test.tsx`, extend `watcher-column-packs.test.tsx` and `audit-column-packs.test.tsx`

**Interfaces:**
- Produces: `<RunsFilterToggle value="active" | "archived" />` — a two-option `role="radiogroup"` (`Active`, `Archived`) that calls `router.replace(`${pathname}?${params with runs=archived or removed}`, { scroll: false })` preserving other params (e.g. `tab=`). `parseRunsFilter(value: string | string[] | undefined): 'active' | 'archived'` in the same file (plain module — NO `'use client'` in it; put the client component in `runs-filter-toggle.tsx` with `'use client'` and the parser in `runs-filter.ts` beside it, exactly as `parseDefinitionTab` had to move in PR 1).
- Column packs: when `run.archived_at` is set, the status cell renders `<Pill category="run_status" value="archived" />` after the status pill.

- [ ] **Step 1: Failing tests**
  - toggle: renders both radios; `value="archived"` checks Archived; clicking Archived calls `replace('/account/sonar/watchers?tab=runs&runs=archived', { scroll: false })` when `useSearchParams` yields `tab=runs` (mock `next/navigation`: `useRouter`, `usePathname`, `useSearchParams` → `new URLSearchParams('tab=runs')`); clicking Active removes `runs` and keeps `tab`.
  - `parseRunsFilter('archived')` → `'archived'`; anything else → `'active'`.
  - packs: a run with `archived_at: '2026-09-02T12:00:00.000Z'` renders a pill with text `archived`; without it, no such pill.

- [ ] **Step 2: Run — fail (modules missing / no pill)**

- [ ] **Step 3: Implement** (toggle styled like the tab bar: two `<label>` chips in a `rounded border border-slate/20` group; the checked one `bg-teal/10 text-teal-dark`). `PILL_DEFINITIONS.run_status.archived = 'Archived when its definition was deleted; hidden from the active list and dashboards, never deleted.'`.

- [ ] **Step 4: Green, commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-v185 && npx vitest run src/components src/app/account/sonar/watchers/_components src/app/account/sonar/audit/_components --maxWorkers=3
cd /Users/samfleming/dev/hw/haiWeb-v185 && git add src/components src/app/account/sonar && git commit -m "feat(sonar): Active | Archived runs toggle and archived pill (D-206)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Lists and definition pages read `?runs=archived`

**Files:**
- Modify: `src/app/account/sonar/watchers/page.tsx`, `src/app/account/sonar/audit/page.tsx`, `src/app/account/sonar/watchers/definitions/[template_id]/page.tsx`, `src/app/account/sonar/audit/definitions/[template_id]/page.tsx`
- Modify: `src/app/account/sonar/watchers/_components/watcher-history-table.tsx` (`archived?: boolean` → `&archived=true` on the poll endpoint), `src/app/account/sonar/audit/_components/audit-history-table.tsx` (same)
- Test: extend `watchers/__tests__/page.test.tsx`, `audit/__tests__/page.test.tsx`, both definition page tests

**Interfaces:**
- Consumes: `RunsFilterToggle`, `parseRunsFilter` (Task 4); BFF `?archived=true` (Task 2).
- Produces: each page accepts `searchParams: Promise<{ runs?: string | string[]; tab?: … }>`, fetches its runs with `?archived=true` when `runs=archived`, renders the toggle above the Runs table (inside the Run history tab on definition pages), and passes `archived` to the history table.

- [ ] **Step 1: Failing tests** — for each page: with `searchParams { runs: 'archived' }` the fake `fetchBffJson` (or fetch stub) sees a runs URL containing `archived=true`, the Archived radio is checked, and a run row with `archived_at` renders the `archived` pill; with no param the runs URL has no `archived` and Active is checked. The list-page tests use the global `fetch` stub (see the existing `mockBff()` there) — make the stub return an archived run only for URLs containing `archived=true`, so a page that forgets the param renders no archived row.

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement** — pages: `const runsFilter = parseRunsFilter((await searchParams).runs); const archived = runsFilter === 'archived';` fetch `/api/account/sonar/watcher/runs${archived ? '?archived=true' : ''}` (definition pages: `?template_id=…&archived=true`); render `<RunsFilterToggle value={runsFilter} />` directly under the Runs `<h2>` (list pages) and under the Run history `<h2>` (definition pages); pass `archived` to the history tables. History tables: `const params = new URLSearchParams(); if (templateId) params.set('template_id', templateId); if (archived) params.set('archived', 'true'); const pollEndpoint = `${base}${params.size ? `?${params}` : ''}`;`.

- [ ] **Step 4: Green; all sonar page tests; commit**

```bash
cd /Users/samfleming/dev/hw/haiWeb-v185 && npx vitest run src/app/account/sonar --maxWorkers=3
cd /Users/samfleming/dev/hw/haiWeb-v185 && git add src/app/account/sonar && git commit -m "feat(sonar): Runs lists and definition pages show archived runs on ?runs=archived (D-206)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Dashboards inherit the exclusion — pin it

**Files:**
- Test only: `src/app/api/account/sonar/dashboard/activity/__tests__/route.test.ts` (new, withHaiCore mock style)

- [ ] **Step 1: Test** — the activity BFF calls `listWatcherRuns` / `listAuditRuns` / the PD list WITHOUT `archived: true` (assert the call args carry no `archived` key), and the response contains exactly the runs the client returned (HaiWeb does not re-filter). This pins "dashboards inherit haiCore's default" so a future HaiWeb change cannot silently start including archived runs by asking for them.
- [ ] **Step 2: Run — passes immediately?** If so it is a characterisation test, not a red: make it fail once by temporarily passing `{ archived: true }` in the route, watch the red, revert. Commit with the message `test(dashboard): activity feed asks for active runs only (D-206)`.

---

### Task 7: Gate, PR

- [ ] **Step 1:** `cd /Users/samfleming/dev/hw/haiWeb-v185 && npm run build` → exit 0 (protocol symlink at 3.80.0).
- [ ] **Step 2:** `npx vitest run --maxWorkers=3` → 0 failed, no `(retry x`. Record the Test Files / Tests lines.
- [ ] **Step 3:** `USER_EMAIL=x USER_PASSWORD=x npx playwright test --list` exits 0 (e2e typecheck; only if e2e/ was touched — it should not be).
- [ ] **Step 4:** push `v1.85-run-disposition`; `gh pr create --repo simmysam3/haiWeb --base v1.85-run-pages --head v1.85-run-disposition --title "v1.85 PR 2 (HaiWeb) — run disposition on delete, Archived runs filter (D-206, protocol 3.80.0)" --body-file …` with `## Summary` (per task, one line each) and `## Test plan` (gates + "requires haiCore v1.85 PR 2 deployed to Central; walkable on :3002 only after the protocol symlink points at a 3.80.0 build"). Retarget to `v1.85` after #162/#163 merge.

## Self-review
- Spec §4 bullets → Task 1 (client), Task 2 (BFF), Task 3 (dialog + 409), Task 4/5 (filter, pill, pages), Task 6 (dashboards). Delivery §6 step 3 (symlink repoint) → Global Constraints.
- Names: `deleteRunTemplate(id, { runs })`, `listWatcherRuns({ archived })`, `listAuditRuns({ archived })`, `RunsFilterToggle`, `parseRunsFilter`, `archived_at`, pill `run_status.archived`.
- The server-page/client-module split learned in PR 1 is written into Task 4 (parser in a plain module).
