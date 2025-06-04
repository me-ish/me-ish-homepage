'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [code, setCode] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === 'me-ish0716') {
      localStorage.setItem('isAdmin', 'true');
      router.push('/admin');
    } else {
      alert('パスコードが間違っています');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '480px', margin: '0 auto' }}>
      <h2>管理ページログイン</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="パスコードを入力"
          style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
        />
        <button type="submit" style={{ width: '100%', padding: '0.5rem' }}>
          ログイン
        </button>
      </form>
    </div>
  );
}
