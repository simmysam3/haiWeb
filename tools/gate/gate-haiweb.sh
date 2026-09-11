#!/bin/zsh
# gate-haiweb.sh — per-tree measurement for haiWeb; mirrors gate-haiclient.sh's role.
# Usage: gate-haiweb.sh <tree> <outdir>
#
# haiWeb differs from haiClient in ways that matter here:
#  1. No frontend/ split — one build, one vitest run.
#  2. vitest is v4 and REJECTS --minWorkers; --maxWorkers only.
#  3. vitest.config.ts sets `retry: 2` for developer ergonomics. A `(retry xN)`
#     green is not a green, so this measures at --retry=0 and reports any
#     resulting FAIL as a named flake instead of absorbing it.
#  4. `.worktrees/**` is ALREADY excluded in vitest.config.ts (v1.37). This
#     asserts that exclude still exists rather than re-implementing scoping —
#     if it is dropped, collection inflates ~3x silently.
#  5. DEPTH DEPENDENCY (measured 2026-09-10): @haiwave/protocol is
#     `file:../haiCore/packages/protocol`, resolved through a RELATIVE symlink
#     `node_modules/@haiwave/protocol -> ../../../haiCore/packages/protocol`.
#     Three levels up must land on ~/dev/hw, so the tree MUST be a direct child
#     of it. One level deeper and the link dangles — the same class of failure
#     haiClient's gate found with seed-data/companies.json. This script asserts
#     the link RESOLVES, and asserts the enumeration count is non-zero so an
#     empty loop cannot pass the check vacuously.
set -u
TREE=${1:?tree}; OUT=${2:?outdir}
# Same launch-cwd-dependency fix as the other two gates: a RELATIVE $OUT resolved
# after `cd "$TREE"` makes every redirect below fail silently — no build, no test,
# no artefact — while the script still prints its end= line. It reads exactly like
# a clean pass. Absolute BEFORE the cd, or refuse.
mkdir -p "$OUT" || exit 9
OUT=${OUT:A}
[[ "$OUT" == /* ]] || { print -u2 "gate: refusing a non-absolute OUT: $OUT"; exit 9; }
TREE_ABS=${TREE:A}
cd "$TREE" || exit 9
unset ANTHROPIC_API_KEY GEMINI_API_KEY   # a gate never bills a provider

echo "tree=$TREE origin=$(git remote get-url origin 2>/dev/null) head=$(git rev-parse HEAD) branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo DETACHED) version=$(node -p "require('./package.json').version" 2>/dev/null) start=$(date -u +%FT%TZ) pid=$$" | tee "$OUT/gate-meta.txt"

# --- PRESENT CONTROL 1: the tree-escaping protocol symlink must resolve here. ---
# Enumerate, then assert the COUNT is non-zero before asserting resolution, so a
# broken glob cannot report "all links fine" over an empty set.
LINKS=(node_modules/@haiwave/*(@N))
echo "escaping-symlink enumeration: ${#LINKS} link(s) under node_modules/@haiwave" | tee -a "$OUT/gate-meta.txt"
SYMLINK_OK=1
if (( ${#LINKS} == 0 )); then
  echo "PRESENT CONTROL FAILED: enumerated 0 links under node_modules/@haiwave — the glob is broken or node_modules is absent" | tee -a "$OUT/gate-meta.txt"
  SYMLINK_OK=0
else
  for _l in $LINKS; do
    if [[ -e "$_l" ]]; then
      echo "  ok  $_l -> $(readlink "$_l")" | tee -a "$OUT/gate-meta.txt"
    else
      echo "  DANGLING $_l -> $(readlink "$_l") (tree is at the wrong depth: must be a direct child of ~/dev/hw)" | tee -a "$OUT/gate-meta.txt"
      SYMLINK_OK=0
    fi
  done
fi
echo "$SYMLINK_OK" > "$OUT/symlink.control"

# --- PRESENT CONTROL 2: the .worktrees exclude must still be in the config. ---
# Assert the CONFIG entry, not an absence of worktree tests — the latter passes
# vacuously in a checkout that simply has no sibling worktrees.
if grep -q "\.worktrees" vitest.config.ts; then
  echo "PRESENT CONTROL ok: .worktrees exclude found in vitest.config.ts" | tee -a "$OUT/gate-meta.txt"
  echo 1 > "$OUT/worktrees-exclude.control"
else
  echo "PRESENT CONTROL FAILED: .worktrees exclude missing — collection will inflate across sibling worktrees" | tee -a "$OUT/gate-meta.txt"
  echo 0 > "$OUT/worktrees-exclude.control"
fi

# --- Build-only env placeholders (measured requirement, 2026-09-10). ---
# `next build` sets NODE_ENV=production, and src/config/env.ts correctly refuses
# to load in production with the dev-default session secret or empty Keycloak
# secrets (five guards, four of which bite here). A fresh worktree has no `.env`
# (it is gitignored), so without these the build dies at "Collecting page data"
# with `SESSION_SECRET is the dev default but NODE_ENV=production`.
#
# These are THROWAWAY PLACEHOLDERS, deliberately not the real values: a gate
# needs the guards satisfied, not working credentials, and copying the launch
# tree's .env would spread a real secret into a throwaway tree for no benefit.
# SESSION_SECRET is randomised per run so it cannot be mistaken for a fixture.
# KEYCLOAK_PORTAL_CLIENT_ID must equal KEYCLOAK_CLIENT_ID (fifth guard); both are
# left at their schema defaults, which already agree.
export SESSION_SECRET="gate-build-only-$(openssl rand -hex 16)"
export KEYCLOAK_CLIENT_SECRET="gate-build-only-placeholder"
export KEYCLOAK_ADMIN_CLIENT_SECRET="gate-build-only-placeholder"
echo "build env: SESSION_SECRET + KEYCLOAK_{,ADMIN_}CLIENT_SECRET set to BUILD-ONLY PLACEHOLDERS (not real credentials)" | tee -a "$OUT/gate-meta.txt"

npm run build > "$OUT/build.log" 2>&1; echo $? > "$OUT/build.exit"

# vitest 4: --maxWorkers only (--minWorkers is REJECTED and aborts the run).
# --retry=0 overrides the config's retry:2 so the measurement is honest.
./node_modules/.bin/vitest run --maxWorkers=3 --retry=0 > "$OUT/vitest.log" 2>&1
echo $? > "$OUT/vitest.exit"

# Flake surface (spec Q5): at --retry=0 a flaky test lands as FAIL. Name them so
# they can be triaged as flakes rather than counted as defects — or retried away.
grep -E '^\s*FAIL' "$OUT/vitest.log" | sed 's/^[[:space:]]*//' | sort -u > "$OUT/fail-files.txt"
echo "distinct FAIL lines at --retry=0: $(wc -l < "$OUT/fail-files.txt" | tr -d ' ')" | tee -a "$OUT/gate-meta.txt"
grep -c '(retry x' "$OUT/vitest.log" > "$OUT/retry-count.txt"

for f in build vitest; do echo "$f exit=$(cat $OUT/$f.exit)"; done | tee -a "$OUT/gate-meta.txt"
grep -hE "Test Files|Tests  " "$OUT/vitest.log" | tee -a "$OUT/gate-meta.txt"

# Scoped leftover count — FIX 2 from gate-haiclient.sh. A GLOBAL `ps | grep vitest
# | wc -l` reports another session's live suite as this gate's leftovers and, read
# literally, invites killing a peer's processes. Scope to $TREE_ABS via cwd.
leftover=0
for _p in ${(f)"$(ps -eo pid,command | grep '[v]itest' | grep -v zsh | awk '{print $1}')"}; do
  _c=$(lsof -a -p "$_p" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2-)
  [[ -n "$_c" && "$_c" == "$TREE_ABS"* ]] && leftover=$((leftover+1))
done
echo "end=$(date -u +%FT%TZ) vitest procs after (scoped to $TREE_ABS): $leftover" | tee -a "$OUT/gate-meta.txt"
if [[ "$leftover" != "0" ]]; then
  print -u2 "WARNING: $leftover vitest process(es) still alive under $TREE_ABS — dispose by pid (cwd-confirmed) before the next gate"
fi
