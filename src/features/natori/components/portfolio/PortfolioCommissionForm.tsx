"use client";

// features/natori/components/portfolio/PortfolioCommissionForm.tsx
// ご依頼フォーム。送信すると /api/natori/portfolio/contact 経由でナトリ宛にメールが飛ぶ。
import { useState, type FormEvent } from "react";
import {
  portfolioBudgetOptions,
  portfolioColors as c,
  portfolioCommercialOptions,
  portfolioDeadlineOptions,
} from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import { fontEnStyle } from "./portfolioFonts";

type Status = "idle" | "sending" | "success" | "error";

const inputClass = "pf-cute-focus w-full rounded-lg border-2 px-3 py-2";
const labelClass = "mb-1.5 block text-sm font-bold";

export default function PortfolioCommissionForm({ content }: { content: PortfolioContent }) {
  const [status, setStatus] = useState<Status>("idle");
  const commissionOpen = content.commissionOpen;

  const planChoices = [
    ...content.plans.map((p) => `${p.name}（${p.price}）`),
    "未定・相談して決めたい",
  ];

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");

    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      requestType: String(data.get("requestType") ?? ""),
      plan: String(data.get("plan") ?? ""),
      options: data.getAll("options").map(String),
      commercial: String(data.get("commercial") ?? ""),
      budget: String(data.get("budget") ?? ""),
      deadline: String(data.get("deadline") ?? ""),
      refUrls: String(data.get("refUrls") ?? ""),
      details: String(data.get("details") ?? ""),
      message: String(data.get("message") ?? ""),
      website: String(data.get("website") ?? ""), // honeypot
    };

    try {
      const res = await fetch("/api/natori/portfolio/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`request failed: ${res.status}`);
      setStatus("success");
    } catch (err) {
      console.error("[portfolio-form] submit failed", err);
      setStatus("error");
    }
  };

  return (
    <section id="form" className="py-16" style={{ background: c.paper }}>
      <div className="mx-auto max-w-2xl px-5">
        <h2 className="mb-2 text-center text-2xl font-black md:text-3xl">ご依頼フォーム</h2>
        <p className="mb-8 text-center" style={{ color: c.inkSoft }}>
          {commissionOpen
            ? "現在コミッション受付中です。決まっていない項目は「未定」のままでOK、まずはお気軽にご相談ください。"
            : "現在コミッションは停止中です。再開まで今しばらくお待ちください。"}
        </p>

        {status === "success" ? (
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
            {/* honeypot: 人間には見えない。ボット対策 */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="pf-name" className={labelClass}>
                  お名前（活動名でOK）<span style={{ color: c.pinkDeep }}>＊</span>
                </label>
                <input
                  id="pf-name"
                  name="name"
                  required
                  maxLength={100}
                  className={inputClass}
                  style={{ borderColor: c.paperAlt }}
                />
              </div>
              <div>
                <label htmlFor="pf-email" className={labelClass}>
                  メールアドレス<span style={{ color: c.pinkDeep }}>＊</span>
                </label>
                <input
                  id="pf-email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  className={inputClass}
                  style={{ borderColor: c.paperAlt }}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="pf-type" className={labelClass}>
                  ご依頼の種類
                </label>
                <select
                  id="pf-type"
                  name="requestType"
                  className={inputClass}
                  style={{ borderColor: c.paperAlt }}
                >
                  {content.services.map((service) => (
                    <option key={service}>{service}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pf-plan" className={labelClass}>
                  サイズ / プラン
                </label>
                <select
                  id="pf-plan"
                  name="plan"
                  className={inputClass}
                  style={{ borderColor: c.paperAlt }}
                >
                  {planChoices.map((plan) => (
                    <option key={plan}>{plan}</option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset>
              <legend className={labelClass}>追加オプション（複数選択可）</legend>
              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {content.options.map((option, index) => (
                  <label
                    key={`${option.name}-${index}`}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                    style={{ color: c.inkSoft }}
                  >
                    <input
                      type="checkbox"
                      name="options"
                      value={`${option.name}（${option.price}）`}
                      className="pf-cute-focus h-4 w-4 shrink-0"
                      style={{ accentColor: c.pink }}
                    />
                    <span>
                      {option.name}
                      <span className="ml-1 text-xs font-bold" style={{ color: c.pinkDeep }}>
                        {option.price}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <label htmlFor="pf-commercial" className={labelClass}>
                  商用利用
                </label>
                <select
                  id="pf-commercial"
                  name="commercial"
                  className={inputClass}
                  style={{ borderColor: c.paperAlt }}
                >
                  {portfolioCommercialOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pf-budget" className={labelClass}>
                  ご予算
                </label>
                <select
                  id="pf-budget"
                  name="budget"
                  className={inputClass}
                  style={{ borderColor: c.paperAlt }}
                >
                  {portfolioBudgetOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pf-deadline" className={labelClass}>
                  希望納期
                </label>
                <select
                  id="pf-deadline"
                  name="deadline"
                  className={inputClass}
                  style={{ borderColor: c.paperAlt }}
                >
                  {portfolioDeadlineOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="pf-ref" className={labelClass}>
                キャラクター資料・参考URL
              </label>
              <textarea
                id="pf-ref"
                name="refUrls"
                rows={3}
                maxLength={2000}
                placeholder={"キャラクターの設定画・立ち絵・過去のイラストなどのURLを1行ずつ貼ってください\n例: https://...\n例: https://..."}
                className={inputClass}
                style={{ borderColor: c.paperAlt }}
              />
            </div>

            <div>
              <label htmlFor="pf-details" className={labelClass}>
                ご依頼の詳細<span style={{ color: c.pinkDeep }}>＊</span>
              </label>
              <textarea
                id="pf-details"
                name="details"
                rows={7}
                required
                maxLength={4000}
                placeholder={"わかる範囲でOKです。以下があると制作がスムーズです！\n・キャラクターの特徴（髪型・髪色・目の色・服装・体型など）\n・希望する表情や雰囲気（例: にっこり笑顔、きゅんとする感じ）\n・構図のイメージ（例: 正面バストアップ、少し見上げる角度）\n・使用目的（例: Xのアイコン、配信のサムネイル）\n・色のイメージ（例: 淡いピンク系でふんわり）"}
                className={inputClass}
                style={{ borderColor: c.paperAlt }}
              />
            </div>

            <div>
              <label htmlFor="pf-message" className={labelClass}>
                その他・ご質問
              </label>
              <textarea
                id="pf-message"
                name="message"
                rows={3}
                maxLength={2000}
                placeholder="納期のご相談・非公開希望・そのほか気になることがあればどうぞ"
                className={inputClass}
                style={{ borderColor: c.paperAlt }}
              />
            </div>

            {status === "error" ? (
              <p
                className="rounded-xl border-2 px-3 py-2 text-sm font-bold"
                style={{ borderColor: c.peach, color: c.pinkDeep, background: "#FFF5F0" }}
                role="alert"
              >
                送信に失敗しました。時間をおいて再度お試しいただくか、SNSのDMからご連絡ください。
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!commissionOpen || status === "sending"}
              className="pf-cute-focus w-full rounded-full py-3 font-bold text-white disabled:opacity-50"
              style={{ ...fontEnStyle, background: c.pink }}
            >
              {!commissionOpen
                ? "現在受付停止中です"
                : status === "sending"
                  ? "送信中…"
                  : "この内容で送信する"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
