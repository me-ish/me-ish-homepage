'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Loader2, CheckCircle2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Bank = { code: string; name: string; kana: string; aliases?: string[] };
type Branch = { code: string; name: string; kana: string };
type BranchDict = Record<string, Branch[]>;

type BankAccount = {
  bank_code: string;
  branch_code: string;
  account_type: 'futsu' | 'toza';
  account_number: string;
  account_name_kana: string;
};

const BRAND = '#00a1e9';

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, '');
}
function matchBank(b: Bank, q: string) {
  const n = norm(q);
  return (
    b.code.includes(n) ||
    norm(b.name).includes(n) ||
    norm(b.kana).includes(n) ||
    (b.aliases || []).some((a) => norm(a).includes(n))
  );
}
function matchBranch(br: Branch, q: string) {
  const n = norm(q);
  return br.code.includes(n) || norm(br.name).includes(n) || norm(br.kana).includes(n);
}

export default function BankSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 認証状態
  const [uid, setUid] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [externalUserId, setExternalUserId] = useState<string | null>(null);

  // マスタデータ
  const [banks, setBanks] = useState<Bank[]>([]);
  const [branches, setBranches] = useState<BranchDict>({});

  // フォーム状態
  const [bankInput, setBankInput] = useState('');
  const [branchInput, setBranchInput] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [accountType, setAccountType] = useState<'futsu' | 'toza' | ''>('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountNameKana, setAccountNameKana] = useState('');

  // 認証チェック
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push('/');
        return;
      }
      setUid(data.user.id);
      setUserEmail(data.user.email ?? null);
    })();
  }, [router]);

  // マスタ読み込み
  useEffect(() => {
    (async () => {
      const [bRes, brRes] = await Promise.all([
        fetch('/data/banks.json'),
        fetch('/data/branches.json'),
      ]);
      const [bJson, brJson] = await Promise.all([bRes.json(), brRes.json()]);
      setBanks(bJson as Bank[]);
      setBranches(brJson as BranchDict);
    })();
  }, []);

  // 既存データ読み込み
  useEffect(() => {
    // uid, userEmail, banks が揃うまで待つ
    if (!uid || !userEmail || banks.length === 0) return;

    (async () => {
      try {
        console.log('[bank settings] searching with uid:', uid, 'email:', userEmail);

        // entriesからexternal_user_idを取得（user_id または email でマッチ）
        let entry: { external_user_id: string } | null = null;

        // まずuser_idで検索
        const { data: entryByUid, error: uidErr } = await supabase
          .from('entries')
          .select('external_user_id')
          .eq('user_id', uid)
          .not('external_user_id', 'is', null)
          .limit(1)
          .maybeSingle();

        console.log('[bank settings] by user_id:', entryByUid, 'error:', uidErr);

        if (entryByUid) {
          entry = entryByUid;
        } else if (userEmail) {
          // user_idがなければemailで検索
          const { data: entryByEmail, error: emailErr } = await supabase
            .from('entries')
            .select('external_user_id')
            .eq('email', userEmail)
            .not('external_user_id', 'is', null)
            .limit(1)
            .maybeSingle();
          console.log('[bank settings] by email:', entryByEmail, 'error:', emailErr);
          entry = entryByEmail;
        }

        console.log('[bank settings] final entry:', entry);

        if (!entry?.external_user_id) {
          console.log('[bank settings] no entry found, stopping');
          setLoading(false);
          return;
        }

        setExternalUserId(entry.external_user_id);

        // 口座情報を取得
        const { data: account } = await supabase
          .from('artists_bank_accounts')
          .select('bank_code, branch_code, account_type, account_number, account_name_kana')
          .eq('external_user_id', entry.external_user_id)
          .maybeSingle();

        if (account) {
          setBankCode(account.bank_code);
          setBranchCode(account.branch_code);
          setAccountType(account.account_type as 'futsu' | 'toza');
          setAccountNumber(account.account_number);
          setAccountNameKana(account.account_name_kana);

          // 銀行名を表示用にセット
          const bank = banks.find((b) => b.code === account.bank_code);
          if (bank) setBankInput(`${bank.name}（${bank.code}）`);

          // 支店名を表示用にセット
          const branchList = branches[account.bank_code] || [];
          const branch = branchList.find((br) => br.code === account.branch_code);
          if (branch) setBranchInput(`${branch.name}（${branch.code}）`);
        }
      } catch (e) {
        console.error('[bank settings] load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, userEmail, banks, branches]);

  // 銀行候補
  const bankCandidates = useMemo(() => {
    if (!bankInput) return banks.slice(0, 12);
    return banks.filter((b) => matchBank(b, bankInput)).slice(0, 12);
  }, [bankInput, banks]);

  // 支店候補
  const branchCandidates = useMemo(() => {
    const list = branches[bankCode] || [];
    if (!branchInput) return list.slice(0, 20);
    return list.filter((br) => matchBranch(br, branchInput)).slice(0, 20);
  }, [branchInput, branches, bankCode]);

  // 銀行確定
  const commitBank = () => {
    const exactByCode = banks.find((b) => b.code === bankInput.trim());
    const exactByName = banks.find((b) => b.name === bankInput.trim());
    const hit = exactByCode || exactByName || bankCandidates[0];
    if (hit) {
      setBankCode(hit.code);
      setBankInput(`${hit.name}（${hit.code}）`);
      // 銀行変更時は支店をリセット
      setBranchCode('');
      setBranchInput('');
    }
  };

  // 支店確定
  const commitBranch = () => {
    const list = branches[bankCode] || [];
    const exactByCode = list.find((br) => br.code === branchInput.trim());
    const exactByName = list.find((br) => br.name === branchInput.trim());
    const hit = exactByCode || exactByName || branchCandidates[0];
    if (hit) {
      setBranchCode(hit.code);
      setBranchInput(`${hit.name}（${hit.code}）`);
    }
  };

  // バリデーション
  const validate = (): string | null => {
    if (!bankCode || !/^\d{4}$/.test(bankCode)) return '銀行を選択してください。';
    if (!branchCode || !/^\d{3}$/.test(branchCode)) return '支店を選択してください。';
    if (!accountType) return '口座種別を選択してください。';
    if (!accountNumber || !/^\d{1,7}$/.test(accountNumber)) return '口座番号を正しく入力してください。';
    if (!accountNameKana.trim()) return '口座名義を入力してください。';
    return null;
  };

  // 保存
  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!externalUserId) {
      setError('出展履歴がありません。まず作品を出展してください。');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: upsertError } = await supabase
        .from('artists_bank_accounts')
        .upsert(
          {
            external_user_id: externalUserId,
            bank_code: bankCode,
            branch_code: branchCode,
            account_type: accountType,
            account_number: accountNumber,
            account_name_kana: accountNameKana.trim(),
          },
          { onConflict: 'external_user_id' }
        );

      if (upsertError) throw upsertError;

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      console.error('[bank settings] save error:', e);
      setError(e?.message || '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-20 px-4">
        <div className="max-w-lg mx-auto flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-20 px-4 pb-10">
      <div className="max-w-lg mx-auto">
        {/* 戻るリンク */}
        <Link
          href="/mypage"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          マイページに戻る
        </Link>

        {/* ヘッダー */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-full bg-sky-100">
            <Wallet className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">振込先口座設定</h1>
            <p className="text-sm text-gray-500">売上の振込に使用する口座情報</p>
          </div>
        </div>

        {/* 出展履歴がない場合 */}
        {!externalUserId && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6">
            <p className="text-sm text-amber-800">
              口座情報を登録するには、まず作品を出展してください。
            </p>
            <Link
              href="/entry"
              className="inline-block mt-2 text-sm font-medium text-amber-700 hover:underline"
            >
              出展フォームへ →
            </Link>
          </div>
        )}

        {/* フォーム */}
        {externalUserId && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            {/* 銀行 */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                銀行（名称 / コード）
              </label>
              <input
                type="text"
                value={bankInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setBankInput(v);
                  const m = v.match(/（(\d{4})）$/);
                  if (m) setBankCode(m[1]);
                }}
                onBlur={commitBank}
                placeholder="例）三菱UFJ / 0005"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                list="bank-suggest"
              />
              <datalist id="bank-suggest">
                {bankCandidates.map((b) => (
                  <option key={b.code} value={`${b.name}（${b.code}）`}>
                    {b.name}
                  </option>
                ))}
              </datalist>
            </div>

            {/* 支店 */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                支店（名称 / コード）
              </label>
              <input
                type="text"
                value={branchInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setBranchInput(v);
                  const m = v.match(/（(\d{3})）$/);
                  if (m) setBranchCode(m[1]);
                }}
                onBlur={commitBranch}
                placeholder="例）新宿 / 123"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                list="branch-suggest"
                disabled={!bankCode}
              />
              <datalist id="branch-suggest">
                {branchCandidates.map((br) => (
                  <option key={br.code} value={`${br.name}（${br.code}）`}>
                    {br.name}
                  </option>
                ))}
              </datalist>
            </div>

            {/* 口座種別 */}
            <div className="mb-5">
              <span className="block text-sm font-semibold text-gray-800 mb-1.5">口座種別</span>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="account_type"
                    value="futsu"
                    checked={accountType === 'futsu'}
                    onChange={() => setAccountType('futsu')}
                  />
                  普通
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="account_type"
                    value="toza"
                    checked={accountType === 'toza'}
                    onChange={() => setAccountType('toza')}
                  />
                  当座
                </label>
              </div>
            </div>

            {/* 口座番号 */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                口座番号（最大7桁）
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 7))}
                placeholder="例）1234567"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* 口座名義 */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                口座名義（全角カナ）
              </label>
              <input
                type="text"
                value={accountNameKana}
                onChange={(e) => setAccountNameKana(e.target.value)}
                placeholder="例）ヤマダ　タロウ"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* エラー */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* 保存ボタン */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  保存中...
                </>
              ) : saved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  保存しました
                </>
              ) : (
                '保存する'
              )}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
