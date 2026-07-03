import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config';

async function headerMap() {
  const rules = await nextConfig.headers!();
  const all = rules.flatMap((r) => r.headers);
  return new Map(all.map((h) => [h.key.toLowerCase(), h.value]));
}

describe('next.config security response headers', () => {
  it('applies the baseline hardening headers to all routes', async () => {
    const rules = await nextConfig.headers!();
    expect(rules.some((r) => r.source === '/(.*)')).toBe(true);

    const h = await headerMap();
    expect(h.get('strict-transport-security')).toMatch(/max-age=\d+/);
    expect(h.get('x-content-type-options')).toBe('nosniff');
    expect(h.get('x-frame-options')).toBe('DENY');
    expect(h.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  it('enforces a clickjacking/injection CSP that cannot block script rendering', async () => {
    const h = await headerMap();
    const csp = h.get('content-security-policy') ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    // The enforced policy must NOT restrict script-src (that needs nonce wiring
    // + browser validation first); the strict script policy ships report-only.
    expect(csp).not.toMatch(/script-src/);
  });
});
