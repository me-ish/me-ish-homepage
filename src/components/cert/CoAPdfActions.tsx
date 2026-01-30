'use client';

import { useCallback, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';

type Props = {
  filename?: string;
  targetId: string;
  label?: string;
};

export default function CoAPdfActions({
  filename = 'certificate',
  targetId,
  label = '証明書PDFをダウンロード',
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleDownload = useCallback(async () => {
    const el = document.getElementById(targetId);
    if (!el) return;

    setBusy(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: window.devicePixelRatio > 1 ? 2 : 1.5,
        useCORS: true,
      });

      const img = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = 210;
      const pageH = 297;
      const margin = 8;

      const imgWmm = pageW - margin * 2;
      const imgHmm = (imgWmm * canvas.height) / canvas.width;
      const fitsHeight = imgHmm <= pageH - margin * 2;

      const w = fitsHeight ? imgWmm : ((pageH - margin * 2) * canvas.width) / canvas.height;
      const h = fitsHeight ? imgHmm : pageH - margin * 2;
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;

      pdf.addImage(img, 'JPEG', x, y, w, h);
      pdf.save(`${filename}.pdf`);
    } finally {
      setBusy(false);
    }
  }, [filename, targetId]);

  return (
    <div className="group rounded-2xl bg-white border border-gray-100 p-5 transition-all hover:border-gray-200 hover:shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 text-gray-400 group-hover:bg-[#00a1e9]/10 group-hover:text-[#00a1e9] transition-colors">
            <FileDown className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{label}</p>
            <p className="text-xs text-gray-500 mt-0.5">A4サイズのPDFとして保存</p>
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={busy}
          className="
            flex items-center gap-2 px-5 py-2.5 rounded-xl
            bg-gray-900 text-white text-sm font-medium
            transition-all hover:bg-gray-800 active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              生成中...
            </>
          ) : (
            'ダウンロード'
          )}
        </button>
      </div>
    </div>
  );
}
