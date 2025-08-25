// src/app/news/_components/NewsList.tsx
'use client';
import { useSearchParams } from 'next/navigation';

export default function NewsList() {      // ← default であること
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  return <div>NewsList {q && `(q=${q})`}</div>;
}
