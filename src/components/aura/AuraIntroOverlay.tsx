"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  /** 初回だけ出す：デフォルト true（sessionStorage） */
  oncePerSession?: boolean;

  /** 強制的に毎回見せたい時（デバッグ用） */
  forceShow?: boolean;

  /** イントロをスキップできるようにする（Esc / クリック） */
  allowSkip?: boolean;

  /** 完了時コールバック（必要なら） */
  onDone?: () => void;
};

const STORAGE_KEY = "meish_aura_intro_done_v1";

// me-ish brand
const MEISH_CYAN = "#00a1e9";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export default function AuraIntroOverlay({
  oncePerSession = true,
  forceShow = false,
  allowSkip = true,
  onDone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"meish" | "shift" | "wipe" | "out">("meish");

  // 各フェーズの時間（ms）
  const D_MEISH = 1200;
  const D_SHIFT = 550;
  const D_WIPE = 1150;
  const D_OUT = 500;

  const totalMs = D_MEISH + D_SHIFT + D_WIPE + D_OUT;

  useEffect(() => {
    if (forceShow) {
      setOpen(true);
      return;
    }
    if (!oncePerSession) {
      setOpen(true);
      return;
    }
    try {
      const done = sessionStorage.getItem(STORAGE_KEY);
      if (done === "1") return;
      setOpen(true);
    } catch {
      // sessionStorage が使えない環境でも表示は許容
      setOpen(true);
    }
  }, [forceShow, oncePerSession]);

  // タイムライン制御
  useEffect(() => {
    if (!open) return;

    let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>, t3: ReturnType<typeof setTimeout>, t4: ReturnType<typeof setTimeout>;

    setPhase("meish");
    t1 = setTimeout(() => setPhase("shift"), D_MEISH);
    t2 = setTimeout(() => setPhase("wipe"), D_MEISH + D_SHIFT);
    t3 = setTimeout(() => setPhase("out"), D_MEISH + D_SHIFT + D_WIPE);
    t4 = setTimeout(() => finish(), totalMs);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Skip: click / Esc
  useEffect(() => {
    if (!open || !allowSkip) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allowSkip]);

  function finish() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setOpen(false);
    onDone?.();
  }

  // AURA の虹色（文字用）
  const auraGradient = useMemo(() => {
    // 目視で綺麗な虹（やりすぎない）
    return "linear-gradient(90deg, #ff4d6d 0%, #ffb703 18%, #52b788 38%, #00b4d8 60%, #3a86ff 78%, #8338ec 100%)";
  }, []);

  // “窓ふき”マスクの動き（斜めのワイプ）
  // viewBox 0..100 を想定。大きめ矩形を斜めに動かす。
  const wipeX = phase === "wipe" ? 0 : -120; // 初期は外
  const wipeRotate = -12;

  // me-ish の位置：中央→少し左
  const meishX =
    phase === "shift" || phase === "wipe" || phase === "out" ? -46 : 0;

  // 画面全体のフェードアウト
  const overlayOpacity = phase === "out" ? 0 : 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: overlayOpacity }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onMouseDown={() => {
            if (allowSkip) finish();
          }}
          aria-hidden
        >
          {/* 背景：フォームを少し隠して没入させる（黒+ブラー） */}
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[6px]" />

          {/* けむり：軽量ノイズ + blur で疑似。 */}
          <SmokeLayer />

          {/* 中央コンテンツ */}
          <div className="relative flex items-center justify-center">
            <div className="relative flex items-end gap-3">
              {/* me-ish */}
              <motion.div
                className="select-none font-lilita text-[56px] leading-none md:text-[72px]"
                initial={{ opacity: 0, y: 8, filter: "blur(14px)" as any }}
                animate={{
                  opacity: 1,
                  y: 0,
                  x: meishX,
                  filter: "blur(0px)" as any,
                }}
                transition={{
                  duration: 0.9,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{ color: MEISH_CYAN, textShadow: "0 18px 40px rgba(0,161,233,0.18)" }}
              >
                me-ish
              </motion.div>

              {/* AURA（窓ふき表示） */}
              <div className="relative select-none">
                {/* ベース（薄く置いておく。拭き残しのガイド） */}
                <div
                  className="font-lilita text-[56px] leading-none md:text-[72px]"
                  style={{
                    color: "rgba(255,255,255,0.08)",
                    transform: "translateY(2px)",
                  }}
                >
                  AURA
                </div>

                {/* マスクで“拭いたところだけ”見せる本体 */}
                <div className="absolute inset-0">
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 220 90"
                    preserveAspectRatio="xMinYMin meet"
                  >
                    <defs>
                      <linearGradient id="aura-rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ff4d6d" />
                        <stop offset="18%" stopColor="#ffb703" />
                        <stop offset="38%" stopColor="#52b788" />
                        <stop offset="60%" stopColor="#00b4d8" />
                        <stop offset="78%" stopColor="#3a86ff" />
                        <stop offset="100%" stopColor="#8338ec" />
                      </linearGradient>

                      {/* “窓ふき”マスク */}
                      <mask id="wipe-mask">
                        <rect x="0" y="0" width="220" height="90" fill="black" />
                        <motion.g
                          initial={{ x: -240, rotate: wipeRotate }}
                          animate={{ x: wipeX, rotate: wipeRotate }}
                          transition={{
                            duration: D_WIPE / 1000,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        >
                          {/* 拭き幅：やや広め + 端をぼかす */}
                          <rect x="0" y="-40" width="280" height="170" rx="24" fill="white" />
                          <rect
                            x="10"
                            y="-30"
                            width="260"
                            height="150"
                            rx="22"
                            fill="white"
                            opacity="0.55"
                          />
                        </motion.g>
                      </mask>

                      {/* うっすら拭き跡（粒） */}
                      <filter id="wipe-grain">
                        <feTurbulence
                          type="fractalNoise"
                          baseFrequency="0.9"
                          numOctaves="2"
                          stitchTiles="stitch"
                          result="noise"
                        />
                        <feColorMatrix
                          type="matrix"
                          values="
                            1 0 0 0 0
                            0 1 0 0 0
                            0 0 1 0 0
                            0 0 0 0.35 0
                          "
                        />
                        <feGaussianBlur stdDeviation="0.5" />
                      </filter>
                    </defs>

                    {/* 虹色文字本体 */}
                    <g mask="url(#wipe-mask)">
                      <text
                        x="0"
                        y="70"
                        fontFamily="Lilita One, system-ui"
                        fontSize="72"
                        fill="url(#aura-rainbow)"
                        style={{
                          paintOrder: "stroke",
                        }}
                      >
                        AURA
                      </text>

                      {/* 拭き跡の微ノイズ（ほんの少し） */}
                      <rect
                        x="0"
                        y="0"
                        width="220"
                        height="90"
                        filter="url(#wipe-grain)"
                        opacity="0.25"
                      />
                    </g>
                  </svg>
                </div>
              </div>
            </div>

            {/* サブ：操作ヒント（邪魔なら消してよい） */}
            {allowSkip && (
              <div className="pointer-events-none absolute -bottom-10 left-1/2 w-[320px] -translate-x-1/2 text-center text-[11px] text-slate-300/70">
                クリックまたは Esc でスキップ
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * けむり：軽量に“それっぽく”
 * - 擬似ノイズ + blur + opacityアニメ
 * - パフォーマンス優先で canvas は使わない
 */
function SmokeLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 大きい霞 */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        initial={{ opacity: 0, scale: 0.98, filter: "blur(28px)" as any }}
        animate={{ opacity: 0.42, scale: 1.02, filter: "blur(34px)" as any }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background:
            "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0) 70%)",
        }}
      />

      {/* シアンの微発光 */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        initial={{ opacity: 0, scale: 0.98, filter: "blur(36px)" as any }}
        animate={{ opacity: 0.22, scale: 1.03, filter: "blur(44px)" as any }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        style={{
          background: `radial-gradient(circle at 55% 50%, rgba(0,161,233,0.24) 0%, rgba(0,161,233,0.10) 30%, rgba(0,161,233,0) 70%)`,
        }}
      />

      {/* ノイズフィルム（CSSのみ） */}
      <div
        className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E\")",
        }}
      />

      {/* ゆっくり流れる霞 */}
      <motion.div
        className="absolute -left-1/4 top-1/3 h-[240px] w-[120%] rounded-[999px]"
        initial={{ opacity: 0, x: -20, filter: "blur(34px)" as any }}
        animate={{ opacity: 0.22, x: 20, filter: "blur(40px)" as any }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.16) 40%, rgba(255,255,255,0) 85%)",
        }}
      />
    </div>
  );
}
