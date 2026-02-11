// --- /app/api/ai-guide/route.ts ---
// 汎用QA：作品名/作家名/ID/検索/展示状況/ギャラリー方針（公開済みのみ返す）

import { NextResponse } from 'next/server';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { createClient } from '@/lib/supabase/server';
import { escapeIlikePattern } from '@/lib/sanitize';
import { AI_GUIDE_SYSTEM_PROMPT } from '@/lib/aiGuide/prompt';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.GPT_ANSWER_MODEL ?? 'gpt-4o-mini';
const SAFE_DEBUG = process.env.NODE_ENV !== 'production';

// 会話履歴の最大ターン数（system除く）
const MAX_HISTORY_TURNS = 10;

function sb() {
  return createClient();
}

const SELECT_COLUMNS = `
  id, title, artist_name, description, image_url,
  price, is_for_sale, is_sold,
  likes, gallery_type, confirmed, display_ready,
  confirmed_at, display_start_at, display_end_at,
  edition_total, edition_sold
` as const;

type PB = PostgrestFilterBuilder<any, any, any, any>;

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
        '作品検索。テキスト(タイトル・作家名・説明文を横断検索)/価格帯/ギャラリー種別/展示中フィルタで絞り込み（公開済みのみ）。作家名で探す場合もこのツールを使う。',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'タイトル・作家名・説明文の部分一致キーワード' },
          priceMin: { type: 'number' },
          priceMax: { type: 'number' },
          galleryType: { type: 'string', enum: ['white', 'float', 'special', 'any'], default: 'any' },
          onlyLive: {
            type: 'boolean',
            default: false,
            description: 'true なら現在展示中（未売却 & display_end_at が null または未来）のみ',
          },
          limit: { type: 'number', default: 10 },
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
   Supabase 実装
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
    .ilike('title', `%${escapeIlikePattern(title_query)}%`)
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
    const escaped = escapeIlikePattern(args.q);
    q = q.or(
      [
        `title.ilike.%${escaped}%`,
        `artist_name.ilike.%${escaped}%`,
        `description.ilike.%${escaped}%`,
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

  const { data, error } = await q.order('likes', { ascending: false }).limit(args.limit ?? 10);
  if (error) throw new Error(`Supabase(search_entries): ${error.message}`);
  return (data as any[]) ?? [];
}

async function impl_get_gallery_status({ galleryType }: { galleryType: 'white' | 'float' | 'special' | 'all' }) {
  const policy = {
    white: {
      name: 'White Gallery',
      description: '厳選された作品を常設展示するメインギャラリー',
      rotation: '常設（日替わりしない）',
      display_end: '無期限',
    },
    float: {
      name: 'Float Gallery',
      description: '日替わりで様々な作品が浮かぶ空中ギャラリー',
      rotation: '日替わりで展示作品が変わる',
      display_end: '展示開始から約1か月',
    },
    special: {
      name: 'Special Gallery',
      description: 'テーマ企画展',
      rotation: 'テーマに応じて随時',
      display_end: '個別設定',
    },
  } as const;

  if (galleryType === 'all') return policy;
  return policy[galleryType];
}

/* ===========================
   ツール実行ヘルパー
   =========================== */
const TOOL_IMPLS: Record<string, (args: any) => Promise<any>> = {
  get_entry_by_id: impl_get_entry_by_id,
  get_entry_by_title: impl_get_entry_by_title,
  search_entries: impl_search_entries,
  get_gallery_status: impl_get_gallery_status,
};

async function executeToolCall(tc: { id: string; function: { name: string; arguments: string } }) {
  const { name, arguments: rawArgs } = tc.function;

  let args: any = {};
  try {
    args = rawArgs && typeof rawArgs === 'string' ? JSON.parse(rawArgs) : (rawArgs ?? {});
  } catch {
    return { tool_call_id: tc.id, content: JSON.stringify({ error: 'tool args parse error' }) };
  }

  const impl = TOOL_IMPLS[name];
  if (!impl) {
    return { tool_call_id: tc.id, content: JSON.stringify({ error: `unknown tool: ${name}` }) };
  }

  try {
    const result = await impl(args);
    return { tool_call_id: tc.id, content: JSON.stringify(result) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { tool_call_id: tc.id, content: JSON.stringify({ error: msg }) };
  }
}

/* ===========================
   システムプロンプト
   =========================== */
/* ===========================
   ルート本体
   =========================== */
export async function POST(req: Request) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { reply: 'AIガイド機能は現在利用できません。' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { message, history } = body as {
      message: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    // 入力バリデーション
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ reply: "メッセージを入力してください。" }, { status: 400 });
    }
    if (message.length > 500) {
      return NextResponse.json({ reply: "メッセージは500文字以内でお願いします。" }, { status: 400 });
    }

    // メッセージ構築（system + 会話履歴 + 今回のユーザーメッセージ）
    const messages: any[] = [{ role: 'system', content: AI_GUIDE_SYSTEM_PROMPT }];

    // 会話履歴を追加（最大ターン数で制限、role を user/assistant に限定）
    if (Array.isArray(history)) {
      const safe = history
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-MAX_HISTORY_TURNS);
      for (const m of safe) {
        messages.push({ role: m.role, content: m.content.slice(0, 1000) });
      }
    }

    messages.push({ role: 'user', content: message });

    // 1st call: ツール判定
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
    const toolCalls = choice?.message?.tool_calls;

    // ツール呼び出しなし → そのまま返す
    if (!toolCalls || toolCalls.length === 0) {
      const text = choice?.message?.content ?? 'うまく解釈できませんでした。作品名やIDを教えてください。';
      return NextResponse.json({ reply: text });
    }

    // 全ツール実行（複数対応）
    messages.push(choice.message);

    const toolResults = await Promise.all(toolCalls.map(executeToolCall));
    for (const tr of toolResults) {
      messages.push({ role: 'tool', tool_call_id: tr.tool_call_id, content: tr.content });
    }

    // 2nd call: ツール結果を踏まえた最終回答
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
  } catch (e: unknown) {
    if (SAFE_DEBUG) console.error('Route fatal error:', e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { reply: SAFE_DEBUG ? `Fatal: ${message}` : '内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
