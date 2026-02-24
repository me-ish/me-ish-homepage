'use client';

import React from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export function ContactSection({ variant }: { variant: 'desktop' | 'mobile' }) {
  const t = useTranslations('home.contact');

  if (variant === 'desktop') {
    return (
      <section
        id="contact"
        className="fade-in-up relative overflow-hidden bg-[#07111f] py-28 px-6"
        aria-labelledby="contact-title"
      >
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-[20%] left-1/2 -translate-x-1/2 rounded-full opacity-25"
            style={{
              width: '60vw',
              height: '60vw',
              background: 'radial-gradient(circle, rgba(0,161,233,0.5) 0%, transparent 65%)',
            }}
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6">
          <div className="mx-auto max-w-2xl text-center">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs tracking-widest text-white/50 uppercase">
              <Mail className="h-3 w-3" />
              Contact
            </div>

            <h2
              id="contact-title"
              className="text-4xl font-bold leading-tight text-white md:text-5xl"
            >
              {t('title')}
            </h2>
            <p className="mt-4 text-lg text-white/40">
              {t('subtitle')}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-auto rounded-full px-8 py-4 text-base bg-[#00a1e9] hover:bg-[#0090d4] text-white shadow-[0_0_32px_rgba(0,161,233,0.35)] transition-all duration-300 hover:shadow-[0_0_48px_rgba(0,161,233,0.5)]"
              >
                <Link href="/contact">
                  <Mail className="mr-2 h-5 w-5" />
                  {t('form')}
                </Link>
              </Button>

              <a
                href="https://x.com/meishart0716"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/15 px-6 py-3.5 text-white/60 transition-all duration-300 hover:border-white/35 hover:text-white"
                aria-label={t('xAriaLabel')}
              >
                <FaXTwitter className="h-5 w-5" />
                {t('xLabel')}
              </a>
            </div>
          </div>
        </div>

        {/* Bottom credit */}
        <p className="relative z-10 mt-20 text-center text-xs text-white/15">
          © {new Date().getFullYear()} me-ish
        </p>
      </section>
    );
  }

  // mobile
  return (
    <section
      id="contact"
      className="fade-in-up relative overflow-hidden bg-[#07111f] px-5 py-16"
      aria-labelledby="contact-title"
    >
      {/* Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-[30%] left-1/2 -translate-x-1/2 rounded-full opacity-20"
          style={{
            width: '120vw',
            height: '120vw',
            background: 'radial-gradient(circle, rgba(0,161,233,0.5) 0%, transparent 65%)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[680px]">
        {/* Badge */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] tracking-widest text-white/40 uppercase">
            <Mail className="h-3 w-3" />
            Contact
          </div>
        </div>

        <h2
          id="contact-title"
          className="mb-2 text-center text-2xl font-bold text-white"
        >
          {t('title')}
        </h2>
        <p className="mb-8 text-center text-sm text-white/40">
          {t('subtitle')}
        </p>

        <div className="flex flex-col gap-3">
          <Button
            asChild
            className="h-auto w-full rounded-full py-4 text-base bg-[#00a1e9] hover:bg-[#0090d4] text-white shadow-[0_0_24px_rgba(0,161,233,0.3)] active:scale-[0.98] transition-all"
          >
            <Link href="/contact">
              <Mail className="mr-2 h-4 w-4" />
              {t('form')}
            </Link>
          </Button>

          <a
            href="https://x.com/meishart0716"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-full border border-white/15 py-4 text-white/60 font-medium transition-all active:scale-[0.98] hover:border-white/30 hover:text-white/80"
            aria-label={t('xAriaLabel')}
          >
            <FaXTwitter className="h-4 w-4" />
            {t('xLabel')}
          </a>
        </div>
      </div>

      {/* Bottom credit */}
      <p className="relative z-10 mt-12 text-center text-xs text-white/15">
        © {new Date().getFullYear()} me-ish
      </p>
    </section>
  );
}
