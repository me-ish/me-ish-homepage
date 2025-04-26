import React, { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

const Step2_WorkInfo = () => {
  const { register, setValue, watch } = useFormContext();
  const image = watch('image');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let file = null;
    if (Array.isArray(image) && image.length > 0) file = image[0];
    else if (image instanceof File) file = image;
    else if (image?.name) file = image;

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, [image]);

  return (
    <div className="form-step">
      {/* ✅ ギャラリー選択追加 */}
      <label className="form-label">
        応募先ギャラリー <span className="required-inline">※必須</span>
        <select
          className="form-input"
          {...register('gallery_type', { required: true })}
          defaultValue=""
        >
          <option value="" disabled>選択してください</option>
          <option value="white">ホワイトギャラリー（White Gallery）</option>
          <option value="float">フロートギャラリー（Float Gallery）</option>
        </select>
      </label>

      <label className="form-label">
        作品タイトル <span className="required-inline">※必須</span>
        <input
          className="form-input"
          {...register('title', { required: true })}
          placeholder="作品のタイトルを入力"
        />
      </label>

      <label className="form-label">
        作品画像（jpg/png、10MB以下、推奨サイズ：1200px以上） <span className="required-inline">※必須</span>
        <input
          type="file"
          accept="image/*"
          className="form-file"
          onChange={(e) => {
            const file = e.target.files[0];
            setValue('image', file);
          }}
        />
      </label>

      {preview && (
        <div className="preview-box">
          <strong>プレビュー：</strong><br />
          <img src={preview} alt="preview" className="preview-image" />
        </div>
      )}

      <label className="form-label">
        作品説明（任意）
        <textarea
          rows={5}
          className="form-textarea"
          placeholder="作品のコンセプトやメッセージがあればご記入ください"
          {...register('description')}
        />
      </label>
    </div>
  );
};

export default Step2_WorkInfo;
