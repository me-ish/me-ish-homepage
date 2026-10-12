import { isValidElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verify: vi.fn(), entry: vi.fn(), issue: vi.fn(), panel: vi.fn(() => null),
}));
vi.mock('@/lib/coa/server', () => ({
  verifyCertToken: mocks.verify, getEntryForCoA: mocks.entry, issueReissueLink: mocks.issue,
  resolveLangFromRequest: vi.fn(async () => 'ja'),
}));
vi.mock('@/components/cert/CoAInfoPanel', () => ({ default: mocks.panel }));
vi.mock('@/components/cert/CoAPdfActions', () => ({ default: () => null }));
vi.mock('@/components/cert/AssetsReceiveSection', () => ({ default: () => null }));

import CertPage from '../page';

const safeEntry = {
  id: 12, title: 'Synthetic art', artist_name: 'Synthetic artist', edition_total: 1,
  created_at: '2026-10-01T00:00:00Z', confirmed_at: null,
};

function panelProps(node: ReactNode): Record<string, unknown> | undefined {
  if (Array.isArray(node)) return node.map(panelProps).find(Boolean);
  if (!isValidElement<Record<string, unknown>>(node)) return undefined;
  if (node.type === mocks.panel) return node.props;
  return panelProps(node.props.children as ReactNode);
}
function page(id = '12', t?: string) {
  return CertPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ t }) });
}
function payload(node: ReactNode) {
  // Inspect serializable props, not Next's circular component implementation.
  return JSON.stringify(node, (key, value) => key === 'type' || key === '_owner' ? undefined : value);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.verify.mockResolvedValue({ ok: false, reason: 'missing' });
  mocks.entry.mockResolvedValue(safeEntry);
  mocks.issue.mockResolvedValue('/cert/12?t=unauthorized-new-token');
});

describe('certificate page authorization and client payload', () => {
  it.each(['missing', 'expired', 'revoked', 'notfound'])('never issues a replacement or reads entries for %s token', async (reason) => {
    mocks.verify.mockResolvedValue({ ok: false, reason });
    const result = await page('12', reason === 'missing' ? undefined : 'synthetic-invalid');
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.entry).not.toHaveBeenCalled();
    expect(panelProps(result)).toBeUndefined();
    expect(payload(result)).not.toContain('unauthorized-new-token');
  });

  it('refuses a token for a different entry even if the verifier regresses', async () => {
    mocks.verify.mockResolvedValue({ ok: true, entryId: 13 });
    const result = await page('12', 'synthetic-token');
    expect(mocks.verify).toHaveBeenCalledWith('synthetic-token', 12);
    expect(mocks.entry).not.toHaveBeenCalled();
    expect(panelProps(result)).toBeUndefined();
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it('projects the client boundary to exactly six fields even if the getter returns a full row', async () => {
    mocks.verify.mockResolvedValue({ ok: true, entryId: 12 });
    mocks.entry.mockResolvedValue({
      ...safeEntry, email: 'private-marker@example.invalid', user_id: 'private-owner',
      external_user_id: 'private-payment', image_url: 'private-source',
    });
    const result = await page('12', 'synthetic-token');
    expect(panelProps(result)?.entry).toEqual(safeEntry);
    expect(payload(result)).not.toContain('private-');
    expect(mocks.entry).toHaveBeenCalledWith(12);
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it('keeps the printable certificate and title fallback for a valid link', async () => {
    mocks.verify.mockResolvedValue({ ok: true, entryId: 12 });
    mocks.entry.mockResolvedValue({ ...safeEntry, title: null });
    const result = await page('12', 'synthetic-token');
    expect(panelProps(result)?.entry).toEqual({ ...safeEntry, title: '(Untitled)' });
    expect(panelProps(result)?.showOnchain).toBe(false);
    expect(payload(result)).toContain('coa-printable');
  });

  it.each(['0', '-1', '1.5', '9007199254740992', 'garbage'])('rejects invalid URL id %s before authorization or DB access', async (id) => {
    await page(id, 'synthetic-token');
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.entry).not.toHaveBeenCalled();
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it('does not expose raw service errors or recover by issuing a link', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.verify.mockRejectedValue(new Error('private-database-error-marker'));
    const result = await page('12', 'synthetic-token');
    expect(payload(result)).not.toContain('private-database-error-marker');
    expect(log.mock.calls.flat().map(String).join(' ')).not.toContain('private-database-error-marker');
    expect(mocks.entry).not.toHaveBeenCalled();
    expect(mocks.issue).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
