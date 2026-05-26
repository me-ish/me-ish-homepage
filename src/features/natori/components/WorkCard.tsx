// components/natori/WorkCard.tsx
import Image from "next/image";
import Link from "next/link";
import type { Work } from "@/lib/natori/works";

export default function WorkCard({ work }: { work: Work }) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-white shadow-sm hover:shadow-md transition"
             style={{ borderColor: "#F7DCE6" }}>
      <Link href={`/natori/works/${work.slug}`}>
        <div className="relative aspect-[4/3] w-full overflow-hidden" style={{ backgroundColor: "#FFF5F9" }}>
          <Image src={work.image} alt={work.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
        </div>
      </Link>
      <div className="p-4">
        <h3 className="font-medium">{work.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-gray-600">{work.description}</p>
        {work.tags?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {work.tags.map(t => (
              <span key={t} className="rounded-full px-2 py-0.5 text-xs"
                    style={{ background: "#FFE5F0", color: "#7A2843" }}>
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
