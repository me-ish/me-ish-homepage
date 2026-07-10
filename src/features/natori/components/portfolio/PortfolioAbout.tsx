// features/natori/components/portfolio/PortfolioAbout.tsx
import Image from "next/image";
import {
  portfolioColors as c,
  portfolioImages,
  portfolioProfile,
  portfolioServices,
} from "@/features/natori/constants/portfolioContent";
import ChibiFace from "./ChibiFace";

export default function PortfolioAbout() {
  return (
    <section id="about" className="py-16" style={{ background: c.paperAlt }}>
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-5 md:grid-cols-3">
        <div className="flex justify-center md:col-span-1">
          {/* プロフィールアイコン。portfolioImages.about を設定すると実画像に差し替わる */}
          <div
            className="rounded-full p-6"
            style={{ background: c.card, boxShadow: "0 12px 24px rgba(45,42,61,0.10)" }}
          >
            {portfolioImages.about ? (
              <div className="relative h-[140px] w-[140px] overflow-hidden rounded-full">
                <Image
                  src={portfolioImages.about}
                  alt={`${portfolioProfile.artistName} アイコン`}
                  fill
                  sizes="140px"
                  className="object-cover"
                />
              </div>
            ) : (
              <ChibiFace size={140} skin="#FDE0D0" hair="#9AB8F0" accent={c.mint} />
            )}
          </div>
        </div>
        <div className="md:col-span-2">
          <h2 className="mb-3 text-2xl font-black">プロフィール</h2>
          {portfolioProfile.aboutParagraphs.map((paragraph) => (
            <p key={paragraph} className="mb-4 leading-relaxed" style={{ color: c.inkSoft }}>
              {paragraph}
            </p>
          ))}
          <div className="rounded-xl p-5" style={{ background: c.card }}>
            <p className="mb-3 font-bold">対応内容</p>
            <ul className="flex flex-wrap gap-2">
              {portfolioServices.map((service) => (
                <li
                  key={service}
                  className="rounded-full border-2 px-3 py-1 text-xs font-bold md:text-sm"
                  style={{ borderColor: c.paperAlt, color: c.inkSoft }}
                >
                  {service}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
