import Link from "next/link";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";

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
        <Link
          href="/natori/legal/privacy"
          className="pf-cute-focus font-bold underline decoration-2 underline-offset-4 hover:opacity-70"
          style={{ color: c.accentText, textDecorationColor: c.accentSoft }}
        >
          プライバシーポリシー
        </Link>
        をご確認のうえ送信してください。
      </p>
    </div>
  );
}
