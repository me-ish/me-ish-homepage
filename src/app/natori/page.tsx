// app/natori/page.tsx
import type { Metadata } from "next";
import Hero from "@/components/natori/Hero";
import Gallery from "@/components/natori/Gallery";
import About from "@/components/natori/About";
import Footer from "@/components/natori/Footer";
import { works } from "@/lib/natori/works";
import { allTags } from "@/lib/natori/works";

const title = "Natori Portfolio – me-ish";
const description = "イラストレーター ナトリのポートフォリオ。透明感のある光と色。VGenからの依頼も受付中。";
const siteUrl = "https://www.me-ish.art/natori";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: siteUrl,
    images: [{ url: "/natori/og.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/natori/og.jpg"],
  },
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Natori",
    "jobTitle": "Illustrator & Designer",
    "image": "https://www.me-ish.art/natori/portrait.jpg",
    "url": siteUrl,
    "worksFor": {
      "@type": "Organization",
      "name": "me-ish"
    }
  };

  return (
    <main className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero
        vgenUrl="https://vgen.co/natori/characters"  // ← 実際のプロフィールURLに差し替えてください
        twitterUrl="https://x.com/natonato_o/"
        instaUrl="https://www.instagram.com/natori.o0716?igsh=cmVwejB5OG00d3hn&utm_source=qr"
      />
      <Gallery works={works} tags={allTags} />
      <About />
      <Footer />
    </main>
  );
}
