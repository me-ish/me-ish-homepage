import { applyStatusToTasks, createTasksForType } from "@/lib/natori/projects";
import type {
  NatoriProject,
  NatoriProjectStatus,
  NatoriProjectStatusMeta,
  NatoriTaskStage,
} from "@/types/natori/projects";

export type NatoriStageMeta = {
  label: string;
  chipClassName: string;
  softClassName: string;
  doneTaskClassName: string;
  checkboxClassName: string;
  dotClassName: string;
  borderLeftClassName: string;
};

export const natoriStageMeta: Record<NatoriTaskStage, NatoriStageMeta> = {
  material: {
    label: "資料",
    chipClassName: "border-slate-300 bg-slate-100 text-slate-800",
    softClassName: "bg-slate-50 text-slate-800",
    doneTaskClassName: "border-slate-300 bg-slate-100 text-slate-900",
    checkboxClassName: "border-slate-600 bg-slate-600 text-white",
    dotClassName: "bg-slate-500",
    borderLeftClassName: "border-l-2 border-slate-500",
  },
  rough: {
    label: "ラフ",
    chipClassName: "border-amber-300 bg-amber-100 text-amber-900",
    softClassName: "bg-amber-50 text-amber-900",
    doneTaskClassName: "border-amber-300 bg-amber-100 text-amber-900",
    checkboxClassName: "border-amber-500 bg-amber-500 text-white",
    dotClassName: "bg-amber-500",
    borderLeftClassName: "border-l-2 border-amber-500",
  },
  lineart: {
    label: "線画",
    chipClassName: "border-indigo-300 bg-indigo-100 text-indigo-900",
    softClassName: "bg-indigo-50 text-indigo-900",
    doneTaskClassName: "border-indigo-300 bg-indigo-100 text-indigo-900",
    checkboxClassName: "border-indigo-500 bg-indigo-500 text-white",
    dotClassName: "bg-indigo-500",
    borderLeftClassName: "border-l-2 border-indigo-500",
  },
  coloring: {
    label: "着彩",
    chipClassName: "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900",
    softClassName: "bg-fuchsia-50 text-fuchsia-900",
    doneTaskClassName: "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900",
    checkboxClassName: "border-fuchsia-500 bg-fuchsia-500 text-white",
    dotClassName: "bg-fuchsia-500",
    borderLeftClassName: "border-l-2 border-fuchsia-500",
  },
  finish: {
    label: "仕上げ",
    chipClassName: "border-violet-300 bg-violet-100 text-violet-900",
    softClassName: "bg-violet-50 text-violet-900",
    doneTaskClassName: "border-violet-300 bg-violet-100 text-violet-900",
    checkboxClassName: "border-violet-500 bg-violet-500 text-white",
    dotClassName: "bg-violet-500",
    borderLeftClassName: "border-l-2 border-violet-500",
  },
  delivery: {
    label: "納品",
    chipClassName: "border-emerald-300 bg-emerald-100 text-emerald-900",
    softClassName: "bg-emerald-50 text-emerald-900",
    doneTaskClassName: "border-emerald-300 bg-emerald-100 text-emerald-900",
    checkboxClassName: "border-emerald-500 bg-emerald-500 text-white",
    dotClassName: "bg-emerald-500",
    borderLeftClassName: "border-l-2 border-emerald-500",
  },
};

export const natoriProjectStatusMeta: Record<NatoriProjectStatus, NatoriProjectStatusMeta> = {
  consulting: {
    label: "相談中",
    chipClassName: "border-amber-300 bg-amber-50 text-amber-800",
    cellClassName: "bg-amber-50 text-amber-900",
  },
  quoted: {
    label: "見積もり済",
    chipClassName: "border-yellow-300 bg-yellow-50 text-yellow-800",
    cellClassName: "bg-yellow-50 text-yellow-900",
  },
  awaiting_payment: {
    label: "入金待ち",
    chipClassName: "border-orange-300 bg-orange-50 text-orange-800",
    cellClassName: "bg-orange-50 text-orange-900",
  },
  rough: {
    label: "ラフ",
    chipClassName: "border-amber-400 bg-amber-100 text-amber-900",
    cellClassName: "bg-amber-100 text-amber-900",
  },
  lineart: {
    label: "線画",
    chipClassName: "border-indigo-400 bg-indigo-100 text-indigo-900",
    cellClassName: "bg-indigo-100 text-indigo-900",
  },
  coloring: {
    label: "着彩",
    chipClassName: "border-fuchsia-400 bg-fuchsia-100 text-fuchsia-900",
    cellClassName: "bg-fuchsia-100 text-fuchsia-900",
  },
  waiting: {
    label: "確認待ち",
    chipClassName: "border-sky-300 bg-sky-50 text-sky-800",
    cellClassName: "bg-sky-50 text-sky-900",
  },
  delivery_prep: {
    label: "納品準備",
    chipClassName: "border-violet-400 bg-violet-100 text-violet-900",
    cellClassName: "bg-violet-100 text-violet-900",
  },
  delivered: {
    label: "納品済",
    chipClassName: "border-emerald-400 bg-emerald-100 text-emerald-900",
    cellClassName: "bg-emerald-100 text-emerald-900",
  },
  completed: {
    label: "完了",
    chipClassName: "border-emerald-500 bg-emerald-200 text-emerald-900",
    cellClassName: "bg-emerald-200 text-emerald-900",
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
