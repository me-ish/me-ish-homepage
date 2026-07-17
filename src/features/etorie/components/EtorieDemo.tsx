"use client";

// features/etorie/components/EtorieDemo.tsx
// /etorie/demo 本体。架空クリエイター「ユキノ」の一日を6シーンで追う
// ガイド付きデモ。実DB・実API・実メールには一切触れない（すべてローカル状態）。
// 画面は実際の管理画面（natori スイート）と同じ見た目・同じ部品で組んであり、
// ATELIER シーンは実コンポーネント（ProjectCard）そのもの。メール文面も
// 本番と同じ draft builder で生成している。
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import ProjectCard from "@/features/natori/components/dashboard/ProjectCard";
import { natoriProjectStatusMeta } from "@/features/natori/constants/mockProjects";
import type { NatoriProject } from "@/features/natori/types/projects";
import { cn } from "@/lib/utils";
import {
  demoClient,
  demoCreator,
  demoEstimate,
  demoEstimateMail,
  demoInquiries,
  demoPaidMail,
  demoResults,
  demoScenes,
  makeDemoProject,
} from "@/features/etorie/lib/demoData";
import EtorieStyles from "./EtorieStyles";

const yen = new Intl.NumberFormat("ja-JP");

export default function EtorieDemo() {
  const [stepIndex, setStepIndex] = useState(0);
  // 日付依存のデータは初回マウント時に固定（いつ開いても残日数が自然になる）
  const [today] = useState(() => new Date());
  const initialProject = useMemo(() => makeDemoProject(today), [today]);
  const [project, setProject] = useState<NatoriProject>(initialProject);

  const scene = demoScenes[stepIndex];
  const isLast = stepIndex === demoScenes.length - 1;

  const handleToggleTask = (_projectId: string, taskId: string) => {
    setProject((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task
      ),
    }));
  };

  return (
    <div className="etorie-page">
      <EtorieStyles />
      <div className="et-wrap et-demo-main">
        <header className="et-header" style={{ padding: 0 }}>
          <Link
            href="/etorie"
            className="et-logotype"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span className="et-latin">
              <span className="et-e">é</span>trier
            </span>
            <span className="et-kana">エトリエ</span>
          </Link>
          <div className="et-byline">
            DÉMO — 架空のクリエイター「{demoCreator.name}」（{demoCreator.role}）の一日
          </div>
        </header>

        <nav className="et-stepper" aria-label="デモのシーン">
          {demoScenes.map((s, index) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStepIndex(index)}
              aria-current={index === stepIndex ? "step" : undefined}
            >
              {index + 1}. {s.title}
            </button>
          ))}
        </nav>

        <div className="et-scene">
          <span className="et-sec-eyebrow">{scene.eyebrow}</span>
          <h2>{scene.title}</h2>
          <p className="et-scene-pain">{scene.pain}</p>
          <p className="et-scene-change">{scene.change}</p>

          <div className="et-scene-visual">
            {scene.id === "reception" ? <SceneReception /> : null}
            {scene.id === "devis" ? <SceneDevis /> : null}
            {scene.id === "accord" ? <SceneAccord /> : null}
            {scene.id === "paiement" ? <ScenePaiement /> : null}
            {scene.id === "atelier" ? (
              <div className="et-embed">
                <ProjectCard project={project} today={today} onToggleTask={handleToggleTask} />
                <p className="et-embed-caption">
                  ↑ 実際の案件カードです。タスクにチェックを入れてみてください。
                  「依頼内容メモ」を開くと、フォームの内容と対応履歴が全部残っています。
                </p>
              </div>
            ) : null}
            {scene.id === "registre" ? <SceneRegistre /> : null}
          </div>

          <div className="et-demo-nav">
            {stepIndex > 0 ? (
              <button
                type="button"
                className="et-btn et-btn-ghost"
                onClick={() => setStepIndex(stepIndex - 1)}
              >
                ← 前へ
              </button>
            ) : (
              <Link href="/etorie" className="et-btn et-btn-ghost">
                ← 紹介ページへ
              </Link>
            )}
            {isLast ? (
              <Link href="/etorie/features" className="et-btn">
                機能一覧を見る
              </Link>
            ) : (
              <button
                type="button"
                className="et-btn"
                onClick={() => setStepIndex(stepIndex + 1)}
              >
                次のシーンへ →
              </button>
            )}
            <span className="et-count">
              {stepIndex + 1} / {demoScenes.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 実画面ルックの共通枠 ---------- */

/** 管理画面の見た目を再現する枠（パンくず + ピンク基調の背景） */
function AdminFrame({
  crumb,
  title,
  children,
  caption,
}: {
  crumb: string;
  title: string;
  children: ReactNode;
  caption?: string;
}) {
  return (
    <div className="et-embed">
      <div className="overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-pink-100 bg-white/70 px-4 py-2.5">
          <span className="text-xs font-bold text-pink-600">Dashboard</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">
            {crumb}
          </span>
          <span className="text-sm font-bold text-gray-900">{title}</span>
        </div>
        <div className="bg-gradient-to-b from-pink-50/70 to-white p-3 sm:p-4">{children}</div>
      </div>
      {caption ? <p className="et-embed-caption">{caption}</p> : null}
    </div>
  );
}

/** メール画面の再現（文面は本番と同じ builder の出力） */
function MailCard({
  to,
  subject,
  body,
  caption,
}: {
  to: string;
  subject: string;
  body: string;
  caption: string;
}) {
  return (
    <div className="et-embed">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="space-y-0.5 border-b border-gray-200 px-4 py-2.5 text-xs text-gray-600">
          <p>
            宛先: <b className="text-gray-900">{to}</b>
          </p>
          <p>
            件名: <b className="text-gray-900">{subject}</b>
          </p>
        </div>
        <pre className="m-0 whitespace-pre-wrap break-words px-4 py-3 font-[inherit] text-[13px] leading-6 text-gray-900">
          {body}
        </pre>
      </div>
      <p className="et-embed-caption">{caption}</p>
    </div>
  );
}

/* ---------- 各シーン ---------- */

function SceneReception() {
  const tabs = [
    { label: "すべて", count: demoInquiries.length, active: true },
    { label: "依頼受付", count: 1, active: false },
    { label: "見積もり中", count: 1, active: false },
    { label: "提示済み", count: 1, active: false },
    { label: "入金待ち", count: 1, active: false },
  ];
  return (
    <AdminFrame
      crumb="INQUIRIES"
      title="問い合わせ管理"
      caption="実際の問い合わせ管理画面と同じ表示です。放置が続くと経過日数の色が変わります。"
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <span
            key={tab.label}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-bold",
              tab.active
                ? "border-pink-500 bg-pink-500 text-white"
                : "border-pink-200 bg-white text-gray-600"
            )}
          >
            {tab.label} <span className={tab.active ? "" : "text-gray-400"}>{tab.count}</span>
          </span>
        ))}
      </div>
      <ul className="space-y-2">
        {demoInquiries.map((inquiry) => {
          const meta = natoriProjectStatusMeta[inquiry.status];
          return (
            <li
              key={inquiry.name}
              className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-pink-100 bg-white p-3 shadow-sm"
            >
              <span className="min-w-0 text-sm font-bold text-gray-900">{inquiry.name} 様</span>
              <span className="text-xs text-gray-600">{inquiry.kind}</span>
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
                    meta.chipClassName
                  )}
                >
                  {meta.label}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    inquiry.daysTone === "alert"
                      ? "bg-red-500 text-white"
                      : inquiry.daysTone === "warn"
                        ? "border border-amber-300 bg-amber-50 text-amber-800"
                        : "border border-gray-200 bg-gray-50 text-gray-600"
                  )}
                >
                  {inquiry.daysLabel}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-gray-500">
        「{demoClient.name} 様」に受付確認メールを自動送信しました
      </p>
    </AdminFrame>
  );
}

