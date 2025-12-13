// src/components/aiPortfolio/AiDegreeSlider.tsx
"use client";

import { motion } from "framer-motion";
import React from "react";

type Props = {
  name: string;
  value: number;
  onChange: (val: number) => void;
};

export const AiDegreeSlider: React.FC<Props> = ({ name, value, onChange }) => {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="relative w-full py-3">
      {/* 背景トラック */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200">
        {/* アクティブバー */}
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          initial={{ width: 0 }}
          animate={{
            width: `${clamped}%`,
            background:
              clamped === 100
                ? "linear-gradient(90deg,#ff0000,#ff9900,#ffee00,#33ff00,#00ffee,#0066ff,#d400ff,#ff00aa)"
                : `linear-gradient(90deg,hsl(199,93%,54%),hsl(${
                    199 + (clamped * 0.6) / 1
                  },93%,54%))`,
          }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
        />

        {/* 100%時のキラキラ走査線 */}
        {clamped === 100 && (
          <motion.div
            className="pointer-events-none absolute inset-0 bg-white/30"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          />
        )}
      </div>

      {/* 実際に値を持つ range（透明） */}
      <input
        type="range"
        name={name}
        min={0}
        max={100}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="absolute inset-0 z-20 w-full cursor-pointer opacity-0"
      />

      {/* カスタムつまみ */}
      <div
        className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-slate-300 bg-white shadow-[0_0_12px_rgba(56,189,248,0.45)] transition-all duration-100"
        style={{
          left: `${clamped}%`,
          borderColor: clamped === 100 ? "#fbbf24" : "#e5e7eb",
        }}
      >
        {clamped === 100 && (
          <div className="absolute inset-0 animate-ping rounded-full bg-yellow-400/50" />
        )}
      </div>
    </div>
  );
};
