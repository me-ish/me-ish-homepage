'use client';

import { Download, Image as ImageIcon, Clock } from 'lucide-react';

type Props = {
  labels: {
    sectionTitle: string;
    normalNote: string;
    normalDownloadBtn: string;
  };
  artworkHref: string;
};

export default function AssetsReceiveSection({ labels, artworkHref }: Props) {
  return (
    <section className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-[#00a1e9]" />
          <h2 className="text-sm font-semibold text-gray-900">{labels.sectionTitle}</h2>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#00a1e9]/10 to-[#00a1e9]/5 flex items-center justify-center">
            <Download className="w-5 h-5 text-[#00a1e9]" />
          </div>

          {/* Text + Button */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-600 leading-relaxed">{labels.normalNote}</p>

            {/* Expiry notice */}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
              <Clock className="w-3.5 h-3.5" />
              <span>リンクには有効期限があります</span>
            </div>

            {/* Download button */}
            <a
              href={artworkHref}
              className="
                inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl
                bg-[#00a1e9] text-white text-sm font-medium
                transition-all hover:bg-[#0090d4] active:scale-[0.98]
                shadow-sm hover:shadow-md
              "
            >
              <Download className="w-4 h-4" />
              {labels.normalDownloadBtn}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
