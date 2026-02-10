import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/shared/SectionHeader';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FAQ_ITEMS } from './FAQData';

export function FAQSection({ variant }: { variant: 'desktop' | 'mobile' }) {
  const isDesktop = variant === 'desktop';

  if (isDesktop) {
    return (
      <section
        id="faq"
        className="fade-in-up py-20 md:py-28 px-6 bg-gradient-to-b from-gray-50 to-white"
        aria-labelledby="faq-title"
      >
        <div className="mx-auto w-full max-w-[1200px] px-6">
          <SectionHeader title="よくある質問" id="faq-title" underline />

          <div className="max-w-[880px] mx-auto">
            <Accordion type="single" collapsible defaultValue="item-0" className="space-y-4">
              {FAQ_ITEMS.map(({ q, a }, idx) => (
                <AccordionItem
                  key={idx}
                  value={`item-${idx}`}
                  className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden"
                >
                  <AccordionTrigger className="px-6 py-5 text-left font-semibold text-gray-900 hover:no-underline hover:bg-gray-50 transition-colors">
                    <span className="flex items-center gap-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00a1e9]/10 flex items-center justify-center text-[#00a1e9] font-bold text-sm">
                        Q
                      </span>
                      {q}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-5 text-gray-600 leading-relaxed">
                    <div className="pl-11">{a}</div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="mt-10 text-center">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full border-[#00a1e9] text-[#00a1e9] hover:bg-[#00a1e9] hover:text-white transition-all duration-300"
            >
              <Link href="/footer/faq">
                すべてのFAQを見る <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // mobile
  return (
    <section
      id="faq"
      className="fade-in-up px-5 py-12 bg-gray-50"
      aria-labelledby="faq-title"
    >
      <div className="mx-auto w-full max-w-[680px]">
        <SectionHeader title="よくある質問" id="faq-title" />

        <Accordion type="single" collapsible className="space-y-2">
          {FAQ_ITEMS.map(({ q, a }, idx) => (
            <AccordionItem
              key={idx}
              value={`q${idx + 1}`}
              className="rounded-xl bg-white ring-1 ring-gray-100 overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-4 text-left text-sm font-semibold text-gray-900 hover:no-underline">
                <span className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00a1e9]/10 flex items-center justify-center text-[#00a1e9] font-bold text-xs">
                    Q
                  </span>
                  {q}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">
                <div className="pl-8">{a}</div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-6 text-center">
          <Button
            asChild
            variant="outline"
            className="rounded-full border-[#00a1e9] text-[#00a1e9]"
          >
            <Link href="/footer/faq">
              もっと見る <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
