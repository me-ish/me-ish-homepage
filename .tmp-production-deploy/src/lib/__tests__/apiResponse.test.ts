import { describe, it, expect } from 'vitest';
import { apiOk, apiErr } from '../apiResponse';

describe('apiOk', () => {
  it('returns 200 with ok: true', async () => {
    const res = apiOk();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('merges data into body', async () => {
    const res = apiOk({ id: '1', name: 'test' });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBe('1');
    expect(body.name).toBe('test');
  });

  it('supports custom status', async () => {
    const res = apiOk({ id: '1' }, 201);
    expect(res.status).toBe(201);
  });
});

describe('apiErr', () => {
  it('returns 400 by default', async () => {
    const res = apiErr('bad_request');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('bad_request');
  });

  it('returns custom status', async () => {
    const res = apiErr('not_found', 404);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });

  it('includes details when provided', async () => {
    const details = [{ field: 'email', message: 'required' }];
    const res = apiErr('validation_failed', 400, details);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.details).toEqual(details);
  });

  it('omits details when not provided', async () => {
    const res = apiErr('server_error', 500);
    const body = await res.json();
    expect(body.details).toBeUndefined();
  });
});
