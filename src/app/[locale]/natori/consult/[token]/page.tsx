import type { Metadata } from "next";
import ConsultationThread from "@/features/natori/components/consultation/ConsultationThread";
import RenewConsultationLink from "@/features/natori/components/consultation/RenewConsultationLink";
import { getClientConsultation } from "@/features/natori/server/consultationService";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ナトリとの相談", robots: { index: false, follow: false } };
type Props = { params: Promise<{ token: string }> };

export default async function NatoriConsultationPage({ params }: Props) {
  const { token } = await params;
  const conversation = await getClientConsultation(token);
  return (
    <main className="min-h-screen bg-pink-50 px-4 py-10 text-gray-900">
      <meta name="referrer" content="no-referrer" />
      <div className="mx-auto max-w-xl space-y-5 rounded-2xl bg-white p-5 shadow-sm sm:p-8">
        <div>
          <h1 className="text-xl font-black">ナトリとの相談</h1>
          {conversation ? <p className="mt-1 text-sm text-gray-600">{conversation.title}</p> : null}
        </div>
        {conversation ? <>
          {conversation.initialInquiry ? <div className="rounded-xl bg-gray-50 p-3 text-sm"><p className="mb-1 font-bold">最初のご相談</p><p className="whitespace-pre-wrap break-words">{conversation.initialInquiry}</p></div> : null}
          {conversation.initialFiles.length ? <div className="space-y-1 rounded-xl bg-gray-50 p-3 text-sm"><p className="font-bold">受付時の資料</p>{conversation.initialFiles.map((file) => <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="block text-pink-700 underline">{file.name}</a>)}</div> : null}
          <ConsultationThread mode="client" token={token} initialMessages={conversation.messages} closed={conversation.closed} />
        </>
          : <RenewConsultationLink token={token} />}
      </div>
    </main>
  );
}
