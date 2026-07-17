"use client";

// features/etorie/components/EtorieDemo.tsx
// /etorie/demo 本体。架空クリエイター「ユキノ」の一日を6シーンで追う
// ガイド付きデモ。実DB・実API・実メールには一切触れない（すべてローカル状態）。
// ATELIER シーンだけは natori の実コンポーネント（ProjectCard）をそのまま
// 埋め込んでおり、タスクのチェックも実際に触れる。
import { useMemo, useState } from "react";
import Link from "next/link";
import ProjectCard from "@/features/natori/components/dashboard/ProjectCard";
import type { NatoriProject } from "@/features/natori/types/projects";
import {
  demoClient,
  demoCreator,
  demoEstimate,
  demoInquiries,
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
          <Link href="/etorie" className="et-logotype" style={{ textDecoration: "none", color: "inherit" }}>
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
                  ↑ これは実際の案件カードです。タスクにチェックを入れてみてください。
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
              <a
                href={
                  "mailto:info@me-ish.art?subject=" +
                  encodeURIComponent("【エトリエ】事前登録")
                }
                className="et-btn"
              >
                事前登録する（無料）
              </a>
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

/* ---------- 各シーンのビジュアル ---------- */

function SceneReception() {
  return (
    <div className="et-mock et-mock-flat">
      <div className="et-mock-bar">
        <span className="et-t">問い合わせ</span>
        <span className="et-badge">未対応 1件</span>
      </div>
      {demoInquiries.map((inquiry) => (
        <div className="et-row" key={inquiry.name}>
          <span className="et-name">{inquiry.name}</span>
          <span className="et-sub">{inquiry.kind}</span>
          <span className={`et-chip ${inquiry.tone}`}>{inquiry.chip}</span>
        </div>
      ))}
      <div className="et-mock-foot">
        「{demoClient.name} 様」に受付確認メールを自動送信しました
      </div>
    </div>
  );
}

function SceneDevis() {
  return (
    <div>
      <div className="et-tiles">
        <div className="et-tile">
          <span className="et-k">概算合計</span>
          <span className="et-v">¥{yen.format(demoEstimate.total)}</span>
        </div>
        {demoEstimate.rows.map((row) => (
          <div className="et-tile" key={row.label}>
            <span className="et-k">{row.label}</span>
            <span className="et-v">¥{yen.format(row.amount)}</span>
          </div>
        ))}
      </div>
      <div className="et-mail">
        <div className="et-mail-head">
          宛先: <b>{demoClient.email}</b> ｜ 件名: <b>お見積もりのご案内（{demoCreator.brand}）</b>
          — 下書きが自動で完成
        </div>
        <pre className="et-mail-body">{demoEstimate.mailExcerpt}</pre>
      </div>
    </div>
  );
}

function SceneAccord() {
  return (
    <div className="et-mail" style={{ maxWidth: 480 }}>
      <div className="et-mail-head">依頼者にはこう見えています（承諾ページ）</div>
      <div style={{ padding: "22px 22px 18px", textAlign: "center" }}>
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--et-mist)" }}>お見積もり金額</p>
        <p className="et-serif" style={{ margin: "0 0 14px", fontSize: 30 }}>
          ¥{yen.format(demoEstimate.total)}
        </p>
        <span className="et-accept-btn">この内容で依頼する</span>
        <p className="et-note" style={{ marginTop: 12 }}>
          ボタンひとつで承諾完了。金額・日時つきで案件に記録され、
          「言った言わない」がなくなります。
        </p>
      </div>
    </div>
  );
}

function ScenePaiement() {
  return (
    <div className="et-mock et-mock-flat" style={{ maxWidth: 560 }}>
      <div className="et-mock-bar">
        <span className="et-t">入金の自動確認</span>
        <span className="et-chip ok">入金済み</span>
      </div>
      <div className="et-row">
        <span className="et-name">{demoClient.name} 様｜全身立ち絵</span>
        <span className="et-chip ok">¥{yen.format(demoEstimate.total)} 入金確認</span>
      </div>
      <div className="et-row">
        <span className="et-sub" style={{ whiteSpace: "normal" }}>
          カード決済リンクの入金を確認 → 案件は自動で「制作開始」へ。依頼者には
          入金確認メールが自動で届き、あなたは何も送らなくていい。
        </span>
      </div>
      <div className="et-mock-foot">入金前の案件は「手を動かさない」列に分けて表示されます</div>
    </div>
  );
}

function SceneRegistre() {
  const max = Math.max(...demoResults.monthly.map((m) => m.amount));
  return (
    <div>
      <div className="et-tiles">
        <div className="et-tile">
          <span className="et-k">今月の売上</span>
          <span className="et-v">¥{yen.format(demoResults.monthTotal)}</span>
        </div>
        <div className="et-tile">
          <span className="et-k">納品件数</span>
          <span className="et-v">{demoResults.monthCount}件</span>
        </div>
        <div className="et-tile">
          <span className="et-k">平均単価</span>
          <span className="et-v">¥{yen.format(demoResults.avg)}</span>
        </div>
      </div>
      <div className="et-bars">
        {demoResults.monthly.map((month) => (
          <div className="et-bar-row" key={month.label}>
            <span>{month.label}</span>
            <div className="et-bar-track">
              <div
                className="et-bar-fill"
                style={{ width: `${Math.round((month.amount / max) * 100)}%` }}
              />
            </div>
            <span className="et-bar-amount">¥{yen.format(month.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
