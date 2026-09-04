    // --- /src/app/api/internal/send-submit-email/route.ts ---
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const origin = new URL(req.url).origin;

    if (!process.env.ADMIN_API_TOKEN) {
      return NextResponse.json({ error: 'server misconfig: ADMIN_API_TOKEN' }, { status: 500 });
    }

    const res = await fetch(`${origin}/api/send-email/submit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-meish-admin-token': process.env.ADMIN_API_TOKEN!,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[proxy] submit email failed:', message);
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}
