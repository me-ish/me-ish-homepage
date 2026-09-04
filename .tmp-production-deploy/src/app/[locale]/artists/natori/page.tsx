// src/app/artists/natori/page.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Heart, Sparkles, Star, Mail, Images, ShoppingBag, Twitter, BadgeCheck } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

// --- Optional: If you use Next Metadata in App Router, keep this for good SEO ---
// export const metadata: Metadata = {
//   title: 'ナトリ | me-ish 専属アーティスト',
//   description: 'me-ish 専属アーティスト「ナトリ」のプロフィールと作品一覧。かわいらしさとやわらかい世界観。',
// }

// --- Types (align softly with your current schema; safe fallbacks included) ---
interface Profile {
  id: string
  display_name: string
  bio?: string | null
  avatar_url?: string | null
  sns_links?: {
    homepage?: string
    twitter?: string
    instagram?: string
  } | null
}

interface Entry {
  id: number
  title: string
  image_url: string
  confirmed?: boolean
  display_ready?: boolean
  likes?: number
  price?: number | null
  edition_total?: number | null
  edition_sold?: number | null
  gallery_type?: string | null
}

export default function NatoriArtistPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [likeBusy, setLikeBusy] = useState<number | null>(null)

  // Derived stats
  const stats = useMemo(() => {
    const totalLikes = entries.reduce((acc, e) => acc + (e.likes ?? 0), 0)
    const totalWorks = entries.length
    const sold = entries.reduce((acc, e) => {
      const t = e.edition_total ?? null
      const s = e.edition_sold ?? 0
      if (t !== null && t > 0 && s >= t) return acc + 1
      return acc
    }, 0)
    return { totalLikes, totalWorks, sold }
  }, [entries])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        // 1) Try to find a profile for display_name === 'ナトリ'
        const { data: prof, error: pErr } = await supabase
          .from('profiles')
          .select('id, display_name, bio, avatar_url, sns_links')
          .eq('display_name', 'ナトリ')
          .maybeSingle()

        if (prof) setProfile(prof as Profile)

        // 2) Load entries (confirmed & display_ready) for ナトリ
        let query = supabase
          .from('entries')
          .select('id, title, image_url, likes, price, edition_total, edition_sold, gallery_type, confirmed, display_ready')
          .eq('confirmed', true)
          .eq('display_ready', true)
          .order('id', { ascending: false })

        if (prof?.id) {
          query = query.eq('profile_id', prof.id as any)
        } else {
          // fallback if schema uses artist_name string column
          query = query.eq('artist_name', 'ナトリ')
        }

        const { data: works, error: wErr } = await query
        setEntries((works ?? []) as Entry[])
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const handleLike = async (id: number) => {
    // Simple optimistic like. Replace with your real API when ready.
    try {
      setLikeBusy(id)
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, likes: (e.likes ?? 0) + 1 } : e)))
      // Optionally call your API route: await fetch('/api/like', ...)
    } finally {
      setLikeBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-[#f7fbff] to-white">
      <DecorativeBg />

      {/* Header / Hero */}
      <section className="relative pt-20 pb-8 px-4 sm:px-6 md:px-8">
        <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6 md:gap-10 items-center">
          <div className="mx-auto md:mx-0 relative">
            <div className="absolute -inset-1 rounded-full blur-lg bg-[#00a1e9]/30" />
            <div className="relative w-36 h-36 rounded-full ring-4 ring-white shadow-xl overflow-hidden bg-white">
              <ArtistAvatar src={profile?.avatar_url} />
            </div>
          </div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9]/10 px-3 py-1 text-[#007db3] text-sm font-medium">
              <BadgeCheck className="w-4 h-4" /> me-ish 専属アーティスト
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900">
              ナトリ <span className="align-middle inline-block"><Sparkles className="w-7 h-7 text-[#00a1e9]" /></span>
            </h1>
            <p className="mt-3 max-w-2xl text-gray-600 leading-relaxed">
              やわらかく、かわいらしい世界へようこそ。優しい色づかいと遊び心を大切に、日々の“ときめき”を描いています。
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <CuteButton href="/contact" icon={<Mail className="w-4 h-4" />}>お問い合わせ</CuteButton>
              <CuteButton href="/gallery" variant="ghost" icon={<Images className="w-4 h-4" />}>ギャラリーを見る</CuteButton>
              {profile?.sns_links?.twitter && (
                <CuteButton href={profile.sns_links.twitter} target="_blank" rel="noopener noreferrer" variant="ghost" icon={<Twitter className="w-4 h-4" />}>X (Twitter)</CuteButton>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-4">
              <StatPill label="総いいね" value={stats.totalLikes} />
              <StatPill label="公開作品" value={stats.totalWorks} />
              <StatPill label="SOLD作品" value={stats.sold} />
            </div>
          </div>
        </div>
      </section>

      {/* Bio */}
      {(profile?.bio || true) && (
        <section className="px-4 sm:px-6 md:px-8 pb-4">
          <div className="mx-auto max-w-4xl rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800">プロフィール</h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              {profile?.bio || 'やわらかな世界観で女の子やどうぶつ、日常の小さな幸福を描いています。グッズ・アイコン・ヘッダー制作などもご相談ください。'}
            </p>
          </div>
        </section>
      )}

      {/* Gallery */}
      <section className="px-4 sm:px-6 md:px-8 py-10">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <h2 className="text-2xl font-extrabold text-gray-900">作品一覧</h2>
          <div className="text-sm text-gray-500">{loading ? '読み込み中…' : `${entries.length}点`}</div>
        </div>

        <div className="mx-auto mt-6 max-w-6xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {loading && [...Array(8)].map((_, i) => <CardSkeleton key={i} />)}

          {!loading && entries.length === 0 && (
            <EmptyState />
          )}

          {!loading && entries.map((e) => (
            <ArtworkCard
              key={e.id}
              entry={e}
              onLike={() => handleLike(e.id)}
              likeBusy={likeBusy === e.id}
            />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 md:px-8 pb-16">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#e6f7ff] via-white to-[#e6fff7] ring-1 ring-[#00a1e9]/20 p-6 sm:p-10">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6 items-center">
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900">ナトリにお仕事を依頼する</h3>
              <p className="mt-2 text-gray-700">アイコン・ヘッダー・グッズ・イラストなど、商用/個人問わずご相談ください。丁寧にヒアリングし、かわいらしい世界観で制作します。</p>
              <div className="mt-4 flex gap-3">
                <CuteButton href="/contact" icon={<Mail className="w-4 h-4" />}>お問い合わせフォーム</CuteButton>
                <CuteButton href="/gallery" variant="ghost" icon={<ShoppingBag className="w-4 h-4" />}>販売中の作品</CuteButton>
              </div>
            </div>
            <div className="relative aspect-[4/3] md:aspect-square">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_center,_rgba(0,161,233,0.18),_transparent_60%)]"
              />
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                className="absolute inset-4 rounded-2xl bg-white shadow-xl ring-1 ring-gray-100 grid place-items-center"
              >
                <Sparkles className="w-10 h-10 text-[#00a1e9]" />
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// === Components ===
function CuteButton({
  href,
  children,
  icon,
  variant = 'primary',
  target,
  rel,
}: {
  href: string
  children: React.ReactNode
  icon?: React.ReactNode
  variant?: 'primary' | 'ghost'
  target?: string
  rel?: string
}) {
  const base =
    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
  const styles =
    variant === 'primary'
      ? 'bg-[#00a1e9] text-white hover:brightness-110 focus-visible:ring-[#00a1e9]'
      : 'bg-white/80 text-[#0f172a] ring-1 ring-gray-200 hover:bg-white focus-visible:ring-[#00a1e9]'
  return (
    <Link href={href} target={target} rel={rel}
      className={`${base} ${styles} shadow-sm`}
    >
      {icon}
      <span>{children}</span>
    </Link>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white shadow-sm ring-1 ring-gray-100 px-3 py-1">
      <Star className="w-4 h-4 text-[#00a1e9]" />
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-bold text-gray-900">{value}</span>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="animate-pulse aspect-[3/4] rounded-2xl bg-gradient-to-br from-gray-100 via-white to-gray-100 ring-1 ring-gray-100" />
  )
}

function EmptyState() {
  return (
    <div className="col-span-full mx-auto max-w-md text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-[#00a1e9]/10 grid place-items-center">
        <Images className="w-7 h-7 text-[#00a1e9]" />
      </div>
      <h3 className="mt-3 text-lg font-bold text-gray-800">まだ作品がありません</h3>
      <p className="mt-1 text-gray-600">展示準備中です。少しだけお待ちください…！</p>
    </div>
  )
}

function ArtworkCard({ entry, onLike, likeBusy }: { entry: Entry; onLike: () => void; likeBusy: boolean }) {
  const likes = entry.likes ?? 0
  const t = entry.edition_total ?? null
  const s = entry.edition_sold ?? 0
  const soldOut = t !== null && t > 0 && s >= t

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
      className="group relative overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <Image
          src={entry.image_url}
          alt={entry.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        {soldOut && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="rounded-full bg-black/60 text-white text-xs font-extrabold px-3 py-1 tracking-widest">SOLD</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900 line-clamp-2">{entry.title}</h3>
          <button
            aria-label="いいね"
            onClick={onLike}
            disabled={likeBusy}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 active:scale-95"
          >
            <Heart className={`w-3.5 h-3.5 ${likeBusy ? 'animate-pulse' : 'text-[#ff6aa2]'}`} fill={likeBusy ? 'none' : 'currentColor'} />
            <span>{likes}</span>
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[12px] text-gray-500">
          <div className="flex items-center gap-2">
            {t !== null && (
              <span>
                Edition: <b>{Math.max((t ?? 0) - (s ?? 0), 0)}</b> / {t}
              </span>
            )}
          </div>
          {entry.price != null && (
            <div className="font-bold text-gray-800">¥{entry.price.toLocaleString()}</div>
          )}
        </div>
      </div>
    </motion.article>
  )
}

function ArtistAvatar({ src }: { src?: string | null }) {
  if (!src) {
    return (
      <div className="w-full h-full grid place-items-center bg-gradient-to-br from-[#e6f7ff] via-white to-[#fff0f6]">
        <Sparkles className="w-10 h-10 text-[#00a1e9]" />
      </div>
    )
  }
  return (
    <Image src={src} alt="ナトリのアバター" fill className="object-cover" />
  )
}

function DecorativeBg() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute -top-20 -left-20 w-[360px] h-[360px] rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,161,233,0.20) 0%, transparent 65%)' }} />
      <div className="absolute top-[40%] -right-24 w-[300px] h-[300px] rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(ellipse at center, rgba(255,170,200,0.25) 0%, transparent 65%)' }} />
      <div className="absolute bottom-[-120px] left-[10%] w-[420px] h-[420px] rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,161,233,0.15) 0%, transparent 70%)' }} />
    </div>
  )
}
