// components/natori/About.tsx
const PINK_BG = "#FFF5F9";
const PINK_BORDER = "#F5D0DC";

export default function About() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16 md:py-20">
      <h2 className="text-2xl font-semibold">About</h2>

      <div className="mt-6 grid gap-8 md:grid-cols-3">
        {/* === Circular portrait === */}
        <div className="md:col-span-1">
          <div className="relative mx-auto h-56 w-56 md:h-64 md:w-64">
            {/* soft pink glow */}
            <div
              className="absolute inset-0 -z-10 rounded-full blur-2xl"
              style={{ background: "radial-gradient(60% 60% at 50% 50%, #FFD1E666 0%, transparent 70%)" }}
            />
            <div
              className="aspect-square h-full w-full overflow-hidden rounded-full border bg-white shadow"
              style={{ borderColor: PINK_BORDER }}
            >
              <img
                src="/natori/IMG_3825.jpeg"
                alt="Natori portrait"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* === Text === */}
        <div className="md:col-span-2 leading-relaxed text-gray-700">
          <div
            className="mt-6 rounded-xl border p-5"
            style={{ borderColor: PINK_BORDER, backgroundColor: PINK_BG }}
          >
            <h3 className="font-medium">Nice to meet you, I’m Natori.</h3>
            <p className="mt-2 text-sm text-gray-600">
I specialize in drawing pop and cute girls as well as SD (super-deformed/chibi) characters.
From full-body illustrations and icons to game assets and illustrations that shine on merchandise, I create a wide range of artwork.
My goal is to deliver a “cute world that makes you happy just by looking at it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
