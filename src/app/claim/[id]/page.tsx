// src/app/claim/[id]/page.tsx
export default function ClaimPage({ params }: { params: { id: string } }) {
  const { id } = params;

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>
        Claim Entry #{id}
      </h1>

      {/* ここにUI（フォーム/ボタン）を実装。例）<ClaimForm entryId={id} /> */}
      <p style={{ opacity: 0.8 }}>
        POST は <code>/api/claim/{'{id}'}</code> に移動しました。
      </p>
    </main>
  );
}

