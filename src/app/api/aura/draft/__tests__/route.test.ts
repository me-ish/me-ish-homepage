import { describe, it, expect, vi } from 'vitest';
import { LEGACY_SERVICE_PAUSED_MESSAGE } from '@/lib/legacyServiceSuspension';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/aura/aura.db', () => { throw new Error('Retired draft route imported DB code'); });
vi.mock('@/lib/aura/requireAuraAccess', () => { throw new Error('Retired draft route imported session code'); });

import { POST } from '../route';

// Replaces the retired creation/validation contract. Neither a valid old client
// nor malformed input may create a draft, issue a session or expose DB errors.
describe('POST /api/aura/draft during suspension', () => {
  const cases: { label: string; body: string; headers: Record<string, string> }[] = [
    { label: 'no CSRF header', body: '{"email":"synthetic@example.invalid"}', headers: {} },
    { label: 'missing email', body: '{}', headers: { 'x-requested-with': 'me-ish' } },
    { label: 'non-string email', body: '{"email":123}', headers: { 'x-requested-with': 'me-ish' } },
    { label: 'valid legacy client', body: '{"email":"synthetic@example.invalid","name":"Synthetic"}', headers: { 'x-requested-with': 'me-ish' } },
    { label: 'existing session cookie', body: '{}', headers: { cookie: 'aura_st_synthetic=synthetic' } },
    { label: 'malformed JSON', body: '{invalid', headers: { 'x-requested-with': 'me-ish' } },
  ];
  it.each(cases)('stays paused for $label', async ({ body, headers }) => {
    const request = new Request('https://example.invalid/api/aura/draft', {
      method: 'POST', body,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
    const readBody = vi.spyOn(request, 'json').mockImplementation(() => { throw new Error('Retired route read input'); });
    const handler: (request: Request) => Promise<Response> = POST;
    const response = await handler(request);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(await response.json()).toEqual({ error: 'legacy_service_paused', message: LEGACY_SERVICE_PAUSED_MESSAGE, service: 'aura' });
    expect(readBody).not.toHaveBeenCalled();
  });
});
