// features/etorie/lib/demoWorkspace.ts
// /etorie/demo/app（さわれるデモ環境）用のサンプルデータ一式。
// 架空クリエイター「ユキノ」のワークスペースを丸ごと再現する。
// 日付は「今日」からの相対で組み立てるので、いつ開いても自然な状態になる。
// 実DB・実APIには一切依存しない純データ/純関数のみ。
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import type { NatoriEvent } from "@/features/natori/data/supabaseEvents";
import type { NatoriLinksContent } from "@/features/natori/types/links";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import type {
  NatoriProject,
  NatoriProjectTask,
  NatoriTaskStage,
} from "@/features/natori/types/projects";
import { demoClient, demoCreator } from "./demoData";

const DAY_MS = 86_400_000;

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function day(today: Date, offset: number): string {
  return toISO(new Date(today.getTime() + offset * DAY_MS));
}

/** 標準6工程タスク。doneStages に含まれる工程まで完了扱いにする */
function makeTasks(doneStages: NatoriTaskStage[]): NatoriProjectTask[] {
  const done = new Set(doneStages);
  const defs: Array<[string, string, NatoriTaskStage, number]> = [
    ["rough", "ラフ作成", "rough", 3],
    ["rough-submit", "ラフ提出", "rough", 1],
    ["lineart", "線画", "lineart", 5],
    ["color", "着彩", "coloring", 6],
    ["review", "最終確認", "finish", 1],
    ["delivery", "納品", "delivery", 1],
  ];
  return defs.map(([id, label, stage, estimatedHours]) => ({
    id,
    label,
    stage,
    done: done.has(stage),
    estimatedHours,
  }));
}

/** フォーム自動起票メモ（問い合わせ詳細・依頼内容メモの表示が本物と同じになる） */
function inquiryNote(input: {
  email: string;
  kind: string;
  plan: string;
  options: string;
  budget: string;
  details: string[];
  logs?: string[];
}): string {
  return [
    "【ご依頼フォームからの自動起票】",
    `メール: ${input.email}`,
    `ご依頼の種類: ${input.kind}`,
    `サイズ / プラン: ${input.plan}`,
    `追加オプション: ${input.options}`,
    `ご予算: ${input.budget}`,
    "希望納期: 通常（約1ヶ月前後）",
    "--- ご依頼の詳細 ---",
    ...input.details,
    ...(input.logs ?? []),
  ].join("\n");
}

/**
 * ユキノのワークスペースの案件一式。
 * 問い合わせ（依頼受付〜入金待ち）・制作中・完了・見送りをひととおり含み、
 * 問い合わせ管理 / 案件カレンダー / 実績 のどの画面もサンプルが表示される。
 */
