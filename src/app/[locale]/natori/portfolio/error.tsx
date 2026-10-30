"use client";
// app/natori/portfolio/error.tsx
// /natori/portfolio（と配下の contact・edit）を表示できなかったときの画面。全ページ共通のエラー画面ではなく、
// ナトリのページの色で「もう一度読み込む」と問い合わせ先を出す。
import { useEffect } from "react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";

export default function PortfolioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[natori-portfolio] page error", error);
  }, [error]);

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ backgroundColor: c.page, color: c.text }}
    >
      <div
        className="w-full max-w-md rounded-3xl border p-6 text-center"
        style={{ backgroundColor: c.surface, borderColor: c.borderSubtle }}
      >
        <h1 className="text-xl font-bold">ページを表示できませんでした</h1>
        <p className="mt-3 text-base leading-relaxed" style={{ color: c.textSoft }}>
          通信の具合で読み込めなかったようです。少し時間をおいて、もう一度お試しください。
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 min-h-11 w-full rounded-full px-4 py-3 text-base font-bold text-white transition-opacity duration-200 hover:opacity-90"
          style={{ backgroundColor: c.actionTextSmall }}
        >
          もう一度読み込む
        </button>
        <p className="mt-4 text-sm" style={{ color: c.textSoft }}>
          続くときは{" "}
          <a href="mailto:info@me-ish.art" className="underline" style={{ color: c.actionTextSmall }}>
            info@me-ish.art
          </a>{" "}
          までご連絡ください。
        </p>
      </div>
    </main>
  );
}
