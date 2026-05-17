import { describe, it, expect } from 'vitest';
import type { PhantomDemandResult } from '@/lib/haiwave-api';
import { interpretProbeResult } from './interpret-probe-result';

const base: Omit<PhantomDemandResult, 'sku_id' | 'synthesis_mode' | 'gap' | 'payload'> = {
  result_id: 'r',
  run_id: 'run',
  responder_participant_id: 'p',
  response_time_ms: 0,
  created_at: '2026-05-17T00:00:00Z',
};
const ask = { hypothetical_quantity: 200, hypothetical_timeline: null };

describe('interpretProbeResult', () => {
  it('redacted_gap → no_answer, confidence null, not-a-decline meaning', () => {
    const r: PhantomDemandResult = { ...base, sku_id: 'S', synthesis_mode: 'redacted_gap', gap: null, payload: {} };
    const i = interpretProbeResult(r, ask);
    expect(i.verdict).toBe('no_answer');
    expect(i.verdictLabel).toBe('No answer');
    expect(i.tone).toBe('neutral');
    expect(i.confidence).toBeNull();
    expect(i.meaning).toMatch(/not a decline/i);
    expect(i.meaning).not.toMatch(/reason:/i);
    expect(i.action).toMatch(/re-probe/i);
  });

  it('redacted_gap with gap.reason appends the reason', () => {
    const r: PhantomDemandResult = { ...base, sku_id: 'S', synthesis_mode: 'redacted_gap', gap: { reason: 'unreachable' }, payload: {} };
    expect(interpretProbeResult(r, ask).meaning).toMatch(/\(reason: unreachable\)/);
  });

  it('missing/bad completeness → unusable', () => {
    const r: PhantomDemandResult = { ...base, sku_id: 'S', synthesis_mode: 'direct', gap: null, payload: { responder_completeness: 'weird' } };
    const i = interpretProbeResult(r, ask);
    expect(i.verdict).toBe('unusable');
    expect(i.confidence).toBeNull();
  });

  it('declined → problem tone, confidence passthrough', () => {
    const r: PhantomDemandResult = { ...base, sku_id: 'S', synthesis_mode: 'direct', gap: null, payload: { responder_completeness: 'declined', responder_confidence: 'low' } };
    const i = interpretProbeResult(r, ask);
    expect(i.verdict).toBe('declined');
    expect(i.tone).toBe('problem');
    expect(i.confidence).toBe('low');
  });

  it('partial → ask-aware meaning', () => {
    const r: PhantomDemandResult = { ...base, sku_id: 'S', synthesis_mode: 'direct', gap: null, payload: { responder_completeness: 'partial', responder_confidence: 'medium', responder_quoted_quantity: 120 } };
    const i = interpretProbeResult(r, ask);
    expect(i.verdict).toBe('partial');
    expect(i.meaning).toMatch(/120 of 200/);
    expect(i.quotedQuantity).toBe(120);
  });

  it('complete + high vs low → different actions', () => {
    const mk = (c: string): PhantomDemandResult => ({ ...base, sku_id: 'S', synthesis_mode: 'direct', gap: null, payload: { responder_completeness: 'complete', responder_confidence: c } });
    expect(interpretProbeResult(mk('high'), ask).action).toMatch(/strong signal/i);
    expect(interpretProbeResult(mk('low'), ask).action).toMatch(/tentative/i);
    expect(interpretProbeResult(mk('high'), ask).verdict).toBe('full');
  });

  it('redacted_gap wins even when a stale completeness is present', () => {
    const r: PhantomDemandResult = { ...base, sku_id: 'S', synthesis_mode: 'redacted_gap', gap: null, payload: { responder_completeness: 'complete' } };
    expect(interpretProbeResult(r, ask).verdict).toBe('no_answer');
  });
});
