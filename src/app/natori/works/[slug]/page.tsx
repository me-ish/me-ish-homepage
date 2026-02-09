// app/natori/works/[slug]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Footer from "@/components/natori/Footer";
import { works } from "@/lib/natori/works";

type Props = { params: { slug: string } };

export function generateStaticParams() {
  return works.map(w => ({ slug: w.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const work = works.find(w => w.slug === params.slug);
  if (!work) return { title: "Work not found – Natori" };
  const title = `${work.title} – Natori`;
  const description = work.description;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: work.image }] },
    twitter: { card: "summary_large_image", title, description, images: [work.image] },
  };
}

export default function WorkDetail({ params }: Props) {
  const work = works.find(w => w.slug === params.slug);
  if (!work) return notFound();

  return (
    <main className="bg-white">
      <article className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <Link href="/natori" className="text-sm text-[#00a1e9] hover:underline">← Back to Portfolio</Link>
        <h1 className="mt-4 text-3xl font-semibold">{work.title}</h1>
        <p className="mt-2 text-gray-600">{work.description}</p>
        <div className="relative mt-6 aspect-[4/3] overflow-hidden rounded-2xl border bg-white shadow">
          <Image src={work.image} alt={work.title} fill className="object-cover" sizes="(max-width: 1280px) 100vw, 1200px" />
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {work.year && (<div><dt className="text-sm text-gray-500">Year</dt><dd className="font-medium">{work.year}</dd></div>)}
          {work.client && (<div><dt className="text-sm text-gray-500">Client</dt><dd className="font-medium">{work.client}</dd></div>)}
          {work.tags?.length ? (<div className="sm:col-span-2">
            <dt className="text-sm text-gray-500">Tags</dt>
            <dd className="mt-1 flex flex-wrap gap-2">{work.tags.map(t => (
              <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{t}</span>
            ))}</dd>
          </div>): null}
          {work.licenseNote && (<div className="sm:col-span-2">
            <dt className="text-sm text-gray-500">License</dt>
            <dd className="font-medium">{work.licenseNote}</dd>
          </div>)}
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          {work.vgenLink && (
            <Link href={work.vgenLink} className="rounded-full bg-[#00a1e9] px-5 py-2.5 text-white hover:opacity-90">
              この作品の雰囲気で依頼する（VGen）
            </Link>
          )}
          <Link href="mailto:hello@me-ish.art?subject=%E3%80%90%E3%83%8A%E3%83%88%E3%83%AA%E4%BD%9C%E5%93%81%E4%BE%9D%E9%A0%BC%E3%80%91" className="rounded-full border border-gray-300 px-5 py-2.5 text-gray-700 hover:bg-gray-50">
            直接相談する
          </Link>
        </div>
      </article>
      <Footer />
    </main>
  );
}
