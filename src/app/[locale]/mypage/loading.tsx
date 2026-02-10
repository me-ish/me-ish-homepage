import { Loader2 } from 'lucide-react';

export default function MypageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      <span className="ml-2 text-gray-500">読み込み中...</span>
    </div>
  );
}
