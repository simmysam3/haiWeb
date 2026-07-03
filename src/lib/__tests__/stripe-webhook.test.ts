import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyStripeSignature } from '../stripe-webhook';

const SECRET = 'whsec_test_secret';

function sign(payload: string, timestamp: number, secret = SECRET): string {
  const sig = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

const nowSec = () => Math.floor(Date.now() / 1000);

describe('verifyStripeSignature', () => {
  const payload = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });

  it('accepts a correctly signed, recent payload', () => {
    const t = nowSec();
    expect(verifyStripeSignature(payload, sign(payload, t), SECRET, 300, t)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const t = nowSec();
    const header = sign(payload, t);
    expect(verifyStripeSignature(payload + 'x', header, SECRET, 300, t)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    const t = nowSec();
    expect(verifyStripeSignature(payload, sign(payload, t, 'whsec_wrong'), SECRET, 300, t)).toBe(false);
  });

  it('rejects a missing or malformed header', () => {
    const t = nowSec();
    expect(verifyStripeSignature(payload, null, SECRET, 300, t)).toBe(false);
    expect(verifyStripeSignature(payload, 'garbage', SECRET, 300, t)).toBe(false);
  });

  it('rejects a stale timestamp beyond tolerance (replay)', () => {
    const t = nowSec();
    const header = sign(payload, t - 10_000);
    expect(verifyStripeSignature(payload, header, SECRET, 300, t)).toBe(false);
  });

  it('fails closed when the signing secret is empty', () => {
    const t = nowSec();
    expect(verifyStripeSignature(payload, sign(payload, t, ''), '', 300, t)).toBe(false);
  });
});
