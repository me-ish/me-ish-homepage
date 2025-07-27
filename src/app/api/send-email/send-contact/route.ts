import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // 1. Resend で info@me-ish.art に送信
    await resend.emails.send({
      from: 'お問い合わせフォーム <noreply@me-ish.art>',
      to: 'info@me-ish.art',
      subject: `お問い合わせ from ${name}`,
      text: `名前: ${name}\nメール: ${email}\n\n${message}`,
    });

    // 2. Supabase に保存
    const { error } = await supabase.from('inquiries').insert([{ name, email, message }]);

    if (error) {
      console.error('Supabase Error:', error);
      return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unhandled Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
