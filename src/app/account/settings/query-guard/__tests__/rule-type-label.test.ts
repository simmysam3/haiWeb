import { describe, it, expect } from 'vitest';
import { QueryGuardRuleTypeSchema } from '@haiwave/protocol';
import { RULE_TYPE_LABEL } from '../_components/rule-type-label';

describe('RULE_TYPE_LABEL', () => {
  it('carries exactly the rule types QueryGuardRuleTypeSchema defines (protocol 3.88.0: eight members, the inquiry door\'s oracle rules added at spec §10.2)', () => {
    expect(Object.keys(RULE_TYPE_LABEL).sort()).toEqual([...QueryGuardRuleTypeSchema.options].sort());
  });
});
