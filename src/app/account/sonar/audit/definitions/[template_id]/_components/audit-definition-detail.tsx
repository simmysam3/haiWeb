'use client';

import type { RunTemplate, RunTemplateEvent } from '@haiwave/protocol';
import { DefinitionEditor } from '../../../../_components/definition-editor';
import { ScopeSummary } from '../../../../templates/_components/scope-summary';

interface Props {
  template: RunTemplate;
  events?: RunTemplateEvent[];
}

/**
 * Audit page wrapper around the shared <DefinitionEditor>. Plan 1's audit
 * editor displays scope read-only via <ScopeSummary>; the watcher equivalent
 * (Plan 2) will inject an interactive scope picker via the same slot.
 */
export function AuditDefinitionDetail({ template, events = [] }: Props) {
  return (
    <DefinitionEditor
      template={template}
      events={events}
      observationClass="audit"
      scopePicker={<ScopeSummary scope={template.scope} />}
      endpointBase="/api/account/sonar/audit/definitions"
      listRoute="/account/sonar/audit"
    />
  );
}
