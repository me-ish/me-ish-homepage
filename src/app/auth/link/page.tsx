import { redirect } from 'next/navigation';
import { getLegacyPauseDestination } from '@/lib/legacyServiceSuspension';

// This legacy gallery ownership link is distinct from /auth/callback, which
// remains available for Natori and existing customer support.
export default function LinkExternalPage() {
  redirect(getLegacyPauseDestination('/auth/link', 'gallery'));
}
