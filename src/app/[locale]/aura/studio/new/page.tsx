// src/app/[locale]/aura/studio/new/page.tsx
import StudioWizard from '@/components/aura/studio/StudioWizard';

export const metadata = {
  title: 'AURA Studio - ポートフォリオを作成',
  description: '4ステップでポートフォリオを作成・公開できます。',
};

export default function StudioNewPage() {
  return <StudioWizard />;
}
