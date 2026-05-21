import type { NatoriProject, NatoriProjectStatus, NatoriProjectStatusMeta } from "@/types/natori/projects";

export const natoriProjectStatusMeta: Record<NatoriProjectStatus, NatoriProjectStatusMeta> = {
  consulting: {
    label: "相談中",
    chipClassName: "border-amber-200 bg-amber-50 text-amber-700",
  },
  rough: {
    label: "ラフ",
    chipClassName: "border-pink-200 bg-pink-50 text-pink-700",
  },
  lineart: {
    label: "線画",
    chipClassName: "border-rose-200 bg-rose-50 text-rose-700",
  },
  coloring: {
    label: "着彩",
    chipClassName: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  },
  waiting: {
    label: "確認待ち",
    chipClassName: "border-sky-200 bg-sky-50 text-sky-700",
  },
  delivered: {
    label: "納品済",
    chipClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
};

export const mockNatoriProjects: NatoriProject[] = [
  {
    id: "natori-project-001",
    title: "配信用立ち絵",
    clientName: "月乃さん",
    amount: 18500,
    dueDate: "2026-06-08",
    status: "rough",
    nextAction: "ラフ提出",
    note: "表情差分3点。先に全身バランスを確認。",
  },
  {
    id: "natori-project-002",
    title: "SNSアイコン",
    clientName: "haruさん",
    amount: 4500,
    dueDate: "2026-05-28",
    status: "waiting",
    nextAction: "修正内容の確認",
    note: "色味の希望待ち。",
  },
  {
    id: "natori-project-003",
    title: "SDキャラ全身",
    clientName: "ことりさん",
    amount: 7000,
    dueDate: "2026-06-02",
    status: "coloring",
    nextAction: "着彩仕上げ",
    note: "小物追加あり。",
  },
  {
    id: "natori-project-004",
    title: "歌ってみた背景付きイラスト",
    clientName: "Reiさん",
    amount: 16000,
    dueDate: "2026-06-15",
    status: "consulting",
    nextAction: "背景資料の確認",
    note: "商用利用の範囲を確認してから確定。",
  },
  {
    id: "natori-project-005",
    title: "記念日イラスト",
    clientName: "miuさん",
    amount: 12500,
    dueDate: "2026-05-24",
    status: "lineart",
    nextAction: "線画調整",
    note: "納期近め。優先度高。",
  },
  {
    id: "natori-project-006",
    title: "IRIAM用立ち絵",
    clientName: "橘さん",
    amount: 23000,
    dueDate: "2026-05-20",
    status: "delivered",
    nextAction: "納品済み",
    note: "最終データ送付済み。",
  },
];
