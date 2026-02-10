import type { ReactNode } from 'react';
import SalesGuidelineLink from '@/components/entryForm/SalesGuidelineLink';

export default function EntryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <SalesGuidelineLink variant="floating" href="/guides/sales" />
    </>
  );
}
