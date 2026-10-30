import Link from "next/link";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";

const linkClassName = "pf-cute-focus font-bold underline decoration-2 underline-offset-4 hover:opacity-70";
const linkStyle = { color: c.actionTextSmall, textDecorationColor: c.actionSoft };

export default function PortfolioLegalNotice() {
  return (
    <div
      className="rounded-xl border px-4 py-3 text-xs leading-6"
      style={{ borderColor: c.borderSubtle, background: c.surfaceSubtle, color: c.textSoft }}
    >
      <p>
        このフォームは、ご相談・お見積もりの受付フォームです。送信のみでは制作契約は成立しません。
      </p>
      <p className="mt-1">
        ご入力いただいた情報は、ご相談への対応、お見積もり、制作・納品等のために利用します。{" "}
        <Link href="/natori/legal/terms" className={linkClassName} style={linkStyle} target="_blank" rel="noopener noreferrer">
          ご依頼規約
        </Link>
        と
        <Link href="/natori/legal/privacy" className={linkClassName} style={linkStyle} target="_blank" rel="noopener noreferrer">
          プライバシーポリシー
        </Link>
        をご確認のうえ送信してください。
      </p>
      <p className="mt-1">
        <Link href="/natori/legal/tokushoho" className={linkClassName} style={linkStyle} target="_blank" rel="noopener noreferrer">
          特定商取引法に基づく表記
        </Link>
      </p>
    </div>
  );
}
