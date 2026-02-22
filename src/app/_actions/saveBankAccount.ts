'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type BankAccountInput = {
  external_user_id: string;
  bank_code: string;
  branch_code: string;
  account_type: 'futsu' | 'toza';
  account_number: string;
  account_name_kana: string;
};

/**
 * 銀行口座情報を保存するサーバーアクション。
 *
 * 応募フォームは匿名ユーザーが使用するため、クライアント側の Supabase では
 * artists_bank_accounts テーブルへの INSERT が RLS で拒否される。
 * service_role クライアントを使って RLS をバイパスして保存する。
 *
 * セキュリティ: external_user_id が直前に未審査で挿入された entries に
 * 存在することを確認してから upsert する。
 */
export async function saveBankAccount(input: BankAccountInput): Promise<{ error: string | null }> {
  const { external_user_id, bank_code, branch_code, account_type, account_number, account_name_kana } = input;

  // external_user_id が entries に存在し、未審査であることを確認
  const admin = supabaseAdmin();
  const { data: entry, error: entryErr } = await admin
    .from('entries')
    .select('id')
    .eq('external_user_id', external_user_id)
    .is('confirmed', null)
    .maybeSingle();

  if (entryErr) {
    return { error: `エントリーの確認に失敗しました: ${entryErr.message}` };
  }
  if (!entry) {
    return { error: '対応するエントリーが見つかりません。' };
  }

  const { error: upsertErr } = await admin
    .from('artists_bank_accounts')
    .upsert(
      [{ external_user_id, bank_code, branch_code, account_type, account_number, account_name_kana }],
      { onConflict: 'external_user_id' }
    );

  if (upsertErr) {
    return { error: upsertErr.message };
  }

  return { error: null };
}
