// /app/entry/_actions/sendSubmitEmail.ts
'use server';

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function sendSubmitEmailAction(p: {
  to: string; name: string; manageUrl?: string; faqUrl?: string;
  termsUrl?: string; supportEmail?: string; slaHours?: number;
}) {
  const res = await fetch(`${baseUrl()}/api/send-email/submit`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-meish-admin-token': process.env.ADMIN_API_TOKEN!, // ←サーバー側だけで付与
      // authorization: `Bearer ${process.env.ADMIN_API_TOKEN!}`, // どちらでもOK
    },
    body: JSON.stringify(p),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`send-email failed: ${res.status} ${await res.text().catch(()=> '')}`);
  return res.json();
}
