// src/components/card/CardQRCode.tsx
"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  url: string;
  size?: number;
  colorPrimary?: string;
  colorBG?: string;
};

export default function CardQRCode({
  url,
  size = 120,
  colorPrimary = "#111827",
  colorBG = "#ffffff",
}: Props) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="cursor-pointer"
      style={{ perspective: "600px" }}
      onClick={() => setFlipped((f) => !f)}
    >
      <div
        className="relative transition-transform duration-700"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          width: size + 32,
          height: size + 32,
        }}
      >
        {/* Front: QR code */}
        <div
          className="absolute inset-0 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center"
          style={{
            backfaceVisibility: "hidden",
            backgroundColor: colorBG,
          }}
        >
          <QRCodeSVG
            value={url}
            size={size}
            fgColor={colorPrimary}
            bgColor="transparent"
            level="M"
          />
        </div>

        {/* Back: URL text */}
        <div
          className="absolute inset-0 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center p-4"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            backgroundColor: colorBG,
          }}
        >
          <p
            className="text-xs text-center break-all font-mono"
            style={{ color: colorPrimary }}
          >
            {url}
          </p>
          <p
            className="text-[10px] mt-2 opacity-50"
            style={{ color: colorPrimary }}
          >
            タップでQRに戻る
          </p>
        </div>
      </div>
    </div>
  );
}
