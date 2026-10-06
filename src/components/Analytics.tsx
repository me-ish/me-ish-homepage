// src/components/Analytics.tsx
'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
import { isAnalyticsExcludedPath } from '@/lib/analyticsPrivacy'

const GA_ID = 'G-EZR21G5Q2T'

export function Analytics() {
  const pathname = usePathname()
  const excluded = isAnalyticsExcludedPath(pathname)

  // If gtag is already loaded (arrived from a public page), stop its hits while on a private page.
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = excluded
  }, [excluded])

  if (excluded) return null
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  )
}

/** Vercel Web Analytics without token-bearing client page URLs. Mounted once in the root layout. */
export function SiteVercelAnalytics() {
  return <VercelAnalytics beforeSend={(event) => (isAnalyticsExcludedPath(event.url) ? null : event)} />
}
