'use server';

export type EmailKind =
  | 'submit'
  | 'pass'
  | 'reject'
  | 'exhibitStart'
  | 'exhibitEnd'
  | 'purchaseBuyer'
  | 'purchaseArtist'
  | 'contact';

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL!;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function sendEmail(kind: EmailKind, payload: any) {
  const res = await fetch(`${baseUrl()}/api/send-email/${kind}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // ← サーバー側で内部トークンを付与（ブラウザには漏れない）
      'x-meish-admin-token': process.env.ADMIN_API_TOKEN!,
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
