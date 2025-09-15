// src/app/claim/[id]/page.tsx
import type { Metadata } from 'next';
import ClaimClient from './ClaimClient';

export const metadata: Metadata = {
  title: 'NFT受け取り | me-ish',
  description: '購入したNFTの受け取りページです。',
};

export default function ClaimPage({ params, searchParams }: {
  params: { id: string },
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const id = params.id;
  const token = typeof searchParams?.t === 'string' ? searchParams?.t : undefined;

  return (
    <main className="min-h-[70vh] px-4 py-10 md:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            購入NFTの受け取り
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            注文後に発行された受け取りページです。ウォレットをお持ちの方はアドレスで、未所持の方はメールで受け取りできます。
          </p>
        </header>

        <ClaimClient entryId={id} token={token} />
      </div>
    </main>
  );
}

