"use client";

// features/natori/components/portfolio/PortfolioCommissionForm.tsx
// ご依頼フォーム。送信すると /api/natori/portfolio/contact 経由でナトリ宛に
// メールが飛び、案件（依頼受付）として自動起票される。
// 料金カードの「このプランで相談」からの遷移でプランが自動選択される。
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  PLAN_SELECT_EVENT,
  isPortfolioTsunaguLink,
  planChoiceLabel,
  portfolioBudgetOptions,
  portfolioColors as c,
  portfolioDeadlineOptions,
  type PortfolioPlanSelectDetail,
} from "@/features/natori/constants/portfolioContent";
import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import PortfolioStructuredCommissionForm from "./PortfolioStructuredCommissionForm";

type Status = "idle" | "sending" | "success" | "error";

const inputClass = "pf-cute-focus w-full rounded-lg border-2 px-3 py-2";
const labelClass = "mb-1.5 block text-sm font-bold";

const PLAN_UNDECIDED = "未定・相談して決めたい";
const REQUEST_TYPE_OTHER = "その他";
const MAX_REF_IMAGES = 5;
const REF_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // サーバー側 IMAGE_MAX_BYTES と揃える

/** 選択済みのキャラクター資料。previewUrl は URL.createObjectURL で作る */
type RefImageEntry = { file: File; previewUrl: string };

/**
 * ご依頼の詳細のテンプレート。1から書かずに、各見出しの下へ追記して
 * もらう形式。不要な項目は消してもらってOK。
 */
const DETAILS_TEMPLATE = [
  "【キャラクターの特徴】",
  "（髪型・髪色・目の色・服装・体型など）",
  "",
  "【希望する表情・雰囲気】",
  "（例: にっこり笑顔、きゅんとする感じ）",
  "",
  "【構図のイメージ】",
  "（例: 正面バストアップ、少し見上げる角度）",
  "",
  "【使用目的】",
  "（例: Xのアイコン、配信のサムネイル）",
  "",
  "【色のイメージ】",
  "（例: 淡いピンク系でふんわり）",
].join("\n");

