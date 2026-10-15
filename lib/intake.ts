import { NextRequest } from 'next/server';

const windows = new Map<string,{ count: number; expires: number }>();
export async function readSubmission(request: NextRequest, maxBytes: number) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) throw new Error('origin');
  if (!request.headers.get('content-type')?.includes('application/json')) throw new Error('type');
  const key = `${request.nextUrl.pathname}:${request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local'}`;
  const now = Date.now();
  if (windows.size > 1000) for (const [key, value] of windows) if (value.expires < now) windows.delete(key);
  if (windows.size > 2000) throw new Error('rate');
  const window = windows.get(key);
  if (window && window.expires > now) { if (++window.count > 40) throw new Error('rate'); }
  else windows.set(key,{count:1,expires:now+60000});
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const {done,value} = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error('size'); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
export function submissionStatus(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return message === 'rate' ? 429 : message === 'origin' ? 403 : message === 'size' ? 413 : 400;
}
