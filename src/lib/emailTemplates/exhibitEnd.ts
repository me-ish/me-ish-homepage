export function generateExhibitEndEmail(name: string) {
  return {
    subject: '【me-ish】展示期間が終了しました',
    html: `
      <div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333; line-height: 1.6;">
        <p>${name} 様</p>
        <p>ご出展いただいた作品の展示期間が終了いたしました。</p>
        <p>この度はme-ishへのご参加、誠にありがとうございました。</p>

        <hr style="margin: 24px 0;" />

        <p><strong>🎨 再展示・プラン延長のご案内</strong></p>
        <p>再展示をご希望の方は、以下のプランからお選びいただけます：</p>

        <ul>
          <li>Free（¥0 / 表示保証なし・ローテーション枠）</li>
          <li>Mini（¥400 / 月1回保証）</li>
          <li>Light（¥1,000 / 月3回保証）</li>
          <li>Standard（¥2,000 / 月7回保証）</li>
          <li>Premium（¥4,000 / 月15回保証）</li>
        </ul>

        <p>以下のページよりお手続きください：</p>
        <p><a href="https://me-ish.art/renew" style="color: #00a1e9;">▶ 再出展・プラン延長はこちら</a></p>

        <p style="margin-top: 2em;">---<br/>me-ish運営事務局</p>
      </div>
    `,
    text: `${name} 様\n\nご出展いただいた作品の展示期間が終了いたしました。\nこの度はme-ishへのご参加、誠にありがとうございました。\n\n----------------------------\n🎨 再展示・プラン延長のご案内\n\n再展示をご希望の方は、以下のプランからお選びいただけます：\n\n・Free（¥0 / 表示保証なし・ローテーション枠）\n・Mini（¥400 / 月1回保証）\n・Light（¥1,000 / 月3回保証）\n・Standard（¥2,000 / 月7回保証）\n・Premium（¥4,000 / 月15回保証）\n\n▶ 再出展・プラン延長はこちら:\nhttps://me-ish.art/renew\n\n---\nme-ish運営事務局`,
  };
}