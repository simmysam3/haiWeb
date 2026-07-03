import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Stripe webhook signature without pulling in the Stripe SDK.
 *
 * Stripe signs `${timestamp}.${rawBody}` with HMAC-SHA256 and sends it as a
 * `Stripe-Signature: t=<ts>,v1=<hex>[,v1=<hex>…]` header. We recompute the MAC
 * over the RAW body (parsing first would change the bytes and break the check),
 * compare in constant time, and reject anything outside the timestamp tolerance
 * to blunt replay. `nowSec` is injectable so the check is deterministic in tests.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSec = 300,
  nowSec: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !header) return false;

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = Number(value);
    else if (key === "v1" && value) signatures.push(value);
  }
  if (timestamp === null || Number.isNaN(timestamp) || signatures.length === 0) {
    return false;
  }
  if (Math.abs(nowSec - timestamp) > toleranceSec) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");

  return signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, "hex");
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
}
