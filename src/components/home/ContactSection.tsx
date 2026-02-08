'use client';

import React from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/shared/SectionHeader';

export function ContactSection({ variant }: { variant: 'desktop' | 'mobile' }) {
  if (variant === 'desktop') {
    return (
      <section
        id="contact"
        className="fade-in-up py-20 md:py-28 px-6 bg-white"
        aria-labelledby="contact-title"
      >
        <div className="mx-auto w-full max-w-[1200px] px-6">
          <div className="max-w-2xl mx-auto text-center">
            <SectionHeader
              title="お問い合わせ"
              id="contact-title"
              subtitle="ご質問・ご相談などございましたら、お気軽にご連絡ください。"
              underline
            />

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="rounded-full px-8 py-4 h-auto text-base shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Link href="/contact">
                  <Mail className="h-5 w-5 mr-2" />
                  お問い合わせフォーム
                </Link>
              </Button>

              <a
                href="https://x.com/meishart0716"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-[#00a1e9] hover:text-white transition-all duration-300"
                aria-label="X（旧Twitter）"
              >
                <FaXTwitter className="h-6 w-6" />
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // mobile
  return (
    <section
      id="contact"
      className="fade-in-up px-5 py-12"
      aria-labelledby="contact-title"
    >
      <div className="mx-auto w-full max-w-[680px]">
        <SectionHeader
          title="お問い合わせ"
          id="contact-title"
          subtitle="ご質問などございましたらお気軽に"
        />

        <div className="flex flex-col gap-3">
          <Button
            asChild
            className="w-full rounded-full py-5 h-auto shadow-md"
          >
            <Link href="/contact">
              <Mail className="h-4 w-4 mr-2" />
              お問い合わせフォーム
            </Link>
          </Button>

          <a
            href="https://x.com/meishart0716"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-4 rounded-full bg-gray-100 text-gray-700 font-medium active:bg-gray-200 transition-colors"
          >
            <FaXTwitter className="h-4 w-4" />
            X（旧Twitter）
          </a>
        </div>
      </div>
    </section>
  );
}
