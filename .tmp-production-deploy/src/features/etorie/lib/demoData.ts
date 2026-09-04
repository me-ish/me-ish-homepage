// features/etorie/lib/demoData.ts
// /etorie/demo で使う架空クリエイター「ユキノ」のデモデータ。
// 実DB・実APIには一切依存しない純データ/純関数のみ（デモは read-only）。
// メール文面は natori の実際の draft builder（純関数）を「ユキノ」名義で呼んで
// 生成するので、本番で送られる文面と完全に同一になる。
import {
  buildEstimateMailDraft,
  buildPaidConfirmationMail,
  injectAcceptLink,
} from "@/features/natori/lib/orderMail";
import type { NatoriProject, NatoriProjectStatus } from "@/features/natori/types/projects";

/** デモの主人公（架空のイラストレーター） */
export const demoCreator = {
  name: "ユキノ",
  brand: "Yukino* illust",
  role: "ちびキャラ・アニメ調イラスト",
} as const;

/** デモの依頼者（架空） */
export const demoClient = {
  name: "ゆきうさぎ",
  email: "yuki.usagi@example.com",
  request: "立ち絵・全身",
} as const;

const DEMO_TITLE = "全身立ち絵";
const DEMO_AMOUNT = 24000;

const DAY_MS = 86_400_000;

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysFrom(today: Date, days: number): string {
  return toISO(new Date(today.getTime() + days * DAY_MS));
}

/**
 * 制作シーンで使う進行中案件。納期などは「今日」から相対で組み立てるので、
 * いつ開いても自然な残日数になる。note は自動起票フォーマットで書いてあり、
 * ProjectCard の「依頼内容メモ」折りたたみがそのまま動く。
 */
export function makeDemoProject(today: Date): NatoriProject {
  const start = daysFrom(today, -6);
  const due = daysFrom(today, 15);
  const quoteDay = daysFrom(today, -5);
  const acceptDay = daysFrom(today, -4);
  const paidDay = daysFrom(today, -3);
  return {
    id: "etorie-demo-project",
    title: DEMO_TITLE,
    clientName: demoClient.name,
    clientEmail: demoClient.email,
    amount: DEMO_AMOUNT,
    startDate: start,
    dueDate: due,
    deliveryPlan: "normal",
    status: "lineart",
    nextAction: "線画を進める",
    type: "standing",
    priority: "high",
    paymentConfirmedAt: `${paidDay}T10:00:00+09:00`,
    note: [
      "【ご依頼フォームからの自動起票】",
      `メール: ${demoClient.email}`,
      `ご依頼の種類: ${demoClient.request}`,
      "サイズ / プラン: 全身イラスト",
      "追加オプション: しっかり背景 / 商用利用",
      "ご予算: 〜30,000円",
      "希望納期: 通常（約1ヶ月前後）",
      "--- ご依頼の詳細 ---",
      "配信の待機画面に使う全身立ち絵をお願いしたいです。",
      "衣装は添付の設定資料どおり、雰囲気は「元気で明るく」でお願いします。",
      `【見積もりメール送信 ${quoteDay}】宛先: ${demoClient.email} / 金額: ¥24,000`,
      `【見積もり承諾 ${acceptDay}】¥24,000（承諾ページより）`,
      `【入金確認（Stripe） ${paidDay}】¥24,000 / 自動でステータスを「ラフ」に進めました`,
    ].join("\n"),
    tasks: [
      { id: "rough", label: "ラフ作成", stage: "rough", done: true, estimatedHours: 3 },
      { id: "rough-submit", label: "ラフ提出", stage: "rough", done: true, estimatedHours: 1 },
      { id: "lineart", label: "線画", stage: "lineart", done: false, estimatedHours: 5 },
      { id: "color", label: "着彩", stage: "coloring", done: false, estimatedHours: 6 },
      { id: "review", label: "最終確認", stage: "finish", done: false, estimatedHours: 1 },
      { id: "delivery", label: "納品", stage: "delivery", done: false, estimatedHours: 1 },
    ],
  };
}

/** 受信箱シーン: 問い合わせ一覧の行（チップは natori の実ステータス色を使う） */
export const demoInquiries: Array<{
  name: string;
  kind: string;
  status: NatoriProjectStatus;
  daysLabel: string;
  daysTone: "ok" | "warn" | "alert";
}> = [
  {
    name: demoClient.name,
    kind: demoClient.request,
    status: "inquiry",
    daysLabel: "受付から今日",
    daysTone: "alert",
  },
  { name: "Kanata", kind: "SNSアイコン", status: "quoted", daysLabel: "経過 2日", daysTone: "ok" },
  {
    name: "ちくわ工房",
    kind: "一枚絵・商用",
    status: "awaiting_payment",
    daysLabel: "経過 1日",
    daysTone: "ok",
  },
  { name: "mio", kind: "TRPG立ち絵", status: "estimating", daysLabel: "経過 5日", daysTone: "warn" },
];

