'use client';

import { useCallback, useState } from 'react';
import { FileDown, Loader2, Printer } from 'lucide-react';

type ReceiptData = {
  receiptNo: string;
  purchasedAt: string | null;
  buyerEmail: string;
  itemTitle: string;
  artistName: string;
  price: number;
  sessionId: string;
};

type Props = {
  data: ReceiptData;
};

export default function ReceiptClient({ data }: Props) {
  const [busy, setBusy] = useState(false);

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatYen = (n: number) => {
    return new Intl.NumberFormat('ja-JP').format(n);
  };

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownload = useCallback(async () => {
    const el = document.getElementById('receipt-content');
    if (!el) return;

    setBusy(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      const img = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = 210;
      const pageH = 297;
      const margin = 15;

      const imgWmm = pageW - margin * 2;
      const imgHmm = (imgWmm * canvas.height) / canvas.width;
      const fitsHeight = imgHmm <= pageH - margin * 2;

      const w = fitsHeight ? imgWmm : ((pageH - margin * 2) * canvas.width) / canvas.height;
      const h = fitsHeight ? imgHmm : pageH - margin * 2;
      const x = (pageW - w) / 2;
      const y = margin;

      pdf.addImage(img, 'JPEG', x, y, w, h);
      pdf.save(`receipt-${data.receiptNo}.pdf`);
    } finally {
      setBusy(false);
    }
  }, [data.receiptNo]);

  return (
    <main className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0">
      {/* 操作ボタン（印刷時は非表示） */}
      <div className="max-w-2xl mx-auto mb-6 flex justify-end gap-3 print:hidden">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          <Printer className="w-4 h-4" />
          印刷
        </button>
        <button
          onClick={handleDownload}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2 bg-[#00a1e9] text-white rounded-lg text-sm font-medium hover:bg-[#008ec4] transition disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" />
              PDFダウンロード
            </>
          )}
        </button>
      </div>

      {/* 領収書本体 */}
      <div
        id="receipt-content"
        className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-8 print:shadow-none print:rounded-none"
      >
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-wide mb-2">領 収 書</h1>
          <p className="text-gray-500 text-sm">RECEIPT</p>
        </div>

        {/* 宛名 */}
        <div className="mb-8">
          <div className="border-b-2 border-gray-900 pb-2 inline-block min-w-[200px]">
            <span className="text-lg">{data.buyerEmail}</span>
            <span className="ml-2 text-gray-600">様</span>
          </div>
        </div>

        {/* 金額 */}
        <div className="bg-gray-50 rounded-lg p-6 mb-8 text-center">
          <p className="text-sm text-gray-600 mb-2">ご購入金額（税込）</p>
          <p className="text-4xl font-bold">
            <span className="text-2xl mr-1">¥</span>
            {formatYen(data.price)}
            <span className="text-lg text-gray-500 ml-1">-</span>
          </p>
        </div>

        {/* 明細 */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">明細</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 text-gray-600 w-1/3">作品名</td>
                <td className="py-3 text-right">{data.itemTitle}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 text-gray-600">作家名</td>
                <td className="py-3 text-right">{data.artistName}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 text-gray-600">購入日</td>
                <td className="py-3 text-right">{formatDate(data.purchasedAt)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 text-gray-600">領収書番号</td>
                <td className="py-3 text-right font-mono">{data.receiptNo}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 但し書き */}
        <div className="mb-8">
          <p className="text-sm text-gray-600">
            但し、<span className="font-medium">デジタルアート作品代として</span>
          </p>
        </div>

        {/* 発行者情報 */}
        <div className="border-t pt-6">
          <div className="flex justify-between items-start">
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900 mb-1">発行者</p>
              <p>me-ish運営事務局</p>
              <p>代表者：大下唯</p>
              <p>info@me-ish.art</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-2">発行日</p>
              <p className="font-medium">{formatDate(data.purchasedAt)}</p>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="mt-8 pt-4 border-t border-dashed text-center">
          <p className="text-xs text-gray-400">
            この領収書は me-ish（https://www.me-ish.art）が発行しました
          </p>
          <p className="text-xs text-gray-400 mt-1">
            取引ID: {data.sessionId.slice(0, 20)}...
          </p>
        </div>
      </div>

      {/* 印刷用スタイル */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            margin: 15mm;
          }
        }
      `}</style>
    </main>
  );
}