function SceneDevis() {
  return (
    <div className="space-y-4">
      <AdminFrame
        crumb="ESTIMATE"
        title="見積もりツール"
        caption="依頼文を貼り付けると、料金表から概算と内訳が自動計算されます。"
      >
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">概算合計</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
            <p className="text-3xl font-black text-emerald-900 sm:text-4xl">
              ¥{yen.format(demoEstimate.total)}
            </p>
            <span className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-bold text-emerald-800 shadow-sm">
              {demoEstimate.categoryLabel}
            </span>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-emerald-900/90">
            {demoEstimate.rows.map((row) => (
              <li key={row.label} className="flex justify-between gap-4">
                <span>{row.label}</span>
                <span className="font-bold">¥{yen.format(row.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </AdminFrame>
      <MailCard
        to={demoClient.email}
        subject={demoEstimateMail.subject}
        body={demoEstimateMail.body}
        caption="見積もりメールの下書きも自動で完成。本番とまったく同じ文面です（送信前に編集できます）。"
      />
    </div>
  );
}

function SceneAccord() {
  return (
    <div className="et-embed" style={{ background: "#F5F2FA" }}>
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-[0_10px_22px_rgba(45,42,61,0.10)]">
        <p className="mb-4 text-sm text-[#5B5670]">{demoClient.name} 様</p>
        <div className="mb-6 rounded-xl border-2 border-[#EFE7F7] p-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[#5B5670]">ご依頼内容</dt>
              <dd className="text-right font-bold">全身立ち絵</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#5B5670]">お見積もり金額</dt>
              <dd className="text-lg font-black text-[#E84C86]">
                ¥{yen.format(demoEstimate.total)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="pointer-events-none rounded-full bg-[#FF6FA5] px-6 py-3 text-center font-bold text-white shadow-md">
          この内容でお願いする
        </div>
        <p className="mt-3 text-center text-xs text-[#5B5670]">
          ボタンを押すと承諾が確定します。内容のご相談はメールへの返信でどうぞ。
        </p>
      </div>
      <p className="et-embed-caption">
        依頼者にはこう見えています（実際の承諾ページと同じ画面）。承諾は金額・日時つきで案件に記録されます。
      </p>
    </div>
  );
}

function ScenePaiement() {
  return (
    <div className="space-y-4">
      <AdminFrame
        crumb="PROJECTS"
        title="案件カレンダー"
        caption="入金は Stripe の通知で自動確認。あなたが通帳を見に行く必要はありません。"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-pink-100 bg-white p-3 shadow-sm">
          <span className="text-sm font-bold text-gray-900">
            {demoClient.name} 様｜全身立ち絵
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
              ¥{yen.format(demoEstimate.total)} 入金確認
            </span>
            <span className="rounded-full border border-pink-200 bg-pink-50 px-2.5 py-0.5 text-[11px] font-bold text-pink-700">
              ステータスを「ラフ」に自動で進めました
            </span>
          </span>
        </div>
      </AdminFrame>
      <MailCard
        to={demoClient.email}
        subject={demoPaidMail.subject}
        body={demoPaidMail.body}
        caption="依頼者への入金確認メールも自動送信。「ちゃんと届いてるかな」の不安に先回りします。"
      />
    </div>
  );
}

function SceneRegistre() {
  const max = Math.max(...demoResults.monthly.map((m) => m.amount));
  const stats = [
    { label: "実績件数（全期間）", value: `${demoResults.count}件` },
    { label: "総売上", value: `¥${yen.format(demoResults.total)}` },
    { label: "平均単価", value: `¥${yen.format(demoResults.avg)}` },
    { label: "月平均売上", value: `¥${yen.format(demoResults.monthlyAvg)}` },
  ];
  return (
    <AdminFrame
      crumb="RESULTS"
      title="これまでの実績"
      caption="実際の売上・実績画面と同じ構成です。納品した案件が自動でここに積み上がります。"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-pink-100 bg-white p-3 shadow-sm">
            <p className="text-[11px] font-bold text-pink-600">{stat.label}</p>
            <p className="mt-0.5 text-xl font-black text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-pink-100 bg-white p-3 shadow-sm sm:p-4">
        <p className="mb-2 text-sm font-bold text-gray-900">月別の実績</p>
        <div className="space-y-2.5">
          {demoResults.monthly.map((month) => (
            <div key={month.label}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-bold text-gray-900">
                  {month.label} <span className="font-normal text-pink-600">{month.count}件</span>
                </span>
                <span className="font-bold text-gray-900">¥{yen.format(month.amount)}</span>
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-pink-100">
                <div
                  className="h-full rounded-full bg-pink-500"
                  style={{ width: `${Math.round((month.amount / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminFrame>
  );
}
