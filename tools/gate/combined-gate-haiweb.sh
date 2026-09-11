#!/bin/zsh
# combined-gate-haiweb.sh <base-sha> [<lane-branch> ...]
# Mirrors combined-gate.sh (haiClient) and combined-gate-haicore.sh. Zero lanes is
# a valid call and is what a release-end run uses: it measures the base alone.
#
# Env: REPO (default ~/dev/hw/haiWeb), RIG (default ~/dev/hw/haiWeb-main-rig).
#
# ⚠ Never run concurrently with haiCore's or haiClient's gate. Two full gates at
# once produced three false reds in 15 minutes on 2026-09-01 (DuckDB worker crash
# -> ERR_IPC_CHANNEL_CLOSED, no assertion failed, no summary). Use
# haiCore/tools/gate/preflight.sh before and after.
set -u
HERE=${0:A:h}
REPO=${REPO:-$HOME/dev/hw/haiWeb}
RIG=${RIG:-$HOME/dev/hw/haiWeb-main-rig}
BASE=${1:?base sha}; shift
LANES=("$@")
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
RUN="$HERE/runs/$STAMP"; mkdir -p "$RUN/gate"
log() { echo "$(date -u +%FT%TZ) $*" | tee -a "$RUN/run.log"; }
VERDICT="RED"
# The tree MUST be a direct child of ~/dev/hw. @haiwave/protocol resolves through
# a RELATIVE symlink `node_modules/@haiwave/protocol -> ../../../haiCore/packages/
# protocol`; three levels up must land on ~/dev/hw. One level deeper and it
# dangles (measured 2026-09-10) — the same class haiClient's gate found with
# seed-data/companies.json.
TREE="$HOME/dev/hw/.haiweb-gate-$STAMP"

log "run=$STAMP repo=$REPO rig=$RIG base=$BASE lanes=${LANES[*]:-<none>}"

if ! git -C "$REPO" worktree add --detach "$TREE" "$BASE" >> "$RUN/run.log" 2>&1; then
  log "BLOCKED(worktree-add)"
  VERDICT="BLOCKED(worktree-add)"
else
  # Keep Spotlight off the throwaway tree. Cloning ~580 MB of node_modules
  # triggers mdworker_shared indexing that pushed load average from 3 to 17 on
  # 2026-09-10 — enough for preflight to (correctly) refuse the next gate.
  touch "$TREE/.metadata_never_index"
fi

