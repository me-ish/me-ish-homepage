'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type Inquiry = {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // RLSが設定済ならadminユーザーのみ表示される
    );

    const fetchInquiries = async () => {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load inquiries:', error.message);
      } else {
        setInquiries(data);
      }
    };

    fetchInquiries();
  }, []);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">お問い合わせ一覧</h1>
      {inquiries.length === 0 ? (
        <p>まだお問い合わせはありません。</p>
      ) : (
        <ul className="space-y-6">
          {inquiries.map((inquiry) => (
            <li key={inquiry.id} className="border rounded-lg p-4 bg-white shadow">
              <div className="text-sm text-gray-500 mb-1">{new Date(inquiry.created_at).toLocaleString()}</div>
              <div className="font-semibold mb-1">お名前：{inquiry.name}</div>
              {inquiry.email && <div className="text-sm mb-2">📧 {inquiry.email}</div>}
              <p className="whitespace-pre-wrap">{inquiry.message}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
