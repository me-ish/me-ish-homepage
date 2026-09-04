// features/natori/constants/request.ts
// RequestData V1 の stable ID と表示label。保存値はlabelではなく id を使う。
import type {
  NatoriCommissionScopeV1,
  NatoriRequestTypeV1,
  NatoriUsageTypeV1,
} from "@/features/natori/types/request";

type Choice<T extends string> = Readonly<{ id: T; label: string }>;

export const NATORI_REQUEST_TYPE_CHOICES = [
  { id: "undecided", label: "未定・相談して決めたい" },
  { id: "icon", label: "SNSアイコン" },
  { id: "sd", label: "SDキャラクター" },
  { id: "standing", label: "立ち絵" },
  { id: "illustration", label: "一枚絵" },
  { id: "other", label: "その他" },
] as const satisfies readonly Choice<NatoriRequestTypeV1>[];

export const NATORI_COMMISSION_SCOPE_CHOICES = [
  { id: "undecided", label: "未定・相談して決めたい" },
  { id: "bust_up", label: "胸上" },
  { id: "waist_up", label: "膝〜腰上" },
  { id: "full_body", label: "全身" },
  { id: "other", label: "その他" },
] as const satisfies readonly Choice<NatoriCommissionScopeV1>[];

export const NATORI_USAGE_TYPE_CHOICES = [
  { id: "social_icon", label: "SNSアイコン" },
  { id: "streaming", label: "配信" },
  { id: "video_thumbnail", label: "動画サムネイル" },
  { id: "trpg", label: "TRPG" },
  { id: "original_character", label: "オリジナルキャラクター" },
  { id: "print", label: "印刷物" },
  { id: "merchandise", label: "グッズ" },
  { id: "advertising", label: "広告" },
  { id: "other", label: "その他" },
] as const satisfies readonly Choice<NatoriUsageTypeV1>[];
