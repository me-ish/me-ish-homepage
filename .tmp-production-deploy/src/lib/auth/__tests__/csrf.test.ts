import { describe, it, expect } from 'vitest';
import { checkCsrf, CSRF_HEADERS } from '../csrf';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/api/test', { headers });
}

describe('CSRF_HEADERS', () => {
  it('has correct header value', () => {
    expect(CSRF_HEADERS['x-requested-with']).toBe('me-ish');
  });
});

describe('checkCsrf', () => {
  it('returns null for valid header', () => {
    const req = makeRequest({ 'x-requested-with': 'me-ish' });
    expect(checkCsrf(req)).toBeNull();
  });

  it('returns 403 when header is missing', async () => {
    const req = makeRequest();
    const res = checkCsrf(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('csrf_rejected');
  });

  it('returns 403 for wrong header value', async () => {
    const req = makeRequest({ 'x-requested-with': 'wrong-value' });
    const res = checkCsrf(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.ok).toBe(false);
  });
});
