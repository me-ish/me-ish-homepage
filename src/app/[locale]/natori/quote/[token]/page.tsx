// app/[locale]/natori/quote/[token]/page.tsx
// 見積もり承諾ページ（公開・トークンが資格情報）。
// 見積もりメール内のリンクから開き、内容を確認して承諾ボタンを押す。
// GET では状態を読むだけで何も書かない（メールスキャナの自動アクセス対策）。
import type { Metadata } from "next";
import QuoteAcceptCard from "@/features/natori/components/quote/QuoteAcceptCard";
import NatoriClientShell, { NatoriClientNotice } from "@/features/natori/components/client/NatoriClientShell";
import { getNatoriQuoteByToken } from "@/features/natori/server/quoteAcceptService";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "お見積もりのご確認 – Natori",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

function Shell({ children }: { children: React.ReactNode }) {
  return <NatoriClientShell title="お見積もりのご確認">{children}</NatoriClientShell>;
}

export default async function QuoteAcceptPage(props: Props) {
  const params = await props.params;
  const result = await getNatoriQuoteByToken(params.token);

  if (result.kind === "not-found") {
    return (
      <Shell>
        <NatoriClientNotice
          icon="link"
          title="このリンクは無効です"
          body="お見積もりが更新された場合、古いリンクはご利用いただけません。最新のお見積もりメールのリンクをご確認いただくか、メールにご返信ください。"
        />
      </Shell>
    );
  }

  if (result.kind === "expired") {
    return (
      <Shell>
        <NatoriClientNotice
          icon="clock"
          title="お見積もりの有効期限が過ぎています"
          body="お手数ですが、お見積もりメールにご返信ください。改めてご案内いたします。"
        />
      </Shell>
    );
  }

  const { quote } = result;
  return (
    <Shell>
      <QuoteAcceptCard
        token={params.token}
        title={quote.title}
        clientName={quote.clientName}
        amount={quote.amount}
        acceptedAt={quote.acceptedAt}
        expiresAt={quote.expiresAt}
        terms={quote.terms}
        version={quote.version}
        items={quote.items}
        payment={quote.payment}
      />
    </Shell>
  );
}
