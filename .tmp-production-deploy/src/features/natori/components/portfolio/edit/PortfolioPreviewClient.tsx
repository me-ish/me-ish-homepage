"use client";

// features/natori/components/portfolio/edit/PortfolioPreviewClient.tsx
// 編集画面の「プレビュー」ボタンから開く、未保存内容のプレビュー表示。
// 内容は localStorage 経由で受け取り、公開ページと同じ PortfolioLanding で描画する。
// 公開データには一切触れないので、何度開いても安全。
import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import {
  PORTFOLIO_PREVIEW_STORAGE_KEY,
  parsePortfolioContent,
} from "@/features/natori/lib/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import PortfolioLanding from "../PortfolioLanding";

type PreviewState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; content: PortfolioContent };

export default function PortfolioPreviewClient() {
  const [state, setState] = useState<PreviewState>({ kind: "loading" });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PORTFOLIO_PREVIEW_STORAGE_KEY);
      const content = raw ? parsePortfolioContent(JSON.parse(raw)) : null;
      setState(content ? { kind: "ready", content } : { kind: "missing" });
    } catch (err) {
      console.error("[portfolio-preview] load failed", err);
      setState({ kind: "missing" });
    }
  }, []);

  if (state.kind === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-pink-50/50">
        <p className="text-sm font-bold text-gray-600">プレビューを読み込み中…</p>
      </main>
    );
  }

  if (state.kind === "missing") {
    return (
      <main className="grid min-h-screen place-items-center bg-pink-50/50 px-4">
        <div className="rounded-2xl border border-pink-100 bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-sm font-bold text-gray-900">プレビューする内容が見つかりません</p>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            編集画面の「プレビュー」ボタンから開き直してください。
          </p>
          <Link
            href="/natori/portfolio/edit"
            className="mt-3 inline-flex h-9 items-center rounded-full bg-pink-500 px-4 text-xs font-bold text-white hover:bg-pink-600"
          >
            編集画面へ戻る
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <PortfolioLanding content={state.content} />
      {/* プレビューであることを常時示すバー（公開ページの sticky ヘッダーと被らないよう下部固定） */}
      <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-amber-300 bg-amber-100/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs font-bold text-amber-900">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            プレビュー表示（未保存の内容）
          </span>
          <span className="font-medium">
            公開ページには反映されていません。編集画面で「保存する」を押すと公開されます。
          </span>
          <button
            type="button"
            onClick={() => window.close()}
            className="ml-auto rounded-full border border-amber-400 bg-white px-3 py-1 text-[11px] hover:bg-amber-50"
          >
            このタブを閉じる
          </button>
        </div>
      </div>
    </>
  );
}
