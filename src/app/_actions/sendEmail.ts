'use server';

// ★ 'contact' を追加
export type EmailKind =
  | 'submit'
  | 'pass'
  | 'reject'
  | 'exhibitStart'
  | 'exhibitEnd'
  | 'purchaseBuyer'
  | 'purchaseArtist'
  | 'purchaseNft'
  | 'contact';

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL!;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

// payload の厳密型付けは後で拡張可。まずは any でOK。
export async function sendEmail(kind: EmailKind, payload: any) {
  const res = await fetch(`${baseUrl()}/api/send-email/${kind}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-meish-admin-token': process.env.ADMIN_API_TOKEN!, // 内部トークン
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`sendEmail(${kind}) failed: ${res.status} ${text}`);
  }
  return res.json();
}
