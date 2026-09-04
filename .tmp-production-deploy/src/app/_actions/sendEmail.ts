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

import { getSiteUrl } from '@/lib/constants';

export async function sendEmail(kind: EmailKind, payload: any) {
  const res = await fetch(`${getSiteUrl()}/api/send-email/${kind}`, {
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
