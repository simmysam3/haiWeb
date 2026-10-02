'use client';

import { useState } from 'react';
import { smFetch } from '@/lib/sourcing-map/client';
import { EM_DASH } from '@/lib/sourcing-map/map/selectors';

const SETTING_PATH = '/api/account/settings/sourcing-map-setting';
const SAVE_FAILED = `Couldn't save ${EM_DASH} the setting is unchanged.`;
const LOAD_FAILED = "Couldn't load the setting.";
const LABEL = `Answer for myself only ${EM_DASH} Sourcing Map runs don't go below you; your suppliers are never probed through you.`;

export function AnswerForMyselfOnly({ initial }: { initial: boolean | null }) {
  const [value, setValue] = useState(initial === true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onChange(next: boolean) {
    setValue(next);
    setFailed(false);
    setSaving(true);
    const result = await smFetch<{ answer_for_myself_only: boolean }>(SETTING_PATH, {
      method: 'PUT',
      body: { answer_for_myself_only: next },
    });
    setSaving(false);
    if (result.ok) return;
    setValue(!next);
    setFailed(true);
  }

  return (
    <div className="mt-6 space-y-2">
      <label className="flex items-start gap-3 text-sm text-navy">
        <input
          type="checkbox"
          role="switch"
          checked={value}
          disabled={saving || initial === null}
          onChange={(e) => void onChange(e.target.checked)}
          className="mt-1"
        />
        <span>{LABEL}</span>
      </label>
      {initial === null && <p className="text-sm text-slate">{LOAD_FAILED}</p>}
      {failed && (
        <p role="alert" className="text-sm text-problem">
          {SAVE_FAILED}
        </p>
      )}
    </div>
  );
}
