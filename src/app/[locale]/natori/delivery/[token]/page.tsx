// app/[locale]/natori/delivery/[token]/page.tsx
// 納品ページ（公開・トークンが資格情報）。
// 納品メール内のリンクから開き、ファイルをダウンロードして「受け取りました」を押す。
// GET では状態を読むだけで何も書かない（メールスキャナの自動アクセス対策）。
// quote/[token] と同じ構成。
import type { Metadata } from "next";
import DeliveryAcceptCard from "@/features/natori/components/quote/DeliveryAcceptCard";
import NatoriClientShell, { NatoriClientNotice } from "@/features/natori/components/client/NatoriClientShell";
import { getNatoriDeliveryByToken } from "@/features/natori/server/deliveryService";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "納品のご確認 – Natori",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

function Shell({ children }: { children: React.ReactNode }) {
  return <NatoriClientShell title="納品のご確認">{children}</NatoriClientShell>;
}

export default async function DeliveryPage(props: Props) {
  const params = await props.params;
  const result = await getNatoriDeliveryByToken(params.token);

  if (result.kind === "not-found") {
    return (
      <Shell>
        <NatoriClientNotice
          icon="link"
          title="このリンクは無効です"
          body="納品メールのリンクをご確認いただくか、メールにご返信ください。"
        />
      </Shell>
    );
  }

  if (result.kind === "db-error") return <Shell><NatoriClientNotice icon="alert" title="納品内容を取得できませんでした" body="時間をおいてこのページを再読み込みしてください。改善しない場合は、納品メールにご返信ください。" /></Shell>;

  if (result.kind === "expired") {
    return (
      <Shell>
        <NatoriClientNotice
          icon="clock"
          title="納品ページの有効期限が過ぎています"
          body="お手数ですが、納品メールにご返信ください。改めてご案内いたします。"
        />
      </Shell>
    );
  }

  const { delivery } = result;
  return (
    <Shell>
      <DeliveryAcceptCard
        token={params.token}
        title={delivery.title}
        clientName={delivery.clientName}
        files={delivery.files}
        acceptedAt={delivery.acceptedAt}
        canAccept={delivery.canAccept}
        expiresAt={delivery.expiresAt}
        blockedReason={delivery.blockedReason}
      />
    </Shell>
  );
}