CONFLICT=""
if [[ "$VERDICT" != BLOCKED* ]]; then
  : > "$RUN/merges.md"
  echo "## Lanes merged (in landing order)" >> "$RUN/merges.md"
  if (( ${#LANES[@]} == 0 )); then
    echo "- none (base measured alone)" >> "$RUN/merges.md"
  else
    for lane in "${LANES[@]}"; do
      SHA=$(git -C "$REPO" rev-parse "$lane")
      if git -C "$TREE" merge --no-ff --no-edit "$SHA" >> "$RUN/run.log" 2>&1; then
        echo "- \`$lane\` @ \`$SHA\`" >> "$RUN/merges.md"
      else
        CONFLICT=$(git -C "$TREE" diff --name-only --diff-filter=U | tr '\n' ' ')
        log "MERGE CONFLICT on $lane: $CONFLICT"
        echo "- \`$lane\` @ \`$SHA\` — CONFLICT: $CONFLICT" >> "$RUN/merges.md"
        break
      fi
    done
  fi
  [[ -n "$CONFLICT" ]] && VERDICT="BLOCKED(conflict:$CONFLICT)"
fi

if [[ "$VERDICT" != BLOCKED* ]]; then
  # APFS-clone node_modules from the rig, valid ONLY if the lockfiles agree. A
  # differing lockfile means the clone is not valid for this tree; stop rather
  # than measure a tree whose dependencies are not the ones it declares.
  if diff <(git -C "$TREE" hash-object package-lock.json) <(git -C "$RIG" hash-object package-lock.json) > /dev/null 2>&1; then
    cp -cR "$RIG/node_modules" "$TREE/node_modules" 2>> "$RUN/run.log"
    if [[ -d "$TREE/node_modules/.bin" ]]; then
      log "node_modules cloned (lockfile == rig)"
      "$HERE/gate-haiweb.sh" "$TREE" "$RUN/gate" >> "$RUN/run.log" 2>&1
      BE=$(cat "$RUN/gate/build.exit" 2>/dev/null || echo 9)
      VE=$(cat "$RUN/gate/vitest.exit" 2>/dev/null || echo 9)
      WCTL=$(cat "$RUN/gate/worktrees-exclude.control" 2>/dev/null || echo 0)
      SCTL=$(cat "$RUN/gate/symlink.control" 2>/dev/null || echo 0)
      RETRIES=$(cat "$RUN/gate/retry-count.txt" 2>/dev/null || echo 0)
      CHECKS=$(grep -c '^[[:space:]]*✓' "$RUN/gate/vitest.log" 2>/dev/null || echo 0)
      SUMMARY=$(grep -c 'Test Files' "$RUN/gate/vitest.log" 2>/dev/null || echo 0)
      if [[ "$SCTL" != "1" ]]; then
        VERDICT="BLOCKED(protocol-symlink-dangling)"
      elif [[ "$WCTL" != "1" ]]; then
        VERDICT="BLOCKED(worktrees-exclude-missing)"
      elif [[ "$SUMMARY" == "0" ]]; then
        # No summary block = the harness aborted. Never a green.
        VERDICT="BLOCKED(vitest-aborted-no-summary)"
      elif [[ "$BE" == "0" && "$VE" == "0" ]]; then
        if [[ "$CHECKS" == "0" ]]; then VERDICT="SUSPECT(silent-pass:vitest)"
        elif [[ "$RETRIES" != "0" ]]; then VERDICT="SUSPECT(retry:vitest)"
        else VERDICT="GREEN"; fi
      fi
    else
      log "node_modules clone FAILED or partial — gate NOT run"
      VERDICT="BLOCKED(node_modules)"
    fi
  else
    log "LOCKFILE DIFFERS from rig ($RIG) — cannot clone node_modules; run stops (set RIG to a worktree at this BASE, or install)"
    VERDICT="BLOCKED(lockfile)"
  fi
fi

MERGED=$(git -C "$TREE" rev-parse HEAD 2>/dev/null || echo "<none>")
REC="$RUN/RECORD.md"
{
  echo "# Combined gate (haiWeb) $STAMP — $VERDICT"
  echo; echo "- repo: \`$REPO\` (origin $(git -C $REPO remote get-url origin 2>/dev/null))"
  echo "- base: \`$BASE\`"; echo "- merged head: \`$MERGED\` (throwaway; not pushed)"
  echo; [[ -f "$RUN/merges.md" ]] && cat "$RUN/merges.md"; echo
  if [[ -f "$RUN/gate/gate-meta.txt" ]]; then echo '```'; cat "$RUN/gate/gate-meta.txt"; echo '```'; fi
  if [[ -s "$RUN/gate/fail-files.txt" ]]; then
    echo; echo "## FAIL lines at --retry=0 (flake surface, spec Q5 — triage as flakes, not defects)"
    sed 's/^/- /' "$RUN/gate/fail-files.txt"
  fi
  # Standalone greppable VERDICT line — the convention haiCore's
  # render-record.sh:25 established. A record needing a sibling file read
  # alongside it to know its verdict is an audit gap.
  echo; echo "VERDICT=$VERDICT"
  echo; echo "Denominators above are scoped to merged head \`$MERGED\` and do not travel to any lane."
} > "$REC"
log "VERDICT=$VERDICT record=$REC"

# Keep the tree on anything but GREEN so a red can be inspected.
if [[ "$VERDICT" == "GREEN" ]]; then
  git -C "$REPO" worktree remove --force "$TREE" && log "tree removed"
else
  log "tree KEPT for inspection: $TREE (remove with: git -C $REPO worktree remove --force $TREE)"
fi
