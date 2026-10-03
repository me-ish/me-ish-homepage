import { natoriAdminUi } from "@/features/natori/constants/adminUi";

type NatoriLoadErrorProps = {
  resourceLabel: string;
  error: string;
  onRetry: () => void;
};

export function NatoriLoadError({
  resourceLabel,
  error,
  onRetry,
}: NatoriLoadErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <p className="font-bold">{resourceLabel}の読み込みに失敗しました。</p>
      <p className="mt-1 text-xs leading-5 text-amber-900">
        実データと区別できない表示を避けるため、デモデータには切り替えていません。
        合言葉付きのブックマークから開き直すか、下のボタンで再試行してください。
      </p>
      <button type="button" onClick={onRetry} className={`${natoriAdminUi.btnSecondary} mt-3`}>
        再試行する
      </button>
      <details className="mt-3 text-xs text-amber-800">
        <summary className="cursor-pointer font-bold">エラー詳細</summary>
        <p className="mt-1 break-words">{error}</p>
      </details>
    </div>
  );
}
