'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Inquiry = {
  id: string;
  name: string | null;
  email: string | null;
  message: string | null;
  created_at: string;
  is_read: boolean;
};

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  useEffect(() => {
    fetchInquiries();
  }, []);

  const fetchInquiries = async () => {
    const { data, error } = await supabase
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setInquiries(data as Inquiry[]);
    if (error) console.error('読み込みエラー:', error.message);
  };

  const handleConfirm = async (id: string) => {
    const { error } = await supabase
      .from('inquiries')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      console.error('更新エラー:', error.message);
    } else {
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === id ? { ...inq, is_read: true } : inq))
      );
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <h2>お問い合わせ一覧</h2>
      {inquiries.length === 0 ? (
        <p>問い合わせはまだありません。</p>
      ) : (
        <ul style={{ marginTop: '1.5rem', listStyle: 'none', padding: 0 }}>
          {inquiries.map((inq) => (
            <li
              key={inq.id}
              style={{
                border: '1px solid #ccc',
                padding: '1rem',
                marginBottom: '1rem',
                backgroundColor: inq.is_read ? '#f5f5f5' : '#fff8e1',
              }}
            >
              <p>
                <strong>名前:</strong>{' '}
                {typeof inq.name === 'string' && inq.name.trim()
                  ? inq.name
                  : '（匿名）'}
              </p>
              {typeof inq.email === 'string' && inq.email.trim() && (
                <p>
                  <strong>メール:</strong> {inq.email}
                </p>
              )}
              <p>
                <strong>内容:</strong>{' '}
                {typeof inq.message === 'string' && inq.message.trim()
                  ? inq.message
                  : '（内容なし）'}
              </p>
              <p>
                <small>
                  {new Date(inq.created_at).toLocaleString('ja-JP')}
                </small>
              </p>
              {!inq.is_read ? (
                <button
                  onClick={() => handleConfirm(inq.id)}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.4rem 0.8rem',
                    backgroundColor: '#00a1e9',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  確認
                </button>
              ) : (
                <p style={{ color: '#666' }}>✅ 確認済み</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
