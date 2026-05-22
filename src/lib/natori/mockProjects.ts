import { applyStatusToTasks, createTasksForType } from "@/lib/natori/projects";
import type {
  NatoriProject,
  NatoriProjectStatus,
  NatoriProjectStatusMeta,
} from "@/types/natori/projects";

export const natoriProjectStatusMeta: Record<NatoriProjectStatus, NatoriProjectStatusMeta> = {
  consulting: {
    label: "相談中",
    chipClassName: "border-amber-200 bg-amber-50 text-amber-700",
    cellClassName: "bg-amber-50/60 text-amber-800",
  },
  quoted: {
    label: "見積もり済",
    chipClassName: "border-yellow-200 bg-yellow-50 text-yellow-700",
    cellClassName: "bg-yellow-50/60 text-yellow-800",
  },
  awaiting_payment: {
    label: "入金待ち",
    chipClassName: "border-orange-200 bg-orange-50 text-orange-700",
    cellClassName: "bg-orange-50/60 text-orange-800",
  },
  rough: {
    label: "ラフ",
    chipClassName: "border-pink-200 bg-pink-50 text-pink-700",
    cellClassName: "bg-pink-50/70 text-pink-800",
  },
  lineart: {
    label: "線画",
    chipClassName: "border-rose-200 bg-rose-50 text-rose-700",
    cellClassName: "bg-rose-50/70 text-rose-800",
  },
  coloring: {
    label: "着彩",
    chipClassName: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
    cellClassName: "bg-fuchsia-50/70 text-fuchsia-800",
  },
  waiting: {
    label: "確認待ち",
    chipClassName: "border-sky-200 bg-sky-50 text-sky-700",
    cellClassName: "bg-sky-50/70 text-sky-800",
  },
  delivery_prep: {
    label: "納品準備",
    chipClassName: "border-teal-200 bg-teal-50 text-teal-700",
    cellClassName: "bg-teal-50/70 text-teal-800",
  },
  delivered: {
    label: "納品済",
    chipClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cellClassName: "bg-emerald-50/70 text-emerald-800",
  },
  completed: {
    label: "完了",
    chipClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cellClassName: "bg-emerald-50/70 text-emerald-800",
  },
};

type MockSeed = Omit<NatoriProject, "tasks"> & {
  taskOverrides?: Partial<Record<string, boolean>>;
};

const seeds: MockSeed[] = [
  {
    id: "natori-project-001",
    title: "配信用立ち絵",
    clientName: "月乃さん",
    amount: 18500,
    dueDate: "2026-05-30",
    status: "rough",
    type: "standing",
    nextAction: "ラフ提出",
    note: "表情差分3点。先に全身バランスを確認。",
    taskOverrides: { material: true, rough: true },
  },
  {
    id: "natori-project-002",
    title: "SNSアイコン",
    clientName: "haruさん",
    amount: 4500,
    dueDate: "2026-05-24",
    status: "waiting",
    type: "icon",
    nextAction: "返信待ち",
    note: "色味の希望待ち。",
  },
  {
    id: "natori-project-003",
    title: "SDキャラ全身",
    clientName: "ことりさん",
    amount: 7000,
    dueDate: "2026-06-02",
    status: "coloring",
    type: "sd",
    nextAction: "着彩仕上げ",
    note: "小物追加あり。",
    taskOverrides: { color: true },
  },
  {
    id: "natori-project-004",
    title: "歌ってみた背景付きイラスト",
    clientName: "Reiさん",
    amount: 16000,
    dueDate: "2026-06-15",
    status: "consulting",
    type: "illustration",
    nextAction: "依頼内容の確認",
    note: "商用利用の範囲を確認してから確定。",
  },
  {
    id: "natori-project-005",
    title: "記念日イラスト",
    clientName: "miuさん",
    amount: 12500,
    dueDate: "2026-05-24",
    status: "lineart",
    type: "illustration",
    nextAction: "線画調整",
    note: "納期近め。優先度高。",
    priority: "high",
  },
  {
    id: "natori-project-006",
    title: "IRIAM用立ち絵",
    clientName: "橘さん",
    amount: 23000,
    dueDate: "2026-05-18",
    status: "delivered",
    type: "standing",
    nextAction: "納品済み",
    note: "最終データ送付済み。",
  },
  {
    id: "natori-project-007",
    title: "誕生日記念立ち絵",
    clientName: "さくらさん",
    amount: 21000,
    dueDate: "2026-05-28",
    status: "rough",
    type: "standing",
    nextAction: "ラフ作成",
    note: "誕生日に間に合わせたい。",
  },
  {
    id: "natori-project-008",
    title: "ファンアートアイコン",
    clientName: "ゆいさん",
    amount: 4000,
    dueDate: "2026-05-21",
    status: "lineart",
    type: "icon",
    nextAction: "線画作業",
    note: "納期超過注意。",
  },
  {
    id: "natori-project-009",
    title: "同人ゲームSD",
    clientName: "あめさん",
    amount: 8500,
    dueDate: "2026-05-25",
    status: "awaiting_payment",
    type: "sd",
    nextAction: "入金確認",
    note: "入金確認後にラフ開始。",
  },
  {
    id: "natori-project-010",
    title: "イベント告知バナー",
    clientName: "tomoさん",
    amount: 9500,
    dueDate: "2026-06-10",
    status: "quoted",
    type: "illustration",
    nextAction: "返信待ち",
  },
];

function buildProject(seed: MockSeed): NatoriProject {
  const baseTasks = createTasksForType(seed.type);
  const afterStatus = applyStatusToTasks(baseTasks, seed.status);
  const finalTasks = afterStatus.map((task) => {
    const override = seed.taskOverrides?.[task.id];
    if (override === undefined) return task;
    return { ...task, done: override };
  });
  const { taskOverrides: _ignored, ...rest } = seed;
  void _ignored;
  return { ...rest, tasks: finalTasks };
}

export const mockNatoriProjects: NatoriProject[] = seeds.map(buildProject);
