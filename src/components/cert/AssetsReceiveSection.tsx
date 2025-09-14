'use client';
import { useCallback } from 'react';

type Props = {
  salesType: 'normal' | 'nft';
  labels: {
    sectionTitle: string;
    normalNote: string;
    normalDownloadBtn: string;
    nftNote: string;
    nftConnectBtn: string;
    nftGasNote: string;
  };
  artworkHref: string;
  /** 追加：サーバーからは関数ではなくURL文字列で渡す */
  claimHref?: string;
  /** 既存互換：まだ一部で使っていたら生かしておく（Client からだけ使える） */
  onNftClaim?: () => void;
  showOffchainDownloadInNft?: boolean;
};

export default function AssetsReceiveSection({
  salesType,
  labels,
  artworkHref,
  claimHref,
  onNftClaim,
  showOffchainDownloadInNft = false,
}: Props) {
  const handleClaim = useCallback(() => {
    if (onNftClaim) {
      onNftClaim();
      return;
    }
    if (claimHref) {
      // Client 側で安全に遷移
      location.href = claimHref;
    }
  }, [onNftClaim, claimHref]);

  return (
    <section className="rounded-2xl border border-gray-200 p-6 bg-white">
      <h2 className="font-semibold mb-2">{labels.sectionTitle}</h2>

      {salesType === 'normal' ? (
        <>
          <p className="text-sm text-gray-700 mb-3">{labels.normalNote}</p>
          <a
            className="inline-block px-4 py-2 rounded-xl bg-black text-white"
            href={artworkHref}
          >
            {labels.normalDownloadBtn}
          </a>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-700 mb-3">{labels.nftNote}</p>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-black text-white"
            onClick={handleClaim}
          >
            {labels.nftConnectBtn}
          </button>
          <p className="text-xs text-gray-500 mt-2">{labels.nftGasNote}</p>

          {showOffchainDownloadInNft && (
            <a
              className="mt-3 inline-block px-3 py-1 rounded-lg bg-gray-200"
              href={artworkHref}
            >
              {labels.normalDownloadBtn}
            </a>
          )}
        </>
      )}
    </section>
  );
}