export function makeDemoWorkspaceProjects(today: Date): NatoriProject[] {
  return [
    // ---- 問い合わせ（prework） ----
    {
      id: "demo-inq-1",
      title: "全身立ち絵",
      clientName: demoClient.name,
      clientEmail: demoClient.email,
      amount: 0,
      startDate: day(today, 0),
      dueDate: day(today, 30),
      status: "inquiry",
      nextAction: "依頼内容の確認",
      type: "standing",
      tasks: makeTasks([]),
      note: inquiryNote({
        email: demoClient.email,
        kind: demoClient.request,
        plan: "全身イラスト",
        options: "しっかり背景 / 商用利用",
        budget: "20,000円以上",
        details: [
          "配信の待機画面に使う全身立ち絵をお願いしたいです。",
          "衣装は添付の設定資料どおり、雰囲気は「元気で明るく」でお願いします。",
        ],
      }),
    },
    {
      id: "demo-inq-2",
      title: "SNSアイコン",
      clientName: "Kanata",
      clientEmail: "kanata@example.com",
      amount: 4500,
      startDate: day(today, -2),
      dueDate: day(today, 28),
      status: "quoted",
      nextAction: "返信待ち",
      type: "icon",
      tasks: makeTasks([]),
      note: inquiryNote({
        email: "kanata@example.com",
        kind: "SNSアイコン",
        plan: "胸上",
        options: "表情差分",
        budget: "5,000円〜10,000円",
        details: ["Xで使うアイコンをお願いしたいです。にっこり笑顔でお願いします。"],
        logs: [
          `【見積もりメール送信 ${day(today, -1)}】宛先: kanata@example.com / 金額: ¥4,500`,
        ],
      }),
    },
    {
      id: "demo-inq-3",
      title: "一枚絵（商用）",
      clientName: "ちくわ工房",
      clientEmail: "chikuwa@example.com",
      amount: 18000,
      startDate: day(today, -3),
      dueDate: day(today, 25),
      status: "awaiting_payment",
      nextAction: "入金確認",
      type: "illustration",
      tasks: makeTasks([]),
      note: inquiryNote({
        email: "chikuwa@example.com",
        kind: "一枚絵",
        plan: "膝〜腰上",
        options: "しっかり背景 / 商用利用",
        budget: "10,000円〜20,000円",
        details: ["新商品の告知用イラストをお願いします。"],
        logs: [
          `【見積もりメール送信 ${day(today, -2)}】宛先: chikuwa@example.com / 金額: ¥18,000`,
          `【見積もり承諾 ${day(today, -1)}】¥18,000（承諾ページより）`,
          `【支払い依頼メール送信 ${day(today, -1)}】宛先: chikuwa@example.com / 金額: ¥18,000`,
        ],
      }),
    },
    {
      id: "demo-inq-4",
      title: "TRPG立ち絵",
      clientName: "mio",
      clientEmail: "mio@example.com",
      amount: 0,
      startDate: day(today, -6),
      dueDate: day(today, 24),
      status: "estimating",
      nextAction: "見積もり作成",
      type: "standing",
      tasks: makeTasks([]),
      note: inquiryNote({
        email: "mio@example.com",
        kind: "TRPG立ち絵",
        plan: "未定・相談して決めたい",
        options: "なし",
        budget: "未定・相談したい",
        details: ["セッション用の立ち絵をお願いしたいです。差分は相談させてください。"],
      }),
    },
    // ---- 制作中 ----
    {
      id: "demo-active-1",
      title: "配信用立ち絵",
      clientName: "ゆず",
      clientEmail: "yuzu@example.com",
      amount: 24000,
      startDate: day(today, -6),
      dueDate: day(today, 15),
      deliveryPlan: "normal",
      status: "lineart",
      nextAction: "線画を進める",
      type: "standing",
      priority: "high",
      paymentConfirmedAt: `${day(today, -3)}T10:00:00+09:00`,
      tasks: makeTasks(["rough"]),
      note: inquiryNote({
        email: "yuzu@example.com",
        kind: "配信用立ち絵",
        plan: "全身イラスト",
        options: "しっかり背景",
        budget: "20,000円以上",
        details: ["配信画面用の立ち絵をお願いします。"],
        logs: [
          `【見積もりメール送信 ${day(today, -5)}】宛先: yuzu@example.com / 金額: ¥24,000`,
          `【見積もり承諾 ${day(today, -4)}】¥24,000（承諾ページより）`,
          `【入金確認（Stripe） ${day(today, -3)}】¥24,000 / 自動でステータスを「ラフ」に進めました`,
        ],
      }),
    },
    {
      id: "demo-active-2",
      title: "記念日イラスト",
      clientName: "miu",
      amount: 14500,
      startDate: day(today, -10),
      dueDate: day(today, 6),
      deliveryPlan: "rush_14_days",
      status: "coloring",
      nextAction: "着彩を進める",
      type: "illustration",
      priority: "high",
      paymentConfirmedAt: `${day(today, -9)}T09:00:00+09:00`,
      tasks: makeTasks(["rough", "lineart"]),
      note: "記念日に間に合わせたいとのこと。お急ぎ納品（14日前後）。",
    },
    {
      id: "demo-active-3",
      title: "ファンアートアイコン",
      clientName: "ゆい",
      amount: 6000,
      startDate: day(today, -2),
      dueDate: day(today, 20),
      status: "rough",
      nextAction: "ラフを作成する",
      type: "icon",
      paymentConfirmedAt: `${day(today, -2)}T14:00:00+09:00`,
      tasks: makeTasks([]),
      note: "推しのアイコン。淡い色味の希望。",
    },
    // ---- 完了（実績に載る） ----
    // 実績集計は「completed かつ入金記録あり」が条件（lib/results.ts）なので、
    // 入金日時と完了日時を必ず付ける
    {
      id: "demo-done-1",
      title: "IRIAM用立ち絵",
      clientName: "橘",
      amount: 23000,
      startDate: day(today, -40),
      dueDate: day(today, -12),
      status: "completed",
      nextAction: "対応完了",
      type: "standing",
      paymentConfirmedAt: `${day(today, -39)}T10:00:00+09:00`,
      completedAt: `${day(today, -12)}T18:00:00+09:00`,
      tasks: makeTasks(["rough", "lineart", "coloring", "finish", "delivery"]),
      note: "最終データ送付済み。",
    },
    {
      id: "demo-done-2",
      title: "誕生日記念イラスト",
      clientName: "さくら",
      amount: 15000,
      startDate: day(today, -35),
      dueDate: day(today, -20),
      status: "completed",
      nextAction: "対応完了",
      type: "illustration",
      paymentConfirmedAt: `${day(today, -34)}T10:00:00+09:00`,
      completedAt: `${day(today, -20)}T18:00:00+09:00`,
      tasks: makeTasks(["rough", "lineart", "coloring", "finish", "delivery"]),
    },
    {
      id: "demo-done-3",
      title: "SDキャラセット",
      clientName: "あめ",
      amount: 9000,
      startDate: day(today, -60),
      dueDate: day(today, -38),
      status: "completed",
      nextAction: "対応完了",
      type: "sd",
      paymentConfirmedAt: `${day(today, -59)}T10:00:00+09:00`,
      completedAt: `${day(today, -38)}T18:00:00+09:00`,
      tasks: makeTasks(["rough", "lineart", "coloring", "finish", "delivery"]),
    },
    {
      id: "demo-done-4",
      title: "動画サムネイル",
      clientName: "tomo",
      amount: 12000,
      startDate: day(today, -70),
      dueDate: day(today, -45),
      status: "completed",
      nextAction: "対応完了",
      type: "illustration",
      paymentConfirmedAt: `${day(today, -69)}T10:00:00+09:00`,
      completedAt: `${day(today, -45)}T18:00:00+09:00`,
      tasks: makeTasks(["rough", "lineart", "coloring", "finish", "delivery"]),
    },
    {
      id: "demo-done-5",
      title: "配信サムネ用アイコン",
      clientName: "ことり",
      amount: 5500,
      startDate: day(today, -80),
      dueDate: day(today, -66),
      status: "completed",
      nextAction: "対応完了",
      type: "icon",
      paymentConfirmedAt: `${day(today, -79)}T10:00:00+09:00`,
      completedAt: `${day(today, -66)}T18:00:00+09:00`,
      tasks: makeTasks(["rough", "lineart", "coloring", "finish", "delivery"]),
    },
    // ---- 見送り ----
    {
      id: "demo-closed-1",
      title: "MVイラスト複数枚",
      clientName: "そら",
      amount: 0,
      startDate: day(today, -15),
      dueDate: day(today, -1),
      status: "closed",
      nextAction: "-",
      type: "illustration",
      tasks: makeTasks([]),
      note: `ご相談のみ。\n\n【見送り ${day(today, -12)}】スケジュールが合わず今回は見送り`,
    },
  ];
}

