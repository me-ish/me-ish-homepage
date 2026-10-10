// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminEntriesClient from '../AdminEntriesClient';

vi.mock('next/image', () => ({ default: () => null }));
const entries = [
  { id: 1, title: '保存作品', artist_name: '保管作家', email: 'example@example.invalid', price: 1000, edition_sold: 1, edition_total: 3 },
  { id: 2, title: '別の作品', artist_name: '別の作家', email: null, price: 2000 },
];

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('retired gallery support reader', () => {
  it('keeps searchable records and support navigation without exhibition write controls', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(entries)));
    vi.stubGlobal('fetch', fetcher);
    render(<AdminEntriesClient adminEmail="admin@example.invalid" />);
    await screen.findByText('#1 保存作品');
    expect(screen.getByText('販売済み: 1 / 3')).toBeTruthy();
    expect(screen.getByRole('link', { name: '保管作家' }).getAttribute('href')).toBe('/admin/users/%E4%BF%9D%E7%AE%A1%E4%BD%9C%E5%AE%B6');
    expect(screen.getByRole('link', { name: '売上・振込を確認' }).getAttribute('href')).toBe('/admin/payouts');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '保存作品' } });
    expect(screen.queryByText('#2 別の作品')).toBeNull();
    expect(screen.queryByRole('button', { name: /承認|却下|展示|再審査/ })).toBeNull();
    expect(fetcher.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true);
  });

  it('shows read failures instead of reporting an empty archive', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    render(<AdminEntriesClient adminEmail="admin@example.invalid" />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('該当する作品記録はありません。')).toBeNull();
  });

  it('recovers from a failed read using only another GET', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(entries)));
    vi.stubGlobal('fetch', fetcher);
    render(<AdminEntriesClient adminEmail="admin@example.invalid" />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    await screen.findByText('#1 保存作品');
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true);
  });
});
