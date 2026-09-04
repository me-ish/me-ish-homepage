// app/admin/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminAuth } from '@/lib/auth/requireAdminAuth';

export const revalidate = 0;

function normalizeHttpUrl(u?: string | null): string | null {
  if (!u) return null;
  const s = u.trim();
  if (!s) return null;
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const url = new URL(withProto);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

// 型ゆれに強いパーサ
function parseLinks(raw: unknown): string[] {
  try {
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (!s) return [];
      if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
        return parseLinks(JSON.parse(s));
      }
      const n = normalizeHttpUrl(s);
      return n ? [n] : [];
    }
    if (Array.isArray(raw)) {
      const arr = raw
        .map((v) => (typeof v === 'string' ? normalizeHttpUrl(v) : null))
        .filter((v): v is string => !!v);
      return Array.from(new Set(arr));
    }
    if (raw && typeof raw === 'object') {
      const arr = Object.values(raw as Record<string, unknown>)
        .map((v) => (typeof v === 'string' ? normalizeHttpUrl(v) : null))
        .filter((v): v is string => !!v);
      return Array.from(new Set(arr));
    }
  } catch { /* noop */ }
  return [];
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) return auth.response;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('entries')
    .select('artist_name, sns_links');

  if (error) return NextResponse.json({ error: 'list_failed' }, { status: 500 });

  type Entry = { artist_name: string | null; sns_links: unknown };
  const grouped = new Map<string, { artist_name: string; sns_links: string[]; entry_count: number }>();

  (data as Entry[]).forEach((entry) => {
    const key = (entry.artist_name ?? '未設定').trim() || '未設定';
    const links = parseLinks(entry.sns_links);

    const existing = grouped.get(key);
    if (existing) {
      existing.entry_count += 1;
      for (const l of links) if (!existing.sns_links.includes(l)) existing.sns_links.push(l);
    } else {
      grouped.set(key, {
        artist_name: key,
        sns_links: [...links],
        entry_count: 1,
      });
    }
  });

  const list = Array.from(grouped.values()).sort((a, b) => {
    if (b.entry_count !== a.entry_count) return b.entry_count - a.entry_count;
    return a.artist_name.localeCompare(b.artist_name, 'ja');
  });

  return NextResponse.json({ items: list, total: list.length }, { headers: { 'Cache-Control': 'no-store' } });
}
