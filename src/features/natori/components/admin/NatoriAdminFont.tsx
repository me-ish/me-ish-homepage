// 管理画面の Noto Sans JP を、管理画面を開いたときだけ読み込む。
// このファイルが import されたページだけに @font-face（日本語は数百KB）が入るので、
// 公開ページ（ポートフォリオなど）はこの CSS を読まずに済む。
// --font-noto-jp を :root に置くのは、body 直下に出るダイアログにも同じ書体を効かせるため。
import { notoSansJp } from "@/styles/adminFonts";

export function NatoriAdminFont() {
  return <style>{`:root{--font-noto-jp:${notoSansJp.style.fontFamily};}`}</style>;
}
