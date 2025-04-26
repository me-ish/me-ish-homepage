import React, { useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';

const Step3_SalesAndAgreement = () => {
  const { register, watch } = useFormContext();
  const isForSale = watch('isForSale');
  const saleType = watch('saleType');

  const [canCheck, setCanCheck] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const isBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if (isBottom) setCanCheck(true);
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="form-step">
      <label className="form-label">
        この作品を販売しますか？
        <span className="required-inline">※必須</span><br />
        <label><input type="radio" value="yes" {...register('isForSale', { required: true })} /> はい</label>&nbsp;&nbsp;
        <label><input type="radio" value="no" {...register('isForSale', { required: true })} /> いいえ</label>
      </label>

      {isForSale === 'yes' && (
        <>
          <label className="form-label">
            販売形式 <span className="required-inline">※必須</span><br />
            <label><input type="radio" value="normal" {...register('saleType', { required: true })} /> 通常販売</label>&nbsp;&nbsp;
            <label><input type="radio" value="nft" {...register('saleType', { required: true })} /> NFT販売</label>
          </label>

          <label className="form-label">
            販売価格（円・税込） <span className="required-inline">※必須</span><br />
            <input
              type="number"
              min="0"
              className="form-input"
              {...register('price', { required: true })}
              placeholder="例：5000"
            />
            <small style={{ color: '#666' }}>※円単位で半角数字のみ / 税込価格</small>
          </label>

          {saleType === 'nft' && (
            <label className="form-label">
              ウォレットアドレス（任意）<br />
              <input
                type="text"
                className="form-input"
                {...register('wallet')}
                placeholder="0x..."
              />
            </label>
          )}
        </>
      )}

      <hr style={{ margin: '2rem 0' }} />

      <div
        className="terms-box"
        ref={scrollRef}
        style={{
          maxHeight: '150px',
          overflowY: 'auto',
          border: '1px solid #ccc',
          padding: '1rem',
          borderRadius: '8px',
          background: '#fafafa',
        }}
      >
        <p><strong>【利用規約（抜粋）】</strong></p>
        <p>
          本サービスに投稿された作品は、運営による展示・販売の対象となります。
          著作権はアーティストに帰属しますが、me-ishギャラリー内での使用に同意したものとみなします。
          詳細は公式サイトをご確認ください。
        </p>
        <p>
          ・第三者の著作権、商標権、肖像権等を侵害しないこと<br />
          ・AIによる自動生成作品は禁止<br />
          ・審査結果により展示が見送りになる場合があります
        </p>
      </div>

      <div className="checkbox-row">
        <input
          type="checkbox"
          {...register('agreeTerms', { required: true })}
          disabled={!canCheck}
        />
        <span>利用規約に同意します</span>
        <span className="required-inline">※必須</span>
      </div>

      <div className="checkbox-row">
        <input type="checkbox" {...register('confirmRights', { required: true })} />
        <span>自作作品であり、第三者の権利を侵害していません</span>
        <span className="required-inline">※必須</span>
      </div>

      <div className="checkbox-row">
        <input type="checkbox" {...register('confirmOriginal', { required: true })} />
        <span>AIによる自動生成作品ではありません</span>
        <span className="required-inline">※必須</span>
      </div>
    </div>
  );
};

export default Step3_SalesAndAgreement;
