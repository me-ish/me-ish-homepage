import React from 'react'
import { useZoomArtwork } from './ZoomArtworkContext'

export default function ZoomArtworkDisplay() {
  const { zoomedArtwork, setZoomedArtwork } = useZoomArtwork()

  if (!zoomedArtwork || !zoomedArtwork.imageUrl) return null

  const {
    imageUrl,
    title = 'Untitled',
    author = 'Unknown',
    description = '',
    price = null,
    is_for_sale = false,
    sns_links = '{}',
    id = null,
    created_at = null,
  } = zoomedArtwork

  // SNSリンクをパース
  let links = {}
  try {
    links = JSON.parse(sns_links)
  } catch (e) {
    console.error('SNSリンクのパースに失敗:', e)
  }

  const formattedDate = created_at
    ? new Date(created_at).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '登録日不明'

  return (
    <div
      onClick={() => setZoomedArtwork(null)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2vw',
        padding: '5vh 5vw',
        zIndex: 1000,
        cursor: 'zoom-out',
        color: '#fff',
        fontFamily: 'sans-serif',
        overflowY: 'auto',
      }}
    >
      {/* 🖼 画像エリア */}
      <div style={{
        width: '45vw',
        height: '80vh',
        backgroundColor: '#111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '10px',
      }}>
        <img
          src={imageUrl}
          alt={title}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: '10px',
          }}
        />
      </div>

      {/* 📄 情報エリア */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '30vw',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {/* タイトルと作家名 */}
        <h2 style={{ fontSize: '2rem', margin: 0 }}>{title}</h2>
        <h3 style={{ fontSize: '1.2rem', margin: '0.5rem 0', color: '#aaa' }}>
          by {author}
        </h3>

        {/* シリアル番号と登録日 */}
        <div style={{ fontSize: '0.9rem', color: '#ccc' }}>
          {id && <div>シリアル番号: #{String(id).padStart(3, '0')}</div>}
          <div>登録日: {formattedDate}</div>
        </div>

        {/* 作品紹介 */}
        {description && (
          <p style={{ fontSize: '1rem', lineHeight: 1.6 }}>
            {description}
          </p>
        )}

        {/* 価格表示＋購入ボタン */}
        {is_for_sale && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#ffd700' }}>
              {price ? `${Number(price).toLocaleString()}円（税込）` : '販売中'}
            </p>
            <button
              style={{
                padding: '0.6rem 1.2rem',
                fontSize: '1rem',
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                marginTop: '0.5rem',
                width: '100%',
              }}
              onClick={() => alert('購入機能は準備中です')}
            >
              購入する
            </button>
          </div>
        )}

        {/* 🌐 SNSリンク */}
        {Object.keys(links).length > 0 && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {links.homepage && (
              <a href={links.homepage} target="_blank" rel="noopener noreferrer" style={linkButtonStyle}>
                🔗 ホームページ
              </a>
            )}
            {links.twitter && (
              <a href={links.twitter} target="_blank" rel="noopener noreferrer" style={linkButtonStyle}>
                🌟 X（旧Twitter）
              </a>
            )}
            {links.instagram && (
              <a href={links.instagram} target="_blank" rel="noopener noreferrer" style={linkButtonStyle}>
                📸 Instagram
              </a>
            )}
          </div>
        )}

        {/* ❤️ いいねボタン */}
        <div style={{ marginTop: '2rem' }}>
          <button
            style={{
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              backgroundColor: '#ff66aa',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              width: '100%',
            }}
            onClick={() => alert('いいね機能は準備中です')}
          >
            ❤️ いいね
          </button>
        </div>

      </div>
    </div>
  )
}

const linkButtonStyle = {
  display: 'inline-block',
  padding: '0.6rem 1.2rem',
  backgroundColor: '#00c0e0',
  color: '#fff',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '0.95rem',
  textAlign: 'center',
  width: '100%',        // 🆙 ボタン幅統一
}
