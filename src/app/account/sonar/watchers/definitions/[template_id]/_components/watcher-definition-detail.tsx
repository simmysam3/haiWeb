'use client';

import { useEffect, useState } from 'react';
import type { RunTemplate, RunTemplateEvent, WatcherScope } from '@haiwave/protocol';
import { DefinitionEditor } from '../../../../_components/definition-editor';
import { WatcherScopePicker } from '../../../new/_components/watcher-scope-picker';

interface Props {
  template: RunTemplate;
  events?: RunTemplateEvent[];
}

/**
 * Watcher definition editor wrapper. Owns scope state (needed because the
 * picker takes value/onChange) and passes it through to <DefinitionEditor>
 * with scopeLocked=false so the scope step is editable.
 */
export function WatcherDefinitionDetail({ template, events = [] }: Props) {
  const [scope, setScope] = useState<WatcherScope>(template.scope as WatcherScope);

  // Resync the caller-owned scope baseline whenever a fresh template arrives
  // (a successful save calls router.refresh, which re-renders this wrapper
  // with the persisted template). Without this, DefinitionEditor's scopeDirty
  // check — JSON.stringify(scopeValue) !== JSON.stringify(template.scope) —
  // compares the stale pre-save scope against the new template.scope (which
  // now carries the saved drift_thresholds + zod-defaulted fields) and reports
  // the form dirty forever, so the "Unsaved changes" bar never clears even
  // though the save persisted. The editor already resyncs its own
  // name/cadence/enabled/retention/drift baselines from `template` the same
  // way; scope is the one baseline it can't, because the caller owns it.
  useEffect(() => {
    setScope(template.scope as WatcherScope);
  }, [template]);
  return (
    <DefinitionEditor
      template={template}
      events={events}
      observationClass="watcher"
      scopePicker={<WatcherScopePicker value={scope} onChange={setScope} />}
      scopeLocked={false}
      scopeValue={scope}
      onScopeChange={(next) => setScope(next as WatcherScope)}
      endpointBase="/api/account/sonar/watcher/definitions"
      listRoute="/account/sonar/watchers"
    />
  );
}
