import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminLogin.css';

export default function AdminLogin() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code === 'me-ish0716') {
      localStorage.setItem('isAdmin', 'true');
      navigate('/admin');
    } else {
      alert('パスコードが間違っています');
    }
  };

  return (
    <div className="admin-login-container">
      <h2>管理ページログイン</h2>
      <form onSubmit={handleSubmit} className="admin-login-form">
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="パスコードを入力"
          className="admin-login-input"
        />
        <button type="submit" className="admin-login-button">ログイン</button>
      </form>
    </div>
  );
}
