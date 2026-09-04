// --- /lib/emailTemplates/payoutAdminNotice.ts ---
// 管理者向け振込関連通知メール
import { getEmailLinks } from '@/lib/constants';

export type PayoutCloseNoticeArgs = {
  periodYm: string;           // 締め対象期間 "2025-01"
  totalAmount: number;        // 振込総額
  artistCount: number;        // 対象アーティスト数
  saleCount: number;          // 対象売上件数
  closedAt: string;           // 締め日時
  dashboardUrl?: string;      // 管理画面URL
};

export type PayoutReminderArgs = {
  periodYm: string;           // 対象期間
  totalAmount: number;        // 振込予定総額
  artistCount: number;        // 対象アーティスト数
  daysUntilClose: number;     // 締め日まで残り日数
  daysUntilPayout: number;    // 振込日まで残り日数
  dashboardUrl?: string;      // 管理画面URL
};

const BRAND_HEX = '#00a1e9';

/**
 * 月末締め完了通知メール
 */
export function generatePayoutCloseNoticeEmail(arg: PayoutCloseNoticeArgs) {
  const {
    periodYm,
    totalAmount,
    artistCount,
    saleCount,
    closedAt,
    dashboardUrl = getEmailLinks().adminPayoutsUrl,
  } = arg;

  const periodStr = `${periodYm.slice(0, 4)}年${parseInt(periodYm.slice(5, 7), 10)}月`;
  const closedAtStr = new Date(closedAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });

  const preheader = `${periodStr}分の締め処理が完了しました。振込総額: ¥${fmtYen(totalAmount)}`;

  const html = `
  <div style="background:#f7fafc;padding:24px 0;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP',sans-serif;color:#1f2937;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish Admin</div>
        <div style="font-size:12px;color:#9ca3af;">振込管理通知</div>
      </div>

      <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
        <div style="font-size:14px;color:#065f46;margin-bottom:4px;">${periodStr}分 締め処理完了</div>
        <div style="font-size:28px;font-weight:700;color:#047857;">¥${fmtYen(totalAmount)}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tbody>
          ${row('対象期間', periodStr)}
          ${row('対象アーティスト数', `${artistCount}名`)}
          ${row('対象売上件数', `${saleCount}件`)}
          ${row('締め日時', closedAtStr)}
        </tbody>
      </table>

      <div style="margin:20px 0;text-align:center;">
        <a href="${sanitizeUrl(dashboardUrl)}"
           style="display:inline-block;padding:12px 24px;border-radius:10px;background:${BRAND_HEX};color:#fff;text-decoration:none;font-weight:700;">
           振込管理画面を開く
        </a>
      </div>

      <div style="margin:16px 0;padding:12px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;font-size:14px;color:#92400e;">
        <strong>次のアクション:</strong><br/>
        1. 管理画面から「CSV出力」で振込データをダウンロード<br/>
        2. 銀行で振込処理を実行<br/>
        3. 完了後「一括振込完了」をクリック
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <p style="margin:0;font-size:12px;color:#9ca3af;">このメールは me-ish 管理者向け自動通知です。</p>
    </div>
  </div>`;

  const text = `
【me-ish Admin】${periodStr}分 締め処理完了

振込総額: ¥${fmtYen(totalAmount)}
対象アーティスト数: ${artistCount}名
対象売上件数: ${saleCount}件
締め日時: ${closedAtStr}

次のアクション:
1. 管理画面から「CSV出力」で振込データをダウンロード
2. 銀行で振込処理を実行
3. 完了後「一括振込完了」をクリック

振込管理画面: ${dashboardUrl}
`.trim();

  return {
    subject: `【me-ish】${periodStr}分 振込締め処理完了（¥${fmtYen(totalAmount)}）`,
    html,
    text,
  };
}

/**
 * 締め日リマインダーメール
 */
export function generatePayoutReminderEmail(arg: PayoutReminderArgs) {
  const {
    periodYm,
    totalAmount,
    artistCount,
    daysUntilClose,
    daysUntilPayout,
    dashboardUrl = getEmailLinks().adminPayoutsUrl,
  } = arg;

  const periodStr = `${periodYm.slice(0, 4)}年${parseInt(periodYm.slice(5, 7), 10)}月`;
  const preheader = `${periodStr}分の振込締め日まであと${daysUntilClose}日です`;

  const urgencyColor = daysUntilClose <= 3 ? '#dc2626' : '#f59e0b';
  const urgencyBg = daysUntilClose <= 3 ? '#fef2f2' : '#fffbeb';
  const urgencyBorder = daysUntilClose <= 3 ? '#fca5a5' : '#fcd34d';

  const html = `
  <div style="background:#f7fafc;padding:24px 0;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP',sans-serif;color:#1f2937;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish Admin</div>
        <div style="font-size:12px;color:#9ca3af;">振込リマインダー</div>
      </div>

      <div style="background:${urgencyBg};border:1px solid ${urgencyBorder};border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
        <div style="font-size:14px;color:${urgencyColor};margin-bottom:4px;font-weight:700;">
          締め日まであと ${daysUntilClose} 日
        </div>
        <div style="font-size:12px;color:#6b7280;">振込予定日まであと ${daysUntilPayout} 日</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tbody>
          ${row('対象期間', periodStr)}
          ${row('振込予定総額', `¥${fmtYen(totalAmount)}`)}
          ${row('対象アーティスト数', `${artistCount}名`)}
        </tbody>
      </table>

      <div style="margin:20px 0;text-align:center;">
        <a href="${sanitizeUrl(dashboardUrl)}"
           style="display:inline-block;padding:12px 24px;border-radius:10px;background:${BRAND_HEX};color:#fff;text-decoration:none;font-weight:700;">
           振込管理画面を確認
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <p style="margin:0;font-size:12px;color:#9ca3af;">このメールは me-ish 管理者向け自動通知です。</p>
    </div>
  </div>`;

  const text = `
【me-ish Admin】振込リマインダー

${periodStr}分の振込締め日まであと${daysUntilClose}日です。
振込予定日まであと${daysUntilPayout}日です。

振込予定総額: ¥${fmtYen(totalAmount)}
対象アーティスト数: ${artistCount}名

振込管理画面: ${dashboardUrl}
`.trim();

  return {
    subject: `【me-ish】振込リマインダー: 締め日まであと${daysUntilClose}日（¥${fmtYen(totalAmount)}）`,
    html,
    text,
  };
}

/* ----- utils ----- */
function fmtYen(n: number) {
  return new Intl.NumberFormat('ja-JP').format(n);
}

function row(label: string, value: string) {
  const tdL = 'width:50%;padding:8px 0;color:#555;border-bottom:1px solid #f1f5f9;';
  const tdR = 'width:50%;padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;';
  return `<tr><td style="${tdL}">${label}</td><td style="${tdR}">${value}</td></tr>`;
}

function sanitizeUrl(url?: string) {
  if (!url) return '#';
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return url;
  } catch {}
  return '#';
}
