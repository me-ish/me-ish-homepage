// src/app/(marketing)/contact/page.tsx
import ContactForm from '@/components/contact/ContactForm';

export const metadata = {
  title: 'お問い合わせフォーム | me-ish',
  description: 'お問い合わせはこちらからお送りください。',
};

export default function ContactFormPage() {
  return (
    <section className="min-h-screen bg-white px-6 py-20 text-center">
      <h1 className="mb-8 text-2xl font-bold text-[#00a1e9]">お問い合わせフォーム</h1>
      <ContactForm />
    </section>
  );
}
