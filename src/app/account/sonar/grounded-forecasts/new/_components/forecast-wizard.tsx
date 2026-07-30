'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GroundedForecastBomLine } from '@haiwave/protocol';
import { describeApiError } from '@/lib/api-error';
import { FormError } from '@/components';
import { StepRail, type RailStep } from '../../../_components/step-rail';
import { StepCard } from '../../../_components/step-card';
import { NameField } from '../../../_components/name-field';

/**
 * Single-page scroll-form wizard for a new Grounded Forecast (v1.62).
 *
 * Six step-cards — identity → analogues → BOM → assembly → profile → review —
 * mirroring <WatcherWizard>'s structure and its create-then-run sequence, but
 * with imperative validate-on-submit: the button is always clickable, and a
 * failed validation flips the offending rail steps to the error state and
 * scrolls to the first one instead of POSTing.
 *
 * The BOM is seeded from the primary analogue's on-agent BOM the moment that
 * SKU is set (blur), then owned entirely by the form — later edits to the real
 * BOM never touch a saved forecast (spec decision 3). A 404 seed is a prompt
 * for manual entry, never a dead end (spec §9).
 *
 * observation_class is deliberately ABSENT from the create body — the BFF
 * forces 'grounded_forecast' server-side so a spoofed class can never ride in
 * from the client.
 */

const MAX_ANALOGUES = 3;
const MONTH_RE = /^\d{4}-\d{2}$/;

// Nominal for this modality: results are pruned to latest per template, so
// retention_days never expires the one result the console shows. Still a
// required field on the create contract, so send a generous year.
const DEFAULT_RETENTION_DAYS = 365;

type StepId = 'identity' | 'analogues' | 'bom' | 'assembly' | 'profile' | 'review';

const STEP_ORDER: ReadonlyArray<{ id: StepId; label: string }> = [
  { id: 'identity', label: 'Identity' },
  { id: 'analogues', label: 'Analogues' },
  { id: 'bom', label: 'Bill of materials' },
  { id: 'assembly', label: 'Assembly' },
  { id: 'profile', label: 'Demand profile' },
  { id: 'review', label: 'Review & save' },
];

/** BOM line as edited — qty stays a string until submit so partial typing never NaNs the UI. */
interface BomLineDraft {
  component_sku: string;
  product_class_id: string;
  qty_per_unit: string;
}

function emptyBomLine(): BomLineDraft {
  return { component_sku: '', product_class_id: '', qty_per_unit: '' };
}

interface ValidationOutcome {
  errors: Partial<Record<StepId, string>>;
  scope: {
    kind: 'grounded_forecast';
    product_name: string;
    analogue_skus: string[];
    bom_lines: GroundedForecastBomLine[];
    assembly_days: number;
    profile: { monthly_qty: number; start_month: string; end_month: string };
  };
}

