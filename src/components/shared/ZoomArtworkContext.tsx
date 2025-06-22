'use client';

import React, { createContext, useContext, useState } from 'react';

// 🖼 拡大表示用アートワークの型定義
// 🖼 拡大表示用アートワークの型定義
export interface ZoomedArtwork {
  id: string;
  imageUrl: string;
  title: string;
  author: string;
  description?: string;
  price?: number;
  is_for_sale?: boolean;
  sns_links?: string;
  created_at?: string;
  is_sold?: boolean;
  sale_type?: 'normal' | 'nft';
  token_id?: string;
  width?: number;
  height?: number;
  likes?: number;
  edition_total?: number;
  edition_sold?: number;
}

interface ZoomArtworkContextType {
  zoomedArtwork: ZoomedArtwork | null;
  setZoomedArtwork: (artwork: ZoomedArtwork | null) => void;
}

// 🌀 コンテキスト作成
const ZoomArtworkContext = createContext<ZoomArtworkContextType | undefined>(undefined);

// 💡 Provider：ラップすることで子コンポーネントでuseZoomArtworkが使える
export const ZoomArtworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [zoomedArtwork, setZoomedArtwork] = useState<ZoomedArtwork | null>(null);

  return (
    <ZoomArtworkContext.Provider value={{ zoomedArtwork, setZoomedArtwork }}>
      {children}
    </ZoomArtworkContext.Provider>
  );
};

// 🧠 フック化されたコンテキストアクセス
export const useZoomArtwork = (): ZoomArtworkContextType => {
  const context = useContext(ZoomArtworkContext);
  if (!context) {
    throw new Error('useZoomArtwork must be used within a ZoomArtworkProvider');
  }
  return context;
};