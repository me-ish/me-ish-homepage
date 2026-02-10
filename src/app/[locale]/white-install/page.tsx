// app/white-install/page.tsx
export const dynamic = 'force-static'; // 静的ページとして生成されるようにする

export default function WhiteInstallRedirect() {
  return (
    <html>
      <head>
        <meta httpEquiv="refresh" content="0; url=/white" />
        <title>me-ish ホワイトギャラリー</title>
      </head>
      <body>
        <p>White Gallery に移動中です...</p>
      </body>
    </html>
  );
}