/** 個人予定のサンプル（カレンダーに出る） */
export function makeDemoEvents(today: Date): NatoriEvent[] {
  return [
    { id: "demo-event-1", title: "画材の買い出し", date: day(today, 2) },
    { id: "demo-event-2", title: "通院", date: day(today, 8), note: "午前は作業できない" },
  ];
}

/** ユキノ版ポートフォリオ掲載内容（作品画像はプレースホルダー表示） */
export const demoPortfolioContent: PortfolioContent = {
  ...defaultPortfolioContent,
  artistName: demoCreator.brand,
  roleEn: "Chibi & Anime Illustrator",
  profileName: demoCreator.name,
  profileRole: "Illustrator",
  heroTitleAccent: demoCreator.name,
  heroTitleTail: "のポートフォリオへようこそ",
  heroDescription:
    "ちびキャラ・アニメ調のやわらかいイラストを描いています。あたたかみのある線と、キャラクターの「かわいい瞬間」を大切に制作しています。",
  aboutParagraphs: [
    "ちびキャラ・アニメ調のやわらかいイラストを描いています。あたたかみのある線と、キャラクターの「かわいい瞬間」を大切に制作しています。",
    "アイコン・立ち絵・一枚絵のご依頼を中心にお受けしています。ご希望の雰囲気に丁寧に寄り添って、一枚一枚大切に制作いたします。",
  ],
  socialLinks: [
    { label: "X (Twitter)", href: "https://example.com/yukino" },
    { label: "pixiv", href: "https://example.com/yukino-pixiv" },
  ],
  copyright: `© 2026 ${demoCreator.brand}. All illustrations are sample placeholders.`,
};

/** ユキノ版リンク集のプロフィール（画像は使わずベタ塗り表示） */
export const demoLinksProfile = {
  name: demoCreator.name,
  role: "イラストレーター",
  avatarSrc: null,
  copyright: demoCreator.brand,
} as const;

/** ユキノ版リンク集（リンク先はすべてダミー） */
export const demoLinksContent: NatoriLinksContent = {
  links: [
    {
      id: "portfolio",
      label: "ポートフォリオ",
      sub: "ご依頼・コミッションはこちら",
      href: "/etorie/demo/app/portfolio",
    },
    { id: "x", label: "X（Twitter）", sub: "@yukino_illust", href: "https://example.com/yukino" },
    { id: "pixiv", label: "pixiv", sub: "作品まとめ", href: "https://example.com/yukino-pixiv" },
    { id: "booth", label: "BOOTH", sub: "グッズ・同人誌", href: "https://example.com/yukino-booth" },
    { id: "skeb", label: "Skeb", sub: "コミッション受付中", href: "https://example.com/yukino-skeb" },
  ],
};
