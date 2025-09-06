// send-test.js

fetch('http://localhost:3000/api/send-email/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'info@me-ish.art', // ← ここは自分で受信確認できるメールアドレスに変更！
    name: 'テスト太郎'
  })
})
  .then(async (res) => {
    const result = await res.json();
    console.log('✅ レスポンス:', result);
  })
  .catch((err) => {
    console.error('❌ エラー:', err);
  });