export function ForecastWizard() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [productName, setProductName] = useState('');
  const [analogues, setAnalogues] = useState<string[]>(['']);
  const [bomLines, setBomLines] = useState<BomLineDraft[]>([emptyBomLine()]);
  const [assemblyDays, setAssemblyDays] = useState('');
  const [monthlyQty, setMonthlyQty] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [runNow, setRunNow] = useState(false);

  // BOM seeding — remember the last SKU we asked about so a repeated blur on
  // the same value does not re-fetch (and re-overwrite manual edits).
  const [seededSku, setSeededSku] = useState<string | null>(null);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Latched once the create POST succeeds. A later submit (retry after
  // "saved but the initial run failed") must NEVER create a second template
  // for the same intended forecast — it skips straight to the run.
  const [createdTemplateId, setCreatedTemplateId] = useState<string | null>(null);

  /**
   * Pure validation over the current fields. Returns one message per step
   * (first problem wins) plus the cleaned scope — the same pass that gates
   * submission also drives the rail's error states, so what the rail flags
   * and what would be sent can never disagree.
   */
  function validate(): ValidationOutcome {
    const errors: Partial<Record<StepId, string>> = {};

    if (!name.trim()) {
      errors.identity = 'Forecast name is required.';
    } else if (!productName.trim()) {
      errors.identity = 'Product name is required.';
    }

    const analogueSkus = analogues.map((a) => a.trim()).filter(Boolean);
    if (analogueSkus.length === 0) {
      errors.analogues = 'Nominate at least one analogue SKU.';
    }

    // Fully blank rows are scaffolding, not intent — drop them. Anything
    // partially filled must be completed or removed.
    const touchedLines = bomLines.filter(
      (l) => l.component_sku.trim() || l.product_class_id.trim() || l.qty_per_unit.trim(),
    );
    const parsedLines: GroundedForecastBomLine[] = touchedLines.map((l) => ({
      component_sku: l.component_sku.trim(),
      product_class_id: l.product_class_id.trim(),
      qty_per_unit: Number(l.qty_per_unit),
    }));
    if (parsedLines.length === 0) {
      errors.bom = 'Add at least one BOM line.';
    } else if (
      parsedLines.some(
        (l) =>
          !l.component_sku ||
          !l.product_class_id ||
          !Number.isFinite(l.qty_per_unit) ||
          l.qty_per_unit <= 0,
      )
    ) {
      errors.bom =
        'Every BOM line needs a component SKU, a product class, and a quantity per unit greater than zero.';
    }

    const assembly = Number(assemblyDays);
    if (!assemblyDays.trim() || !Number.isInteger(assembly) || assembly < 0) {
      errors.assembly = 'Assembly days must be a whole number, zero or more.';
    }

    const qty = Number(monthlyQty);
    if (!monthlyQty.trim() || !Number.isInteger(qty) || qty <= 0) {
      errors.profile = 'Monthly quantity must be a whole number greater than zero.';
    } else if (!MONTH_RE.test(startMonth.trim()) || !MONTH_RE.test(endMonth.trim())) {
      errors.profile = 'Start and end months must be in YYYY-MM format.';
    } else if (startMonth.trim() > endMonth.trim()) {
      errors.profile = 'Start month must not be after end month.';
    }

    return {
      errors,
      scope: {
        kind: 'grounded_forecast',
        product_name: productName.trim(),
        analogue_skus: analogueSkus,
        bom_lines: parsedLines,
        assembly_days: assembly,
        profile: {
          monthly_qty: qty,
          start_month: startMonth.trim(),
          end_month: endMonth.trim(),
        },
      },
    };
  }

  const { errors: liveErrors } = validate();
  // Errors only surface on the rail after a submit attempt; before that,
  // incomplete steps read as todo/active, complete ones as done.
  const railErrors: Partial<Record<StepId, string>> = submitAttempted ? liveErrors : {};

  let activeAssigned = false;
  const steps: RailStep[] = STEP_ORDER.map(({ id, label }) => {
    if (railErrors[id]) return { id, label, state: 'error' as const };
    // Review is a gate, not a field set — it never reads as done.
    const complete = id !== 'review' && !liveErrors[id];
    if (complete) return { id, label, state: 'done' as const };
    if (!activeAssigned) {
      activeAssigned = true;
      return { id, label, state: 'active' as const };
    }
    return { id, label, state: 'todo' as const };
  });

  const firstRailError = STEP_ORDER.map(({ id }) => railErrors[id]).find(Boolean) ?? null;

  function jump(id: string) {
    const el = document.getElementById(`step-${id}`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function setAnalogue(index: number, value: string) {
    setAnalogues((prev) => prev.map((a, i) => (i === index ? value : a)));
  }

  function removeAnalogue(index: number) {
    setAnalogues((prev) => prev.filter((_, i) => i !== index));
  }

  function setBomField(index: number, field: keyof BomLineDraft, value: string) {
    setBomLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  async function seedBomFromPrimary() {
    const sku = (analogues[0] ?? '').trim();
    if (!sku || sku === seededSku) return;
    setSeededSku(sku);
    try {
      const res = await fetch(
        `/api/account/sonar/grounded-forecasts/bom-seed?sku=${encodeURIComponent(sku)}`,
      );
      if (!res.ok) {
        // 404 = no BOM on file (or agent unreachable) — manual entry carries on.
        setSeedNotice(
          res.status === 404
            ? `No BOM on file for ${sku} — enter lines manually`
            : `Could not load a BOM for ${sku} — enter lines manually.`,
        );
        return;
      }
      const payload = (await res.json().catch(() => null)) as
        | { lines?: GroundedForecastBomLine[] }
        | null;
      const lines = payload?.lines;
      if (!Array.isArray(lines) || lines.length === 0) {
        setSeedNotice(`No BOM on file for ${sku} — enter lines manually`);
        return;
      }
      setSeedNotice(null);
      setBomLines(
        lines.map((l) => ({
          component_sku: l.component_sku,
          product_class_id: l.product_class_id,
          qty_per_unit: String(l.qty_per_unit),
        })),
      );
    } catch {
      setSeedNotice(`Could not load a BOM for ${sku} — enter lines manually.`);
    }
  }

  async function submit() {
    setSubmitAttempted(true);
    setError(null);
    setSessionExpired(false);

    const { errors, scope } = validate();
    // On a retry after a successful create, the template already exists —
    // validation gated the create, and only the run remains to be retried.
    if (!createdTemplateId) {
      const firstErrored = STEP_ORDER.find(({ id }) => errors[id]);
      if (firstErrored) {
        jump(firstErrored.id);
        return;
      }
    }

    setBusy(true);
    try {
      let templateId = createdTemplateId;
      if (!templateId) {
        const tplRes = await fetch('/api/account/sonar/grounded-forecasts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // observation_class intentionally absent — the BFF forces it.
          body: JSON.stringify({
            template_name: name.trim(),
            scope,
            cadence: { kind: 'manual_only' },
            enabled: true,
            retention_days: DEFAULT_RETENTION_DAYS,
          }),
        });
        if (!tplRes.ok) {
          const info = await describeApiError(tplRes);
          setError(info.message);
          setSessionExpired(info.sessionExpired);
          return;
        }
        const tplPayload = (await tplRes.json().catch(() => null)) as
          | { template?: { template_id?: string } }
          | null;
        const parsedId = tplPayload?.template?.template_id;
        if (!parsedId) {
          setError(
            'The forecast was created but the server response was malformed. Refresh the list to confirm.',
          );
          return;
        }
        templateId = parsedId;
        setCreatedTemplateId(parsedId);
      }

      if (runNow) {
        const runRes = await fetch(`/api/account/sonar/templates/${templateId}/trigger`, {
          method: 'POST',
        });
        if (!runRes.ok) {
          const info = await describeApiError(runRes);
          setError(`Forecast saved but the initial run failed: ${info.message}`);
          setSessionExpired(info.sessionExpired);
          return;
        }
        // Latest-only results are keyed by template, so the run lands on the
        // forecast's own page, which polls the run to completion.
        router.push(`/account/sonar/grounded-forecasts/${templateId}`);
        return;
      }

      router.push('/account/sonar/grounded-forecasts');
    } catch {
      setError('Network error — could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass = 'rounded border border-slate-300 px-2 py-1 text-sm';

  function stepAlert(id: StepId) {
    const message = railErrors[id];
    if (!message) return null;
    return (
      <p role="alert" className="mt-3 text-sm text-problem">
        {message}
      </p>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="pt-1">
        <StepRail steps={steps} onJump={jump} />
      </div>
      <div className="flex-1 max-w-4xl space-y-4">
        <StepCard id="identity" index={0} title="Identity">
          <div className="space-y-3">
            <NameField noun="Forecast" value={name} onChange={setName} />
            <label className="block text-sm text-charcoal">
              <span className="block mb-1 font-medium">Product name</span>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="The product this forecast grounds — it need not exist yet"
                className={`${inputClass} w-full max-w-md`}
              />
            </label>
          </div>
          {stepAlert('identity')}
        </StepCard>

        <StepCard id="analogues" index={1} title="Analogues">
          <p className="text-sm text-slate mb-3">
            Nominate one to three predecessor SKUs the new product resembles. The
            primary analogue seeds the bill of materials and anchors the order
            history the simulation is grounded on.
          </p>
          <div className="space-y-2">
            {analogues.map((sku, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label={i === 0 ? 'Primary analogue SKU' : `Analogue SKU ${i + 1}`}
                  value={sku}
                  onChange={(e) => setAnalogue(i, e.target.value)}
                  onBlur={i === 0 ? seedBomFromPrimary : undefined}
                  className={`${inputClass} w-full max-w-xs font-mono`}
                />
                {i === 0 ? (
                  <span className="text-xs text-slate">Primary — seeds the BOM</span>
                ) : (
                  <button
                    type="button"
                    aria-label={`Remove analogue ${i + 1}`}
                    onClick={() => removeAnalogue(i)}
                    className="text-xs text-slate hover:text-rose-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAnalogues((prev) => [...prev, ''])}
            disabled={analogues.length >= MAX_ANALOGUES}
            className="mt-2 text-sm text-teal hover:underline disabled:opacity-50 disabled:no-underline"
          >
            Add analogue
          </button>
          {analogues.length >= MAX_ANALOGUES && (
            <span className="ml-2 text-xs text-slate">Up to three analogues.</span>
          )}
          {stepAlert('analogues')}
        </StepCard>

        <StepCard id="bom" index={2} title="Bill of materials">
          <p className="text-sm text-slate mb-3">
            One line per component class. Seeded from the primary analogue when it
            has a BOM on file; always editable — this copy belongs to the
            forecast, not to the analogue.
          </p>
          {seedNotice && (
            <p role="status" className="mb-3 text-sm text-slate">
              {seedNotice}
            </p>
          )}
          <div className="space-y-2">
            {bomLines.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label={`Component SKU ${i + 1}`}
                  placeholder="Component SKU"
                  value={line.component_sku}
                  onChange={(e) => setBomField(i, 'component_sku', e.target.value)}
                  className={`${inputClass} w-40 font-mono`}
                />
                <input
                  type="text"
                  aria-label={`Product class ${i + 1}`}
                  placeholder="Product class"
                  value={line.product_class_id}
                  onChange={(e) => setBomField(i, 'product_class_id', e.target.value)}
                  className={`${inputClass} w-48 font-mono`}
                />
                <input
                  type="number"
                  aria-label={`Qty per unit ${i + 1}`}
                  placeholder="Qty/unit"
                  min={0}
                  step="any"
                  value={line.qty_per_unit}
                  onChange={(e) => setBomField(i, 'qty_per_unit', e.target.value)}
                  className={`${inputClass} w-24`}
                />
                <button
                  type="button"
                  aria-label={`Remove BOM line ${i + 1}`}
                  onClick={() => setBomLines((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={bomLines.length === 1}
                  className="text-xs text-slate hover:text-rose-600 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setBomLines((prev) => [...prev, emptyBomLine()])}
            className="mt-2 text-sm text-teal hover:underline"
          >
            Add BOM line
          </button>
          {stepAlert('bom')}
        </StepCard>

        <StepCard id="assembly" index={3} title="Assembly">
          <label className="block text-sm text-charcoal">
            <span className="block mb-1 font-medium">Assembly days</span>
            <input
              type="number"
              aria-label="Assembly days"
              min={0}
              step={1}
              value={assemblyDays}
              onChange={(e) => setAssemblyDays(e.target.value)}
              className={`${inputClass} w-28`}
            />
          </label>
          <p className="mt-1 text-xs text-slate">
            Final assembly time once all components are on hand — subtracted,
            with each component&rsquo;s lead time, from every delivery month to
            date the commitments.
          </p>
          {stepAlert('assembly')}
        </StepCard>

        <StepCard id="profile" index={4} title="Demand profile">
          <div className="flex flex-wrap items-end gap-4">
            <label className="block text-sm text-charcoal">
              <span className="block mb-1 font-medium">Monthly quantity</span>
              <input
                type="number"
                aria-label="Monthly quantity"
                min={1}
                step={1}
                value={monthlyQty}
                onChange={(e) => setMonthlyQty(e.target.value)}
                className={`${inputClass} w-32`}
              />
            </label>
            <label className="block text-sm text-charcoal">
              <span className="block mb-1 font-medium">Start month</span>
              <input
                type="text"
                aria-label="Start month"
                placeholder="2027-01"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className={`${inputClass} w-28 font-mono`}
              />
            </label>
            <label className="block text-sm text-charcoal">
              <span className="block mb-1 font-medium">End month</span>
              <input
                type="text"
                aria-label="End month"
                placeholder="2027-12"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                className={`${inputClass} w-28 font-mono`}
              />
            </label>
          </div>
          {stepAlert('profile')}
        </StepCard>

        <StepCard id="review" index={5} title="Review & save">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="text-slate">Product</dt>
            <dd className="text-charcoal">{productName.trim() || '—'}</dd>
            <dt className="text-slate">Analogues</dt>
            <dd className="font-mono text-xs text-charcoal">
              {analogues.filter((a) => a.trim()).join(', ') || '—'}
            </dd>
            <dt className="text-slate">BOM lines</dt>
            <dd className="text-charcoal">
              {bomLines.filter(
                (l) => l.component_sku.trim() || l.product_class_id.trim() || l.qty_per_unit.trim(),
              ).length}
            </dd>
            <dt className="text-slate">Assembly</dt>
            <dd className="text-charcoal">{assemblyDays.trim() ? `${assemblyDays} days` : '—'}</dd>
            <dt className="text-slate">Profile</dt>
            <dd className="text-charcoal">
              {monthlyQty.trim() && startMonth.trim() && endMonth.trim()
                ? `${Number(monthlyQty).toLocaleString('en-US')}/mo · ${startMonth} → ${endMonth}`
                : '—'}
            </dd>
          </dl>
          <label className="mt-4 flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={runNow}
              onChange={(e) => setRunNow(e.target.checked)}
            />
            Run immediately after saving
          </label>
        </StepCard>

        {error && <FormError message={error} sessionExpired={sessionExpired} />}

        <div className="sticky bottom-0 mt-4 bg-navy text-white rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm">{firstRailError ?? 'Ready when you are'}</span>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded bg-orange text-white px-4 py-1.5 text-sm font-semibold hover:bg-orange/90 disabled:opacity-60"
          >
            {busy ? 'Saving…' : runNow ? 'Save & run now' : 'Save forecast'}
          </button>
        </div>
      </div>
    </div>
  );
}
