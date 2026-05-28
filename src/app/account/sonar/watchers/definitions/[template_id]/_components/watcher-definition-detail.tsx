'use client';

import { useState } from 'react';
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
