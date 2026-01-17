// --- /app/api/ai-guide/route.ts ---
// 汎用QA：作品名/ID/検索/展示状況/ギャラリー方針（公開済みのみ返す）

import { NextResponse } from 'next/server';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { createClient } from '@/lib/supabase/server'; // サーバー用 Supabase クライアント

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const MODEL = process.env.GPT_ANSWER_MODEL ?? 'gpt-4o-mini';
const SAFE_DEBUG = process.env.NODE_ENV !== 'production';

// Supabaseクライアント（service_role 不要の読み取りだけ想定）
function sb() {
  return createClient();
}

// 公開用：返す列（内部金額などは除外）
const SELECT_COLUMNS = `
  id, title, artist_name, description, image_url,
  price, is_for_sale, is_sold,
  likes, gallery_type, confirmed, display_ready,
  confirmed_at, display_start_at, display_end_at,
  edition_total, edition_sold
` as const;

// Postgrest のフィルタビルダー型（ゆるい型）
type PB = PostgrestFilterBuilder<any, any, any, any>;

// 公開可のレコード条件（未公開は返さない）
function applyPublicFilters(q: PB): PB {
  const nowIso = new Date().toISOString();
  return q
    .eq('confirmed', true)
    .eq('display_ready', true)
    .lte('display_start_at', nowIso);
}

