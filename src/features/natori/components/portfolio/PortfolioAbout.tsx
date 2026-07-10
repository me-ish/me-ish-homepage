// features/natori/components/portfolio/PortfolioAbout.tsx
import {
  portfolioColors as c,
  portfolioProfile,
} from "@/features/natori/constants/portfolioContent";
import ChibiFace from "./ChibiFace";

export default function PortfolioAbout() {
  return (
    <section id="about" className="py-16" style={{ background: c.paperAlt }}>
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-5 md:grid-cols-3">
        <div className="flex justify-center md:col-span-1">
          <div
            className="rounded-full p-6"
            style={{ background: c.card, boxShadow: "0 12px 24px rgba(45,42,61,0.10)" }}
          >
            <ChibiFace size={140} skin="#FDE0D0" hair="#9AB8F0" accent={c.mint} />
          </div>
        </div>
        <div className="md:col-span-2">
          <h2 className="mb-3 text-2xl font-black">プロフィール</h2>
          <p className="mb-4 leading-relaxed" style={{ color: c.inkSoft }}>
            {portfolioProfile.aboutText}
          </p>
          <div className="flex items-start gap-4 rounded-xl p-5" style={{ background: c.card }}>
            <span className="text-2xl" aria-hidden="true">
              🎀
            </span>
            <div>
              <p className="mb-1 font-bold">{portfolioProfile.live2dNoteTitle}</p>
              <p className="text-sm leading-relaxed" style={{ color: c.inkSoft }}>
                {portfolioProfile.live2dNoteBody}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
