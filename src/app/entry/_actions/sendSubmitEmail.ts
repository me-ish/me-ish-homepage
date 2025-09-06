'use server';

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

type Payload = {
  to: string;
  name: string;
  manageUrl?: string;
  faqUrl?: string;
  termsUrl?: string;
  supportEmail?: string;
  slaHours?: number;
};

export async function sendSubmitEmailAction(p: Payload) {
  const res = await fetch(`${baseUrl()}/api/send-email/submit`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // ルートが要求している内部トークン（x-meish-admin-token）をサーバー側で付与
      'x-meish-admin-token': process.env.ADMIN_API_TOKEN!, // ← Vercelの値が使われます
      // もしBearerで統一したいなら次行でも可:
      // authorization: `Bearer ${process.env.ADMIN_API_TOKEN!}`,
    },
    body: JSON.stringify(p),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`send-email failed: ${res.status} ${text}`);
  }
  return res.json();
}
