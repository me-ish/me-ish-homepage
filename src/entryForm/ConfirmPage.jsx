import React from 'react';
import { useFormContext } from 'react-hook-form';

const ConfirmPage = ({ onBack, onSubmit }) => {
  const { getValues } = useFormContext();
  const data = getValues();

  return (
    <div className="form-step">
      <h2 className="form-title">最終確認</h2>
      <p>以下の内容でよろしければ「送信する」を押してください。</p>

      {/* アーティスト情報 */}
      <div className="confirm-section">
        <h3>アーティスト情報</h3>
        <p><strong>作家名：</strong>{data.artistName}</p>
        <p><strong>メール：</strong>{data.email}</p>

        {/* SNSリンク表示（新仕様） */}
        {(data.homepageUrl || data.twitterUrl || data.instagramUrl) ? (
          <>
            {data.homepageUrl && (
              <p><strong>ホームページ：</strong>{data.homepageUrl}</p>
            )}
            {data.twitterUrl && (
              <p><strong>X（旧Twitter）：</strong>{data.twitterUrl}</p>
            )}
            {data.instagramUrl && (
              <p><strong>Instagram：</strong>{data.instagramUrl}</p>
            )}
          </>
        ) : (
          <p><strong>SNS / ポートフォリオ：</strong>未入力</p>
        )}
      </div>

      {/* 作品情報 */}
      <div className="confirm-section">
        <h3>作品情報</h3>
        <p><strong>タイトル：</strong>{data.title}</p>
        {data.description && <p><strong>説明：</strong>{data.description}</p>}
        {data.year && <p><strong>制作年：</strong>{data.year}</p>}
        {data.image && (
          <div style={{ marginTop: '1rem' }}>
            <strong>画像：</strong><br />
            <img
              src={URL.createObjectURL(data.image)}
              alt="preview"
              style={{ maxWidth: '100%', borderRadius: '8px' }}
            />
          </div>
        )}
      </div>

      {/* 販売情報 */}
      <div className="confirm-section">
  <h3>販売情報</h3>
  <p><strong>販売する？：</strong>{data.isForSale === 'yes' ? 'はい' : 'いいえ'}</p>

  {data.isForSale === 'yes' ? (
    <>
      <p><strong>形式：</strong>{data.saleType === 'nft' ? 'NFT販売' : '通常販売'}</p>
      <p><strong>価格：</strong>{data.price} 円</p>
      {data.saleType === 'nft' && data.wallet && (
        <p><strong>ウォレット：</strong>{data.wallet}</p>
      )}
    </>
  ) : (
    <p><strong>価格：</strong>非売品</p>
  )}
</div>

      <div className="form-nav">
  <button type="button" onClick={onBack}>戻る</button>
  <button type="button" onClick={onSubmit}>送信する</button> {/* ←ここだけ修正 */}
</div>



    </div>
  );
};

export default ConfirmPage;
