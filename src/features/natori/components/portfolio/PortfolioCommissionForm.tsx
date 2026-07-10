"use client";

// features/natori/components/portfolio/PortfolioCommissionForm.tsx
// 現時点では見た目のみのダミー実装。送信すると成功メッセージを表示するだけで、
// 実際の送信処理（メール送信・DB保存）は今後別途実装する。
import { useState, type FormEvent } from "react";
import {
  commissionOpen,
  portfolioBudgetOptions,
  portfolioColors as c,
  portfolioPlans,
} from "@/features/natori/constants/portfolioContent";
import { fontEnStyle } from "./portfolioFonts";

export default function PortfolioCommissionForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section id="form" className="py-16" style={{ background: c.paperAlt }}>
      <div className="mx-auto max-w-2xl px-5">
        <h2 className="mb-2 text-center text-2xl font-black md:text-3xl">ご依頼フォーム</h2>
        <p className="mb-8 text-center" style={{ color: c.inkSoft }}>
          {commissionOpen
            ? "現在コミッション受付中です。お気軽にご相談ください。"
            : "現在コミッションは停止中です。再開まで今しばらくお待ちください。"}
        </p>

        {submitted ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: c.card, boxShadow: "0 10px 22px rgba(45,42,61,0.10)" }}
          >
            <p className="mb-2 text-3xl" aria-hidden="true">
              🎉
            </p>
            <p className="mb-1 text-lg font-bold">送信ありがとうございます!</p>
            <p className="text-sm" style={{ color: c.inkSoft }}>
              内容を確認のうえ、2〜3日以内にご連絡いたします。
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl p-6 md:p-8"
            style={{ background: c.card, boxShadow: "0 10px 22px rgba(45,42,61,0.10)" }}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="pf-name" className="mb-1.5 block text-sm font-bold">
                  お名前
                </label>
                <input
                  id="pf-name"
                  required
                  className="pf-cute-focus w-full rounded-lg border-2 px-3 py-2"
                  style={{ borderColor: c.paperAlt }}
                />
              </div>
              <div>
                <label htmlFor="pf-email" className="mb-1.5 block text-sm font-bold">
                  メールアドレス
                </label>
                <input
                  id="pf-email"
                  type="email"
                  required
                  className="pf-cute-focus w-full rounded-lg border-2 px-3 py-2"
                  style={{ borderColor: c.paperAlt }}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="pf-type" className="mb-1.5 block text-sm font-bold">
                  ご依頼内容
                </label>
                <select
                  id="pf-type"
                  className="pf-cute-focus w-full rounded-lg border-2 px-3 py-2"
                  style={{ borderColor: c.paperAlt }}
                >
                  {portfolioPlans.map((p) => (
                    <option key={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pf-budget" className="mb-1.5 block text-sm font-bold">
                  ご予算
                </label>
                <select
                  id="pf-budget"
                  className="pf-cute-focus w-full rounded-lg border-2 px-3 py-2"
                  style={{ borderColor: c.paperAlt }}
                >
                  {portfolioBudgetOptions.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="pf-ref" className="mb-1.5 block text-sm font-bold">
                参考画像URL(あれば)
              </label>
              <input
                id="pf-ref"
                placeholder="https://..."
                className="pf-cute-focus w-full rounded-lg border-2 px-3 py-2"
                style={{ borderColor: c.paperAlt }}
              />
            </div>

            <div>
              <label htmlFor="pf-message" className="mb-1.5 block text-sm font-bold">
                メッセージ
              </label>
              <textarea
                id="pf-message"
                rows={4}
                required
                className="pf-cute-focus w-full rounded-lg border-2 px-3 py-2"
                style={{ borderColor: c.paperAlt }}
              />
            </div>

            <button
              type="submit"
              disabled={!commissionOpen}
              className="pf-cute-focus w-full rounded-full py-3 font-bold text-white disabled:opacity-50"
              style={{ ...fontEnStyle, background: c.pink }}
            >
              {commissionOpen ? "この内容で送信する" : "現在受付停止中です"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
