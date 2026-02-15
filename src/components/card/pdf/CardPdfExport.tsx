// src/components/card/pdf/CardPdfExport.tsx
"use client";

import { useState, useRef } from "react";
import { Download, Loader2 } from "lucide-react";
import type { CardDesign, CardContent } from "@/lib/card/card.schema";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  design: CardDesign;
  content: CardContent;
  publicUrl: string;
};

// Business card size: 91mm x 55mm
const CARD_W_MM = 91;
const CARD_H_MM = 55;
const DPI = 3; // pixels per mm for rendering
const CARD_W_PX = CARD_W_MM * DPI;
const CARD_H_PX = CARD_H_MM * DPI;

export default function CardPdfExport({
  design,
  content,
  publicUrl,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    setGenerating(true);

    try {
      const [{ toPng }, { default: jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [CARD_W_MM, CARD_H_MM],
      });

      // Front side
      if (frontRef.current) {
        const frontPng = await toPng(frontRef.current, {
          width: CARD_W_PX,
          height: CARD_H_PX,
          pixelRatio: 2,
        });
        pdf.addImage(frontPng, "PNG", 0, 0, CARD_W_MM, CARD_H_MM);
      }

      // Back side
      if (backRef.current) {
        pdf.addPage([CARD_W_MM, CARD_H_MM], "landscape");
        const backPng = await toPng(backRef.current, {
          width: CARD_W_PX,
          height: CARD_H_PX,
          pixelRatio: 2,
        });
        pdf.addImage(backPng, "PNG", 0, 0, CARD_W_MM, CARD_H_MM);
      }

      pdf.save(`${content.profile.name}-card.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      {/* Export button */}
      <button
        type="button"
        onClick={handleExport}
        disabled={generating}
        className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-900 transition-colors disabled:opacity-50"
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            PDF生成中...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            名刺PDFをダウンロード
          </>
        )}
      </button>

      {/* Hidden render targets for PDF capture */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none">
        {/* ===== FRONT ===== */}
        <div
          ref={frontRef}
          style={{
            width: CARD_W_PX,
            height: CARD_H_PX,
            backgroundColor: design.colorBG,
            color: design.colorText,
            display: "flex",
            padding: "16px 20px",
            fontFamily: "sans-serif",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Left: avatar + name */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: "0 0 40%",
              gap: 6,
            }}
          >
            {content.profile.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={content.profile.avatarUrl}
                alt=""
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            )}
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: design.colorText,
              }}
            >
              {content.profile.name}
            </div>
            <div
              style={{
                fontSize: 9,
                opacity: 0.7,
                color: design.colorText,
              }}
            >
              {content.profile.title}
            </div>
            <div
              style={{
                fontSize: 8,
                opacity: 0.5,
                color: design.colorText,
              }}
            >
              {content.profile.email}
            </div>
          </div>

          {/* Right: works thumbnails */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: content.works && content.works.length === 1 ? 0 : 4,
              flexWrap: "wrap",
            }}
          >
            {content.works && content.works.length === 1 ? (
              // Single work: larger thumbnail
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={content.works[0].imageUrl}
                alt=""
                style={{
                  width: 100,
                  height: 70,
                  borderRadius: 6,
                  objectFit: "cover",
                  objectPosition: `${content.works[0].focusX ?? 50}% ${content.works[0].focusY ?? 50}%`,
                }}
              />
            ) : (
              content.works?.slice(0, 6).map((w, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={w.imageUrl}
                  alt=""
                  style={{
                    width: content.works!.length <= 3 ? 38 : 30,
                    height: content.works!.length <= 3 ? 38 : 30,
                    borderRadius: 3,
                    objectFit: "cover",
                    objectPosition: `${w.focusX ?? 50}% ${w.focusY ?? 50}%`,
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* ===== BACK ===== */}
        <div
          ref={backRef}
          style={{
            width: CARD_W_PX,
            height: CARD_H_PX,
            backgroundColor: design.colorBG,
            color: design.colorText,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "sans-serif",
            overflow: "hidden",
            gap: 8,
          }}
        >
          <QRCodeSVG
            value={publicUrl}
            size={80}
            fgColor={design.colorPrimary}
            bgColor="transparent"
            level="M"
          />
          <div
            style={{
              fontSize: 7,
              opacity: 0.5,
              textAlign: "center",
              maxWidth: "80%",
              wordBreak: "break-all",
            }}
          >
            {publicUrl}
          </div>
          {content.profile.tagline && (
            <div
              style={{
                fontSize: 9,
                fontStyle: "italic",
                opacity: 0.6,
                textAlign: "center",
              }}
            >
              &ldquo;{content.profile.tagline}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
