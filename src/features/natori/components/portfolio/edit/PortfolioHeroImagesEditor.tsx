"use client";

import { ImageUploadField } from "./editorFields";
import SortableList from "./SortableList";

const MAX_HERO_IMAGES = 5;

export default function PortfolioHeroImagesEditor({
  images,
  onChange,
  uploadDisabled,
}: {
  images: string[];
  onChange: (next: string[]) => void;
  uploadDisabled?: boolean;
}) {
  const normalized = images.filter((image) => image.length > 0).slice(0, MAX_HERO_IMAGES);

  const updateAt = (index: number, value: string | null) => {
    if (value === null) {
      onChange(normalized.filter((_, itemIndex) => itemIndex !== index));
      return;
    }
    onChange(normalized.map((image, itemIndex) => (itemIndex === index ? value : image)));
  };

  return (
    <div>
      <p className="text-sm font-black text-gray-900">Heroスライダー</p>
      <p className="mt-1 text-xs leading-5 text-gray-600">
        最大5枚。先頭の画像が最初に表示され、公開ページでは自動・手動で切り替えられます。
        ドラッグすると表示順を変更できます。
      </p>

      {normalized.length > 0 ? (
        <SortableList
          items={normalized}
          onReorder={onChange}
          className="mt-4 space-y-3"
          renderRow={(image, index, handle) => (
            <div className="flex items-start gap-2 rounded-xl border border-pink-100 bg-pink-50/30 p-3">
              <div className="pt-6">{handle}</div>
              <div className="min-w-0 flex-1">
                <ImageUploadField
                  label={`Hero画像 ${index + 1}${index === 0 ? "（初期表示）" : ""}`}
                  value={image}
                  onChange={(value) => updateAt(index, value)}
                  shape="square"
                  hint={index === 0 ? "この画像がページを開いたとき最初に表示されます" : undefined}
                  uploadDisabled={uploadDisabled}
                />
              </div>
            </div>
          )}
        />
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-pink-200 bg-pink-50/30 px-3 py-3 text-xs text-gray-500">
          Hero画像は未設定です。下から1枚目を追加できます。
        </p>
      )}

      {normalized.length < MAX_HERO_IMAGES ? (
        <div className="mt-4 rounded-xl border border-pink-100 bg-white p-3">
          <ImageUploadField
            label={`Hero画像を追加（${normalized.length}/${MAX_HERO_IMAGES}）`}
            value={null}
            onChange={(value) => {
              if (value) onChange([...normalized, value]);
            }}
            shape="square"
            hint="縦長・横長でも公開ページでは全体が見えるように表示します"
            uploadDisabled={uploadDisabled}
          />
        </div>
      ) : (
        <p className="mt-3 text-xs font-bold text-pink-700">Hero画像は最大5枚まで設定できます。</p>
      )}
    </div>
  );
}
