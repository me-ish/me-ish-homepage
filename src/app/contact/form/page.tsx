// app/contact/form/page.tsx
import ContactForm from '@/components/ContactForm';

export default function ContactFormPage() {
  return (
    <main className="min-h-screen bg-white py-20 px-6 text-center">
      <h1 className="text-2xl font-bold text-[#00a1e9] mb-8">お問い合わせフォーム</h1>
      <ContactForm />
    </main>
  );
}
