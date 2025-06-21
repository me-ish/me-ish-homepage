'use client';

import { useState } from 'react';

type Props = {
  initialProfile: {
    display_name: string;
    sns_links: {
      twitter?: string;
      instagram?: string;
    };
  };
  onSave: (updated: { display_name: string; sns_links: any }) => void;
  onCancel: () => void;
};

export default function ProfileEditModal({ initialProfile, onSave, onCancel }: Props) {
  const [displayName, setDisplayName] = useState(initialProfile.display_name || '');
  const [twitter, setTwitter] = useState(initialProfile.sns_links.twitter || '');
  const [instagram, setInstagram] = useState(initialProfile.sns_links.instagram || '');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md space-y-4">
        <h2 className="text-xl font-bold">プロフィールを編集</h2>

        <div>
          <label className="block font-semibold mb-1">表示名</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            placeholder="例：K.Suzuki"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Twitter</label>
          <input
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            placeholder="https://x.com/yourname"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Instagram</label>
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            placeholder="https://instagram.com/yourname"
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded">キャンセル</button>
          <button
            onClick={() => onSave({
              display_name: displayName,
              sns_links: { twitter, instagram },
            })}
            className="px-4 py-2 bg-[#00a1e9] text-white rounded"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
