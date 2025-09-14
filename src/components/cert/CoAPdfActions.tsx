'use client';

import { useState, useCallback } from 'react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';

type Props = {
  /** 保存ファイル名（拡張子なし） */
  filename?: string;
  /** CoA内容を囲っている要素の id（例: 'coa-printable'） */
  targetId?: string;
  /** 余白（mm） */
  marginMm?: number;
  /** 用紙向き */
  orientation?: 'p' | 'l'; // portrait / landscape
};

export default function CoAPdfActions({
  filename = 'certificate',
  targetId = 'coa-printable',
  marginMm = 10,
  orientation = 'p',
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleDownload = useCallback(async () => {
    const node = document.getElementById(targetId);
    if (!node) {
      alert(`ターゲット要素 #${targetId} が見つかりません。`);
      return;
    }
    try {
      setBusy(true);

      // 1) DOM → 画像（高解像度で）
      const dataUrl = await toPng(node, {
        pixelRatio: 2,               // 2〜3に上げると文字が綺麗
        backgroundColor: '#ffffff',  // 透明を白に
        cacheBust: true,
      });

      // 2) A4 PDF へレイアウト
      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const maxW = pageW - marginMm * 2;
      const maxH = pageH - marginMm * 2;

      // 画像の実サイズ（ピクセル）取得
      const img = new Image();
      await new Promise<void>((ok, ng) => {
        img.onload = () => ok();
        img.onerror = () => ng(new Error('image load failed'));
        img.src = dataUrl;
      });

      // px→mm 換算（96dpi想定）
      const pxToMm = (px: number) => (px * 25.4) / 96;
      const imgWmm = pxToMm(img.width);
      const imgHmm = pxToMm(img.height);

      // 収まるようにスケール
      const scale = Math.min(maxW / imgWmm, maxH / imgHmm);
      const drawW = imgWmm * scale;
      const drawH = imgHmm * scale;
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;

      pdf.addImage(dataUrl, 'PNG', x, y, drawW, drawH, undefined, 'FAST');

      // 3) 保存
      // Safari などで日本語ファイル名が崩れるのを避けるため、最後に .pdf を付ける
      pdf.save(`${filename}.pdf`);
    } catch (e) {
      console.error('[CoA PDF] failed:', e);
      alert('PDFの生成に失敗しました');
    } finally {
      setBusy(false);
    }
  }, [filename, marginMm, orientation, targetId]);

  return (
    <Button
      onClick={handleDownload}
      disabled={busy}
      className="bg-[#00a1e9] hover:bg-[#008ec4] text-white"
    >
      {busy ? '生成中…' : 'PDFをダウンロード'}
    </Button>
  );
}
