'use client';

type Props = {
  labels: {
    sectionTitle: string;
    normalNote: string;
    normalDownloadBtn: string;
  };
  artworkHref: string;
};

export default function AssetsReceiveSection({
  labels,
  artworkHref,
}: Props) {
  return (
    <section className="rounded-2xl border border-gray-200 p-6 bg-white">
      <h2 className="font-semibold mb-2">{labels.sectionTitle}</h2>
      <p className="text-sm text-gray-700 mb-3">{labels.normalNote}</p>
      <a
        className="inline-block px-4 py-2 rounded-xl bg-black text-white"
        href={artworkHref}
      >
        {labels.normalDownloadBtn}
      </a>
    </section>
  );
}