/** 見積もりシーン: ツールが自動生成する内訳 */
export const demoEstimate = {
  total: DEMO_AMOUNT,
  categoryLabel: "全身",
  rows: [
    { label: "全身イラスト", amount: 15000 },
    { label: "しっかり背景", amount: 5000 },
    { label: "商用利用", amount: 4000 },
  ],
};

/** 見積もりメール: 本番と同じ draft builder で生成（ユキノ名義） */
export const demoEstimateMail = (() => {
  const draft = buildEstimateMailDraft({
    clientName: demoClient.name,
    title: DEMO_TITLE,
    amount: DEMO_AMOUNT,
    breakdownLines: demoEstimate.rows.map(
      (row) => `${row.label}: ¥${row.amount.toLocaleString("ja-JP")}`
    ),
    artistName: demoCreator.name,
  });
  return {
    subject: draft.subject,
    body: injectAcceptLink(draft.body, "https://…/quote/a8f3…（依頼者専用の承諾ページ）"),
  };
})();

/** 入金確認メール: 本番と同じ builder で生成（入金 webhook が自動送信するもの） */
export const demoPaidMail = buildPaidConfirmationMail({
  clientName: demoClient.name,
  title: DEMO_TITLE,
  amount: DEMO_AMOUNT,
  artistName: demoCreator.name,
});

/** 実績シーン: 集計タイルと月別実績（実際の売上・実績ページと同じ構成） */
export const demoResults = {
  count: 9,
  total: 152000,
  avg: 16900,
  monthlyAvg: 50700,
  monthly: [
    { label: "今月", count: 2, amount: 38000 },
    { label: "先月", count: 4, amount: 61000 },
    { label: "2ヶ月前", count: 3, amount: 53000 },
  ],
};

export type DemoSceneId =
  | "reception"
  | "devis"
  | "accord"
  | "paiement"
  | "atelier"
  | "registre";

/** シーン構成: 仏語ラベルは LP の機能ラベルと揃える */
export const demoScenes: Array<{
  id: DemoSceneId;
  eyebrow: string;
  title: string;
  pain: string;
  change: string;
}> = [
  {
    id: "reception",
    eyebrow: "RÉCEPTION",
    title: "依頼が届く",
    pain: "これまで — DM・メール・リプライを行き来して、どれが未返信か思い出す作業から一日が始まる。",
    change: "依頼はフォームからひとつの受信箱に届き、状態と経過日数つきで並びます。依頼者には受付確認メールが自動で返ります。",
  },
  {
    id: "devis",
    eyebrow: "DEVIS",
    title: "見積もりを送る",
    pain: "これまで — 毎回ゼロから金額と文面を書き、送った金額をスプレッドシートに控える。",
    change: "依頼文を貼ると内訳つきの概算が出て、そのまま見積もりメールの下書きが完成。金額は案件に自動で記録されます。",
  },
  {
    id: "accord",
    eyebrow: "ACCORD",
    title: "依頼者が承諾する",
    pain: "これまで —「この内容で大丈夫です」の返信を待って、言った言わないの不安を抱えたまま進める。",
    change: "依頼者はメールのリンクを開いてボタンを押すだけ。承諾は金額と日時つきで案件に記録されます。",
  },
  {
    id: "paiement",
    eyebrow: "PAIEMENT",
    title: "入金を確認する",
    pain: "これまで — 通帳や決済画面を見に行って、入金を確認してから「着手します」を手で送る。",
    change: "カード決済の入金は自動で確認。案件は自動で制作開始に進み、依頼者にはこの確認メールが自動で届きます。",
  },
  {
    id: "atelier",
    eyebrow: "ATELIER",
    title: "制作に集中する",
    pain: "これまで — 進行中の案件・納期・次にやることが、頭の中とメモアプリに散らばっている。",
    change: "案件カードにタスクと納期ペース（1日あたりの必要時間）が並びます。チェックを入れて進めるだけ。実際に触れます。",
  },
  {
    id: "registre",
    eyebrow: "REGISTRE",
    title: "実績が勝手にたまる",
    pain: "これまで — 月末に売上を手集計して、営業用の実績リストを別途作る。",
    change: "納品まで進んだ案件は、月別売上と実績一覧に自動で積み上がります。確定申告も営業もここを見るだけ。",
  },
];
