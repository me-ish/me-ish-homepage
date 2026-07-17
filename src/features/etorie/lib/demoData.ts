// features/etorie/lib/demoData.ts
// /etorie/demo で使う架空クリエイター「ユキノ」のデモデータ。
// 実DB・実APIには一切依存しない純データ/純関数のみ（デモは read-only）。
// 案件データは natori の実コンポーネント（ProjectCard 等）にそのまま渡せる形で作る。
import type { NatoriProject } from "@/features/natori/types/projects";

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
    title: "全身立ち絵",
    clientName: `${demoClient.name}`,
    clientEmail: demoClient.email,
    amount: 24000,
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

/** 受信箱シーン: 問い合わせ一覧の行 */
export const demoInquiries = [
  {
    name: `${demoClient.name} 様`,
    kind: demoClient.request,
    chip: "未対応・受付から今日",
    tone: "alert" as const,
  },
  { name: "Kanata 様", kind: "SNSアイコン", chip: "見積もり送付済み", tone: "warn" as const },
  { name: "ちくわ工房 様", kind: "一枚絵・商用", chip: "入金済み・制作中", tone: "ok" as const },
  { name: "mio 様", kind: "TRPG立ち絵", chip: "納品完了", tone: "ok" as const },
];

/** 見積もりシーン: 自動生成される内訳 */
export const demoEstimate = {
  total: 24000,
  rows: [
    { label: "全身イラスト", amount: 15000 },
    { label: "しっかり背景", amount: 5000 },
    { label: "商用利用", amount: 4000 },
  ],
  mailExcerpt: [
    "ゆきうさぎ 様",
    "",
    "お問い合わせありがとうございます。ユキノです。",
    "いただいた内容でのお見積もりをご案内します。",
    "",
    "・全身イラスト: ¥15,000",
    "・しっかり背景: ¥5,000",
    "・商用利用: ¥4,000",
    "──────────────",
    "合計: ¥24,000（税込）",
    "",
    "ご依頼いただける場合は、下のボタンからご承諾ください。",
    "{承諾リンク}",
  ].join("\n"),
};

/** 実績シーン: 集計タイル */
export const demoResults = {
  monthTotal: 86000,
  monthCount: 5,
  avg: 17200,
  monthly: [
    { label: "3ヶ月前", amount: 42000 },
    { label: "2ヶ月前", amount: 61000 },
    { label: "先月", amount: 78000 },
    { label: "今月", amount: 86000 },
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
    change: "エトリエでは、依頼はフォームからひとつの受信箱に届き、放置日数つきで並びます。依頼者には受付確認メールが自動で返ります。",
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
    change: "依頼者はメールのボタンを押すだけ。承諾は金額と日時つきで記録され、あとから確認できます。",
  },
  {
    id: "paiement",
    eyebrow: "PAIEMENT",
    title: "入金を確認する",
    pain: "これまで — 通帳や決済画面を見に行って、入金を確認してから「着手します」を手で送る。",
    change: "カード決済リンクの入金は自動で確認。案件は自動で「制作開始」に進み、依頼者にも確認メールが届きます。",
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
    change: "納品まで進んだ案件は、月別売上と作品つきの実績一覧に自動で積み上がります。確定申告も営業もここを見るだけ。",
  },
];
