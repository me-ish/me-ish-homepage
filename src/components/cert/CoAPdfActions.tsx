// /src/components/cert/CoAPdfActions.tsx
'use client';
import { useCallback, useState } from 'react';
import type { FC } from 'react';

type Props = {
  filename?: string;     // 例: "CoA_me-ish"
  targetId: string;      // 例: "coa-printable"
};

const CoAPdfActions: FC<Props> = ({ filename = 'certificate', targetId }) => {
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

      // 要素をそのままキャプチャ（背景白・解像度↑）
      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: window.devicePixelRatio > 1 ? 2 : 1.5,
        useCORS: true,
      });

      const img = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = 210;
      const pageH = 297;
      const margin = 8; // 余白を少しだけ

      // キャンバス比でフィットさせる
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
    <div className="rounded-2xl border bg-white p-4 flex items-center justify-between">
      <div className="text-sm text-gray-700">証明書PDFをダウンロード</div>
      <button
        onClick={handleDownload}
        disabled={busy}
        className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50"
      >
        {busy ? '生成中…' : 'PDFをダウンロード'}
      </button>
    </div>
  );
};

export default CoAPdfActions;