/* ===========================
   OpenAI ツール（function calling）
   =========================== */
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_entry_by_id',
      description: 'entries.id で単一の作品詳細を取得（公開済みのみ）',
      parameters: {
        type: 'object',
        properties: { id: { type: 'number', description: 'entries の主キーID' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_entry_by_title',
      description: '作品タイトルの部分一致で検索（公開済み・最大5件）',
      parameters: {
        type: 'object',
        properties: {
          title_query: { type: 'string', description: 'タイトルの一部または全文' },
          limit: { type: 'number', default: 5 },
        },
        required: ['title_query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_entries',
      description:
        '簡易検索。フリーテキスト/価格/ギャラリー種別/現在展示(onlyLive)で絞り込み（公開済みのみ）',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'タイトル/説明の部分一致' },
          priceMin: { type: 'number' },
          priceMax: { type: 'number' },
          galleryType: { type: 'string', enum: ['white', 'float', 'special', 'any'], default: 'any' },
          onlyLive: {
            type: 'boolean',
            default: false,
            description:
              'true なら現在展示中（!is_sold && display_end_at が null または 未来）のみ',
          },
          limit: { type: 'number', default: 20 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_gallery_status',
      description: 'ギャラリー方針（white/float/special/all）を返す（固定ルール）',
      parameters: {
        type: 'object',
        properties: { galleryType: { type: 'string', enum: ['white', 'float', 'special', 'all'], default: 'all' } },
        additionalProperties: false,
      },
    },
  },
];

/* ===========================
   Supabase 実装（PB はすべて any ベース）
   =========================== */
async function impl_get_entry_by_id({ id }: { id: number }) {
  let q = sb().from('entries').select(SELECT_COLUMNS).eq('id', id) as unknown as PB;
  const { data, error } = await applyPublicFilters(q).single();
  if (error) throw new Error(`Supabase(get_entry_by_id): ${error.message}`);
  return data;
}

async function impl_get_entry_by_title({ title_query, limit = 5 }: { title_query: string; limit?: number }) {
  let q = sb()
    .from('entries')
    .select(SELECT_COLUMNS)
    .ilike('title', `%${title_query}%`)
    .order('confirmed_at', { ascending: false })
    .limit(limit) as unknown as PB;

  const { data, error } = await applyPublicFilters(q);
  if (error) throw new Error(`Supabase(get_entry_by_title): ${error.message}`);
  return (data as any[]) ?? [];
}

type SearchArgs = {
  q?: string;
  priceMin?: number;
  priceMax?: number;
  galleryType?: 'white' | 'float' | 'special' | 'any';
  onlyLive?: boolean;
  limit?: number;
};

async function impl_search_entries(args: SearchArgs) {
  let q = sb().from('entries').select(SELECT_COLUMNS) as unknown as PB;

  q = applyPublicFilters(q);

  if (args.q?.trim()) {
    q = q.or(
      [
        `title.ilike.%${args.q}%`,
        `description.ilike.%${args.q}%`,
      ].join(',')
    );
  }

  if (typeof args.priceMin === 'number') q = q.gte('price', args.priceMin);
  if (typeof args.priceMax === 'number') q = q.lte('price', args.priceMax);
  if (args.galleryType && args.galleryType !== 'any') q = q.eq('gallery_type', args.galleryType);

  if (args.onlyLive) {
    q = q
      .eq('is_sold', false)
      .or('display_end_at.is.null,display_end_at.gt.now()');
  }

  const { data, error } = await q.order('likes', { ascending: false }).limit(args.limit ?? 20);
  if (error) throw new Error(`Supabase(search_entries): ${error.message}`);
  return (data as any[]) ?? [];
}

async function impl_get_gallery_status({ galleryType }: { galleryType: 'white' | 'float' | 'special' | 'all' }) {
  const policy = {
    white: {
      rotation: '日替わりしない',
      date_policy: '承認時に confirmed_at/display_start_at=now(), display_end_at=null（無期限）',
    },
    float: {
      rotation: '日替わり展示を行う',
      date_policy: 'display_start_at を起点に display_end_at は自動で1か月後（予定）',
    },
    special: {
      rotation: 'テーマに応じて随時（個別設定）',
      date_policy: '個別設定（未設定はnull）',
    },
  } as const;

  if (galleryType === 'all') return policy;
  return policy[galleryType];
}

/* ===========================
   ルート本体
   =========================== */
export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const system = `
あなたは3Dオンラインアートギャラリー「me-ish」の公式ガイドAI。
必ず**Supabaseから取得したデータ**を根拠に答える。想像で補わない。
対応範囲：
- 作品ID/タイトルでの詳細照会（価格/展示状況/エディション残数など）
- 簡易検索（タイトル/説明の部分一致、価格帯、ギャラリー種別、現在展示の絞り込み）
- ギャラリー方針（white/float/special）
購入案内は簡潔に：クレジットカード（Stripe）で購入できます。
おすすめ作品を質問されたら、いいね数が多いもの1点を回答すること。
    `.trim();

    let messages: any[] = [
      { role: 'system', content: system },
      { role: 'user', content: message },
    ];

    // 1回ツール実行 → 最終回答（安定重視）
    const first = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, temperature: 0.2, messages, tools, tool_choice: 'auto' }),
    }).then((r) => r.json());

    if (first?.error) {
      const msg = SAFE_DEBUG ? `OpenAI error: ${first.error.message}` : 'AI呼び出しでエラーが発生しました。';
      return NextResponse.json({ reply: msg }, { status: 500 });
    }

    const choice = first?.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];

    if (!toolCall) {
      const text = choice?.message?.content ?? 'うまく解釈できませんでした。作品名やIDを教えてください。';
      return NextResponse.json({ reply: text });
    }

    // ツール実行（引数パースをガード）
    const { name, arguments: rawArgs } = toolCall.function;
    let args: any = {};
    try {
      args = rawArgs && typeof rawArgs === 'string' ? JSON.parse(rawArgs) : (rawArgs ?? {});
    } catch (e) {
      if (SAFE_DEBUG) console.error('Tool args parse error:', e, rawArgs);
      return NextResponse.json({ reply: '内部エラー（tool args parse）。' }, { status: 500 });
    }

    let toolResult: any = null;
    try {
      if (name === 'get_entry_by_id') toolResult = await impl_get_entry_by_id(args);
      else if (name === 'get_entry_by_title') toolResult = await impl_get_entry_by_title(args);
      else if (name === 'search_entries') toolResult = await impl_search_entries(args);
      else if (name === 'get_gallery_status') toolResult = await impl_get_gallery_status(args);
      else toolResult = { error: `unknown tool: ${name}` };
    } catch (e: any) {
      const msg = SAFE_DEBUG ? e.message : 'データ取得時にエラーが発生しました。';
      return NextResponse.json({ reply: msg }, { status: 500 });
    }

    // ツール結果を注入して最終回答
    messages.push(choice.message);
    messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(toolResult) });

    const final = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, temperature: 0.2, messages }),
    }).then((r) => r.json());

    if (final?.error) {
      const msg = SAFE_DEBUG ? `OpenAI error(final): ${final.error.message}` : 'AI応答生成でエラーが発生しました。';
      return NextResponse.json({ reply: msg }, { status: 500 });
    }

    const text =
      final?.choices?.[0]?.message?.content ??
      '情報の取得に失敗しました。作品名やIDをもう一度教えてください。';

    return NextResponse.json({ reply: text });
  } catch (e: any) {
    if (SAFE_DEBUG) console.error('Route fatal error:', e);
    return NextResponse.json(
      { reply: SAFE_DEBUG ? `Fatal: ${e.message}` : '内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
