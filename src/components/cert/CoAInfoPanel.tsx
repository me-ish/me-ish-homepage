import CoAPdfActions from './CoAPdfActions';

export default function CoAPage({ /* props */ }) {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      {/* ダウンロードボタン（ファイル名はお好みで）*/}
      <div className="flex justify-end">
        <CoAPdfActions filename="CoA_me-ish" targetId="coa-printable" />
      </div>

      {/* ここがPDF化される領域 */}
      <div
        id="coa-printable"
        className="bg-white text-[#111] border rounded-xl p-8 shadow-sm"
        style={{
          // 印刷を想定し、背景白・不要なアニメ/影は最小限に
          // PDFがぼやける場合はフォントの letter-spacing を控えめに
        }}
      >
        {/* 例: ロゴ/タイトル */}
        <h1 className="text-2xl font-bold mb-4">Certificate of Authenticity</h1>

        {/* 作品情報など（既存のCoA表示をそのまま） */}
        {/* ... */}
      </div>
    </div>
  );
}
