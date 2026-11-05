// お客さまの相談ページに出す「ご依頼の内容」。品目を①②③と並べ、進みと納期（先に渡した品目はその日）だけを見せる。
// 金額は出さない（お約束の金額は見積でお知らせする）。
import { natoriClientUi as ui } from "../../constants/clientUi";
import type { NatoriClientCaseItem } from "../../types/caseItems";

const circled = (n: number) => (n >= 1 && n <= 20 ? String.fromCodePoint(0x245f + n) : `${n}.`);
const PROGRESS: Record<NatoriClientCaseItem["progress"], string> = { not_started: "これから", in_progress: "制作中", done: "完成" };
const monthDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(m)}月${Number(d)}日`;
};

export default function ClientCaseItems({ items }: { items: readonly NatoriClientCaseItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className={`${ui.card} space-y-3`} aria-label="ご依頼の内容">
      <h2 className={ui.heading}>ご依頼の内容{items.length > 1 ? `（${items.length}点）` : ""}</h2>
      <ul className={ui.divider}>
        {items.map((item) => (
          <li key={item.position} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5">
            <span className={`min-w-0 font-bold ${ui.phrase}`}>{circled(item.position)} {item.title}</span>
            <span className={`flex shrink-0 items-center gap-2 ${ui.small} ${ui.muted}`}>
              {item.handedOverAt ? (
                <span>{monthDay(item.handedOverAt)}にお渡し済み</span>
              ) : item.dueDate ? (
                <span>納期 {monthDay(item.dueDate)}ごろ</span>
              ) : null}
              <span className={ui.badge}>{item.handedOverAt ? "お渡し済み" : PROGRESS[item.progress]}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