export default function PortfolioCommissionForm({
  content,
  demoMode,
  structuredIntake,
}: {
  content: PortfolioContent;
  /** エトリエのデモ環境用。送信を実行せず成功をシミュレートする */
  demoMode?: boolean;
  /**
   * P1-06 の構造化受付（RequestData V1 + create v2 RPC）を使うか。
   * server 側の rollout guard から渡る。false（既定）では現行フォームのまま。
   */
  structuredIntake?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [autoReplied, setAutoReplied] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string>(PLAN_UNDECIDED);
  // キャラクター資料。選択時はローカル保持のみで、送信時に multipart で一括添付
  // する（送信前にサーバーへ置かない = 匿名アップロードの穴を作らない）
  const [refImages, setRefImages] = useState<RefImageEntry[]>([]);
  const [refError, setRefError] = useState<string | null>(null);
  const refFileInputRef = useRef<HTMLInputElement | null>(null);
  const commissionOpen = content.commissionOpen;
  // つなぐ経由の依頼案内。受付停止中は非表示
  const tsunaguLink = commissionOpen
    ? content.socialLinks.find(isPortfolioTsunaguLink)
    : undefined;

  const planChoices = [...content.plans.map(planChoiceLabel), PLAN_UNDECIDED];

  // 料金カードの「このプランで相談」からプランを受け取る
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PortfolioPlanSelectDetail>).detail;
      if (!detail || typeof detail.label !== "string") return;
      const matchingPlan =
        detail.id === null
          ? content.plans.find(
              (plan) => plan.id === null && planChoiceLabel(plan) === detail.label
            )
          : content.plans.find((plan) => plan.id === detail.id);
      if (matchingPlan) setSelectedPlan(planChoiceLabel(matchingPlan));
    };
    window.addEventListener(PLAN_SELECT_EVENT, handler);
    return () => window.removeEventListener(PLAN_SELECT_EVENT, handler);
  }, [content.plans]);

  // 選択された画像をローカルの添付リストへ足す（サーバー送信はしない）
  const handleRefFiles = (files: File[]) => {
    if (files.length === 0) return;
    const remaining = MAX_REF_IMAGES - refImages.length;
    if (remaining <= 0) {
      setRefError(`画像は最大${MAX_REF_IMAGES}枚までです。`);
      return;
    }
    const oversized = files.find((file) => file.size > REF_IMAGE_MAX_BYTES);
    if (oversized) {
      setRefError(`1枚10MBまで（png / jpg / webp / gif）です。`);
      return;
    }
    setRefError(null);
    const selected = files.slice(0, remaining).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setRefImages((current) => [...current, ...selected].slice(0, MAX_REF_IMAGES));
  };

  const removeRefImage = (index: number) => {
    setRefImages((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;
    if (demoMode) {
      // デモ: 実送信せず成功表示だけする（メールも飛ばない）
      setRefImages((current) => {
        current.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
        return [];
      });
      setStatus("success");
      return;
    }
    setStatus("sending");

    // フォーム項目 + 添付画像をまとめて multipart で送る。
    // Content-Type は指定しない（ブラウザが boundary 付きで設定する）
    const form = e.currentTarget;
    const data = new FormData(form);
    const requestType = String(data.get("requestType") ?? "");
    for (const entry of refImages) {
      data.append("refImages", entry.file);
    }

    try {
      const res = await fetch("/api/natori/portfolio/contact", {
        method: "POST",
        headers: { ...CSRF_HEADERS },
        body: data,
      });
      const response = (await res.json().catch(() => null)) as
        | { autoReplied?: boolean }
        | null;
      if (!res.ok) throw new Error(`request failed: ${res.status}`);
      setAutoReplied(response?.autoReplied === true);
      trackNatoriPageEvent("portfolio_form_submit", requestType);
      setRefImages((current) => {
        current.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
        return [];
      });
      setStatus("success");
    } catch (err) {
      console.error("[portfolio-form] submit failed", err);
      setStatus("error");
    }
  };

  return (
    <section id="form" className="py-16" style={{ background: c.page }}>
      <div className="mx-auto max-w-2xl px-5">
        <h2 className="mb-2 text-center text-2xl font-black md:text-3xl">ご依頼フォーム</h2>
        <p
          className={`${tsunaguLink ? "mb-2" : "mb-8"} text-center`}
          style={{ color: c.textSoft }}
        >
          {commissionOpen
            ? "現在コミッション受付中です。決まっていない項目は「未定」のままでOK、まずはお気軽にご相談ください。"
            : "現在コミッションは停止中です。再開まで今しばらくお待ちください。"}
        </p>
        {tsunaguLink ? (
          <p className="mb-8 text-center" style={{ color: c.textSoft }}>
            <a
              href={tsunaguLink.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackNatoriPageEvent("portfolio_sns_click", "つなぐ")}
              className="pf-cute-focus font-bold underline decoration-2 underline-offset-4 hover:opacity-70"
              style={{ color: c.accentText, textDecorationColor: c.accentSoft }}
            >
              つなぐ
            </a>
            からのご依頼も受け付けています
          </p>
        ) : null}

        {status === "success" ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: c.surface, boxShadow: "0 10px 22px rgba(36,36,36,0.08)" }}
          >
            <p className="mb-2 text-3xl" aria-hidden="true">
              🎉
            </p>
            <p className="mb-1 text-lg font-bold">送信ありがとうございます!</p>
            <p className="text-sm" style={{ color: c.textSoft }}>
              内容を確認のうえ、2〜3日以内にご連絡いたします。
            </p>
            <p className="mt-2 text-xs" style={{ color: c.textSoft }}>
              {autoReplied
                ? "ご入力のメールアドレス宛に受付確認メールをお送りしました。届かない場合は迷惑メールフォルダをご確認ください。"
                : "受付は完了しましたが、確認メールを送信できませんでした。2〜3日以内のご連絡をお待ちください。"}
            </p>
          </div>
        ) : structuredIntake ? (
          <PortfolioStructuredCommissionForm
            content={content}
            demoMode={demoMode}
            commissionOpen={commissionOpen}
            onSuccess={(outcome) => {
              setAutoReplied(outcome.autoReplied);
              setStatus("success");
            }}
          />
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl p-6 md:p-8"
            style={{ background: c.surface, boxShadow: "0 10px 22px rgba(36,36,36,0.08)" }}
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
                  お名前（活動名でOK）<span style={{ color: c.error }}>＊</span>
                </label>
                <input
                  id="pf-name"
                  name="name"
                  required
                  maxLength={100}
                  className={inputClass}
                  style={{ borderColor: c.borderStrong }}
                />
              </div>
              <div>
                <label htmlFor="pf-email" className={labelClass}>
                  メールアドレス<span style={{ color: c.error }}>＊</span>
                </label>
                <input
                  id="pf-email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  className={inputClass}
                  style={{ borderColor: c.borderStrong }}
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
                  style={{ borderColor: c.borderStrong }}
                >
                  {content.services.map((service) => (
                    <option key={service}>{service}</option>
                  ))}
                  <option>{REQUEST_TYPE_OTHER}</option>
                </select>
              </div>
              <div>
                <label htmlFor="pf-plan" className={labelClass}>
                  サイズ / プラン
                </label>
                <select
                  id="pf-plan"
                  name="plan"
                  value={selectedPlan}
                  onChange={(event) => setSelectedPlan(event.target.value)}
                  className={inputClass}
                  style={{ borderColor: c.borderStrong }}
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
                    key={option.id ?? `legacy-option-${index}`}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                    style={{ color: c.textSoft }}
                  >
                    <input
                      type="checkbox"
                      name="options"
                      value={`${option.name}（${option.price}）`}
                      data-option-id={option.id ?? undefined}
                      className="pf-cute-focus h-4 w-4 shrink-0"
                      style={{ accentColor: c.accent }}
                    />
                    <span>
                      {option.name}
                      <span className="ml-1 text-xs font-bold" style={{ color: c.accentText }}>
                        {option.price}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="pf-budget" className={labelClass}>
                  ご予算
                </label>
                <select
                  id="pf-budget"
                  name="budget"
                  className={inputClass}
                  style={{ borderColor: c.borderStrong }}
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
                  style={{ borderColor: c.borderStrong }}
                >
                  {portfolioDeadlineOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className={labelClass}>キャラクター資料（画像添付）</span>
              <p className="mb-2 text-xs" style={{ color: c.textSoft }}>
                キャラクターの設定画・立ち絵・過去のイラストなどを添付してください（最大
                {MAX_REF_IMAGES}枚・各10MBまで）。URLで共有したい資料は「ご依頼の詳細」に貼ってOKです。
              </p>
              {refImages.length > 0 ? (
                <ul className="mb-3 flex flex-wrap gap-3">
                  {refImages.map((entry, index) => (
                    <li key={entry.previewUrl} className="relative">
                      {/* ローカル選択ファイルの objectURL プレビューなので next/image は使わない */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.previewUrl}
                        alt={`添付画像 ${index + 1}`}
                        className="h-20 w-20 rounded-lg border-2 object-cover"
                        style={{ borderColor: c.borderStrong }}
                      />
                      <button
                        type="button"
                        onClick={() => removeRefImage(index)}
                        className="pf-cute-focus absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white shadow"
                        style={{ background: c.error, color: c.onError }}
                        aria-label={`添付画像 ${index + 1} を外す`}
                        title="この画像を外す"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {refImages.length < MAX_REF_IMAGES ? (
                <button
                  type="button"
                  onClick={() => refFileInputRef.current?.click()}
                  className="pf-cute-focus inline-flex items-center gap-1.5 rounded-full border-2 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
                  style={{ borderColor: c.accent, color: c.accentText }}
                >
                  ＋ 画像を追加
                </button>
              ) : null}
              {refError ? (
                <p className="mt-2 text-xs font-bold" style={{ color: c.error }} role="alert">
                  {refError}
                </p>
              ) : null}
              <input
                ref={refFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : [];
                  event.target.value = "";
                  handleRefFiles(files);
                }}
              />
            </div>

            <div>
              <label htmlFor="pf-details" className={labelClass}>
                ご依頼の詳細<span style={{ color: c.error }}>＊</span>
              </label>
              <p className="mb-2 text-xs" style={{ color: c.textSoft }}>
                テンプレートの各項目に追記してください。わかる範囲でOK、不要な項目は消してかまいません。
              </p>
              <textarea
                id="pf-details"
                name="details"
                rows={16}
                required
                maxLength={4000}
                defaultValue={DETAILS_TEMPLATE}
                className={inputClass}
                style={{ borderColor: c.borderStrong }}
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
                style={{ borderColor: c.borderStrong }}
              />
            </div>

            {status === "error" ? (
              <p
                className="rounded-xl border-2 px-3 py-2 text-sm font-bold"
                style={{ borderColor: c.error, color: c.error, background: c.errorSoft }}
                role="alert"
              >
                送信に失敗しました。時間をおいて再度お試しいただくか、SNSのDMからご連絡ください。
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!commissionOpen || status === "sending"}
              className="pf-cute-focus w-full rounded-full py-3 font-bold disabled:opacity-50"
              style={{ background: c.action, color: c.onAction }}
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
