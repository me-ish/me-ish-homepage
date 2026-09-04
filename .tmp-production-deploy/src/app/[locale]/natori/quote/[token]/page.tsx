// app/[locale]/natori/quote/[token]/page.tsx
// 見積もり承諾ページ（公開・トークンが資格情報）。
// 見積もりメール内のリンクから開き、内容を確認して承諾ボタンを押す。
// GET では状態を読むだけで何も書かない（メールスキャナの自動アクセス対策）。
import type { Metadata } from "next";
import QuoteAcceptCard from "@/features/natori/components/quote/QuoteAcceptCard";
import { getNatoriQuoteByToken } from "@/features/natori/server/quoteAcceptService";
import { legacyNatoriTransactionColors as c } from "@/features/natori/constants/portfolioContent";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "お見積もりのご確認 – Natori",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-16"
      style={{ background: c.paper, color: c.ink }}
    >
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-xl font-black md:text-2xl">
          お見積もりのご確認
        </h1>
        {children}
      </div>
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="rounded-2xl p-8 text-center"
      style={{ background: c.card, boxShadow: "0 10px 22px rgba(45,42,61,0.10)" }}
    >
      <p className="mb-2 font-bold">{title}</p>
      <p className="text-sm" style={{ color: c.inkSoft }}>
        {body}
      </p>
    </div>
  );
}

export default async function QuoteAcceptPage(props: Props) {
  const params = await props.params;
  const result = await getNatoriQuoteByToken(params.token);

  if (result.kind === "not-found") {
    return (
      <Shell>
        <Notice
          title="このリンクは無効です"
          body="お見積もりが更新された場合、古いリンクはご利用いただけません。最新のお見積もりメールのリンクをご確認いただくか、メールにご返信ください。"
        />
      </Shell>
    );
  }

  if (result.kind === "expired") {
    return (
      <Shell>
        <Notice
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
      />
    </Shell>
  );
}
