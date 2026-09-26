import { describe, it, expect } from 'vitest';
import { parseCreateSmRunBody } from '../local-shapes';
import { vomeroRunTemplate } from '../__fixtures__/vomero';

describe('parseCreateSmRunBody', () => {
  it('parses a valid body, returning the parsed scope (BFF-local AD-3)', () => {
    const result = parseCreateSmRunBody({
      template_name: 'Line A base',
      scope: vomeroRunTemplate.scope,
      cadence: { kind: 'manual_only' },
    });
    if (!result.ok) throw new Error('expected ok: true');
    expect(result.data.scope).toEqual(vomeroRunTemplate.scope);
  });

  it('rejects a bad scope', () => {
    const result = parseCreateSmRunBody({
      template_name: 'Line A base',
      scope: { kind: 'not_a_scope' },
      cadence: { kind: 'manual_only' },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an empty template_name', () => {
    const result = parseCreateSmRunBody({
      template_name: '',
      scope: vomeroRunTemplate.scope,
      cadence: { kind: 'manual_only' },
    });
    expect(result.ok).toBe(false);
  });

  it('leaves cadence undefined when omitted', () => {
    const result = parseCreateSmRunBody({
      template_name: 'Line A base',
      scope: vomeroRunTemplate.scope,
    });
    if (!result.ok) throw new Error('expected ok: true');
    expect(result.data.cadence).toBeUndefined();
  });
});
