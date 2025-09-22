// components/natori/Hero.tsx
import { Lilita_One, Zen_Maru_Gothic } from "next/font/google";
import Link from "next/link";

const lilita = Lilita_One({ subsets: ["latin"], weight: "400" });
const zen = Zen_Maru_Gothic({ subsets: ["latin"], weight: ["400","500","700"] });

// Pink palette
const PINK = "#FFD1E6";      // main (soft)
const PINK_DEEP = "#FF9BC2"; // accent (buttons)
const PINK_LIGHT = "#FFF0F7"; // light bg

type Props = {
  vgenUrl?: string;
  twitterUrl?: string;
  instaUrl?: string;
  homepageUrl?: string;
};

export default function Hero({ vgenUrl, twitterUrl, instaUrl, homepageUrl }: Props) {
  return (
    <section className="relative overflow-hidden">
      {/* soft pink layered gradient */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(60% 60% at 20% 20%, ${PINK} 0%, transparent 60%),
                       radial-gradient(70% 70% at 80% 30%, ${PINK_LIGHT} 0%, transparent 70%),
                       linear-gradient(180deg, ${PINK_LIGHT}, #ffffff)`,
        }}
      />
      {/* subtle dot accent */}
      <div
        className="absolute -right-10 -top-10 h-64 w-64 -z-10 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(#ffb3cf 1px, transparent 1px), radial-gradient(#ffb3cf 1px, transparent 1px)",
          backgroundPosition: "0 0, 6px 6px",
          backgroundSize: "12px 12px",
          filter: "blur(0.2px)",
        }}
      />
      <div className="mx-auto max-w-6xl px-6 py-5 md:py-5 lg:py-5">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className={`${lilita.className} text-5xl md:text-6xl leading-tight`}>
              NATORI <span className="text-[#FF7FB0]">Portfolio</span>
            </h1>
            <p className={`${zen.className} mt-5 text-lg leading-relaxed text-gray-700`}>
              Transparent light with gentle pink tones.<br />
              Cute and soft—seasoned with a slightly mature nuance.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {vgenUrl && (
                <Link
                  href={vgenUrl}
                  className="rounded-full px-6 py-3 text-white shadow transition hover:opacity-90"
                  style={{ backgroundColor: PINK_DEEP }}
                >
                   VGen account
                </Link>
              )}
              <Link
                href="mailto:hello@me-ish.art?subject=%5BNatori%20Commission%20Inquiry%5D"
                className="rounded-full border px-6 py-3 text-gray-700 transition hover:bg-white/70"
                style={{ borderColor: "#F5D0DC", backgroundColor: "rgba(255,241,247,0.7)" }}
              >
                Contact directly
              </Link>
            </div>

            <div className="mt-6 flex items-center gap-4 text-sm text-gray-600">
              {twitterUrl && <Link href={twitterUrl} className="hover:underline">X (Twitter)</Link>}
              {instaUrl && <Link href={instaUrl} className="hover:underline">Instagram</Link>}
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl border bg-white shadow-xl">
              <img
                src="/natori/イラスト9リサイズ.jpg"
                alt="Natori main visual"
                className="h-full w-full object-cover"
                loading="eager"
              />
            </div>
            {/* soft glow */}
            <div
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[28px] blur-3xl"
              style={{
                background: `radial-gradient(50% 60% at 50% 50%, ${PINK}66 0%, transparent 60%)`,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
