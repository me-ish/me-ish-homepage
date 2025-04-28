import React from 'react';
import { useFormContext } from 'react-hook-form';

const Step1_ArtistInfo = () => {
  const { register } = useFormContext();

  return (
    <div className="step1-artist-info">
      {/* 作家名 */}
      <label className="form-label">
        作家名（公開名）
        <span className="required-inline">※必須</span>
        <input
          className="form-input"
          placeholder="例）山田 太郎 / Taro Yamada"
          {...register('artistName', { required: true })}
        />
      </label>

      {/* メールアドレス */}
      <label className="form-label">
        メールアドレス
        <span className="required-inline">※必須</span>
        <input
          type="email"
          className="form-input"
          placeholder="例）example@domain.com"
          {...register('email', { required: true })}
        />
      </label>

      {/* ホームページ */}
      <label className="form-label">
        ホームページURL（任意）
      </label>
      <input
        className="form-input"
        {...register('homepageUrl')}
        placeholder="例）https://your-portfolio.com"
      />

      {/* X（旧Twitter） */}
      <label className="form-label">
        X（旧Twitter）URL（任意）
      </label>
      <input
        className="form-input"
        {...register('twitterUrl')}
        placeholder="例）https://x.com/yourusername"
      />

      {/* Instagram */}
      <label className="form-label">
        Instagram URL（任意）
      </label>
      <input
        className="form-input"
        {...register('instagramUrl')}
        placeholder="例）https://instagram.com/yourusername"
      />
    </div>
  );
};

export default Step1_ArtistInfo;
