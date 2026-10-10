// src/components/Analytics.tsx
'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
import type { BeforeSendEvent } from '@vercel/analytics'
import { isAnalyticsExcludedPath } from '@/lib/analyticsPrivacy'
import { GA_ID, shouldBlockAnalytics } from '@/lib/analyticsPrivacy.client'

function useAnalyticsAllowed() {
  const pathname = usePathname()
  const [allowed, setAllowed] = useState(false)

  // Install the synchronous send guard before mounting any vendor script.
  useEffect(() => {
    setAllowed(pathname !== null && !shouldBlockAnalytics(pathname))
  }, [pathname])

  return allowed && !isAnalyticsExcludedPath(pathname)
}

export function Analytics() {
  const allowed = useAnalyticsAllowed()
  if (!allowed) return null
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
  const allowed = useAnalyticsAllowed()
  if (!allowed) return null
  return <VercelAnalytics beforeSend={filterAnalyticsEvent} />
}

function filterAnalyticsEvent(event: BeforeSendEvent) {
  return shouldBlockAnalytics(event.url) ? null : event
}
