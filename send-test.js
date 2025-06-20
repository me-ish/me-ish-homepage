// send-test.js
fetch('http://localhost:3000/api/send-email/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'あなたのメールアドレス@example.com',
    name: 'テスト太郎'
  })
})
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);
