'use client';

export default function CloseTabFooter() {
  return (
    <footer className="mt-10 flex flex-wrap gap-3 text-sm">
      <button
        type="button"
        onClick={() => window.close()}
        className="inline-flex items-center justify-center rounded-full border border-[#00a1e9]/40 bg-white px-4 py-2 text-[#00a1e9] hover:bg-[#00a1e9]/5 hover:border-[#00a1e9]/60 transition"
      >
        タブを閉じる
      </button>
    </footer>
  );
}
