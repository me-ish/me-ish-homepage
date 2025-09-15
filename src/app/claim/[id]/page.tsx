// ページは Server Component のままでOK（UI専用）
export default function ClaimPage({ params }: { params: { id: string } }) {
  const { id } = params;

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>Claim Entry #{id}</h1>
      {/* ここに UI を実装（フォームやボタンなど）。例： */}
      {/* <ClaimForm entryId={id} /> */}
      <p style={{ opacity: 0.8 }}>
        このページは表示専用です。<code>POST /claim/{'{id}'}</code> は
        <code>route.ts</code> の Route Handler に移動しました。
      </p>
    </main>
  );
}

