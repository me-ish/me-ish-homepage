// 案件の品目（1つのご依頼の中の1点ずつ）の表示用の型。
// 見積・支払い・納品は案件単位のままで、品目はそれらを持たない。
import type { NatoriConcreteProjectType } from "./projects";

export type NatoriCaseItemProgress = "not_started" | "in_progress" | "done";

/** サイトの依頼フォームの publicationPolicy と同じ値。 */
export type NatoriCaseItemPublicationPolicy =
  | "allowed"
  | "delayed"
  | "work_private"
  | "fully_private"
  | "unknown";

export type NatoriCaseItem = {
  id: string;
  projectId: string;
  position: number;
  title: string;
  projectType: NatoriConcreteProjectType | null;
  amount: number | null;
  dueDate: string | null;
  progress: NatoriCaseItemProgress;
  publicationPolicy: NatoriCaseItemPublicationPolicy;
  /** delayed のときだけ入る（YYYY-MM-DD）。 */
  publicationAllowedFrom: string | null;
  note: string | null;
  updatedAt: string;
};

/** ポートフォリオの作品に結ぶ候補（案件名つき）。 */
export type NatoriLinkableCaseItem = {
  id: string;
  caseTitle: string;
  position: number;
  title: string;
  publicationPolicy: NatoriCaseItemPublicationPolicy;
  publicationAllowedFrom: string | null;
};

/** お客さまの画面に出す品目。金額・メモ・公開条件は出さない（約束の金額は見積で示す）。 */
export type NatoriClientCaseItem = {
  position: number;
  title: string;
  progress: NatoriCaseItemProgress;
  dueDate: string | null;
};
