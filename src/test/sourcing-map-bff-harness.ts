// Test helpers for the Sourcing Map BFF route tests of Task 9 (not a test file itself).
import { NextRequest } from 'next/server';

export function smReq(method: string, path: string, body?: unknown): NextRequest {
  const url = new URL(path, 'http://localhost:3001');
  if (body === undefined) return new NextRequest(url, { method });
  return new NextRequest(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

export function smCtx<P extends Record<string, string>>(params: P): { params: Promise<P> } {
  return { params: Promise.resolve(params) };
}

export function haiCoreOk(body: unknown, status = 200): { status: number; text(): Promise<string> } {
  return { status, text: async () => JSON.stringify(body) };
}
