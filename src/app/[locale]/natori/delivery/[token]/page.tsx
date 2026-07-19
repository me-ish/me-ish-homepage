// app/[locale]/natori/delivery/[token]/page.tsx
// 納品ページ（公開・トークンが資格情報）。
// 納品メール内のリンクから開き、ファイルをダウンロードして「受け取りました」を押す。
// GET では状態を読むだけで何も書かない（メールスキャナの自動アクセス対策）。
// quote/[token] と同じ構成。
import type { Metadata } from "next";
import DeliveryAcceptCard from "@/features/natori/components/quote/DeliveryAcceptCard";
import { getNatoriDeliveryByToken } from "@/features/natori/server/deliveryService";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "納品のご確認 – Natori",
  robots: { index: false, follow: false },
};

type Props = { params: { token: string } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-16"
      style={{ background: c.paper, color: c.ink }}
    >
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-xl font-black md:text-2xl">納品のご確認</h1>
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

export default async function DeliveryPage({ params }: Props) {
  const result = await getNatoriDeliveryByToken(params.token);

  if (result.kind === "not-found") {
    return (
      <Shell>
        <Notice
          title="このリンクは無効です"
          body="納品メールが再送された場合、古いリンクはご利用いただけません。最新の納品メールのリンクをご確認いただくか、メールにご返信ください。"
        />
      </Shell>
    );
  }

  if (result.kind === "expired") {
    return (
      <Shell>
        <Notice
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
      />
    </Shell>
  );
}
