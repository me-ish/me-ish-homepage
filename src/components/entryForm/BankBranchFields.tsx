'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { FormValues } from '@/app/entry/FormWrapper';

type Bank = { code: string; name: string; kana: string; aliases?: string[] };
type Branch = { code: string; name: string; kana: string };
type BranchDict = Record<string, Branch[]>;

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
    (b.aliases || []).some(a => norm(a).includes(n))
  );
}
function matchBranch(br: Branch, q: string) {
  const n = norm(q);
  return br.code.includes(n) || norm(br.name).includes(n) || norm(br.kana).includes(n);
}

export default function BankBranchFields() {
  const { register, setValue, watch, formState: { errors } } = useFormContext<FormValues>();
  const bankCode = watch('bank_code'); // ★ watchで反応的に追う

  const [banks, setBanks] = useState<Bank[]>([]);
  const [branches, setBranches] = useState<BranchDict>({});
  const [bankInput, setBankInput] = useState('');
  const [branchInput, setBranchInput] = useState('');

  // 初回ロードでマスタ取得（/public/data 直読み）
  useEffect(() => {
    (async () => {
      const [bRes, brRes] = await Promise.all([
        fetch('/data/banks.json'), fetch('/data/branches.json')
      ]);
      const [bJson, brJson] = await Promise.all([bRes.json(), brRes.json()]);
      setBanks(bJson as Bank[]);
      setBranches(brJson as BranchDict);
    })();
  }, []);

  // bank_code 変更で支店入力をリセット
  useEffect(() => {
    setBranchInput('');
    setValue('branch_code', '' as any, { shouldValidate: true, shouldDirty: true });
  }, [bankCode, setValue]);

  const bankCandidates = useMemo(() => {
    if (!bankInput) return banks.slice(0, 12);
    return banks.filter(b => matchBank(b, bankInput)).slice(0, 12);
  }, [bankInput, banks]);

  const branchCandidates = useMemo(() => {
    const list = branches[bankCode] || [];
    if (!branchInput) return list.slice(0, 20);
    return list.filter(br => matchBranch(br, branchInput)).slice(0, 20);
  }, [branchInput, branches, bankCode]);

  const commitBankByText = () => {
    const exactByCode = banks.find(b => b.code === bankInput.trim());
    const exactByName = banks.find(b => b.name === bankInput.trim());
    const hit = exactByCode || exactByName || bankCandidates[0];
    if (hit) {
      setValue('bank_code', hit.code as any, { shouldValidate: true, shouldDirty: true });
      setBankInput(`${hit.name}（${hit.code}）`);
    }
  };

  const commitBranchByText = () => {
    const list = branches[bankCode] || [];
    const exactByCode = list.find(br => br.code === branchInput.trim());
    const exactByName = list.find(br => br.name === branchInput.trim());
    const hit = exactByCode || exactByName || branchCandidates[0];
    if (hit) {
      setValue('branch_code', hit.code as any, { shouldValidate: true, shouldDirty: true });
      setBranchInput(`${hit.name}（${hit.code}）`);
    }
  };

  return (
    <div className="mt-8 p-4 rounded-xl border border-gray-200 bg-[#fbfbfb]">
      <h3 className="text-base font-bold text-gray-900 mb-3">振込先口座（必須）</h3>

      {/* 銀行（名称 / コード） */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          銀行（名称 / コード どちらでも）<span className="text-red-600">＊</span>
        </label>
        <input
          type="text"
          value={bankInput}
          onChange={(e) => {
            const v = e.target.value;
            setBankInput(v);
            // datalist選択で「（0000）」が末尾に付いたら即確定
            const m = v.match(/（(\d{4})）$/);
            if (m) setValue('bank_code', m[1] as any, { shouldValidate: true, shouldDirty: true });
          }}
          onBlur={commitBankByText}
          placeholder="例）三菱UFJ / 0005"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[--brand]"
          style={{ ['--brand' as any]: BRAND }}
          list="bank-suggest"
          aria-invalid={!!errors.bank_code}
        />
        <datalist id="bank-suggest">
          {bankCandidates.map((b) => (
            <option key={b.code} value={`${b.name}（${b.code}）`}>{b.name}</option>
          ))}
        </datalist>

        {/* hidden: 保存はコード */}
        <input type="hidden" {...register('bank_code', {
          required: '銀行を選択してください。',
          pattern: { value: /^\d{4}$/, message: '銀行コードが不正です。' },
        })} />
        {errors.bank_code && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {/* @ts-ignore */}{errors.bank_code.message}
          </p>
        )}
      </div>

      {/* 支店（名称 / コード） */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          支店（名称 / コード どちらでも）<span className="text-red-600">＊</span>
        </label>
        <input
          type="text"
          value={branchInput}
            onChange={(e) => {
    const v = e.target.value;
    setBranchInput(v);
    // datalist 選択などで末尾に「（123）」が付いたら即 hidden を確定
    const m = v.match(/（(\d{3})）$/);
    if (m) {
      setValue('branch_code', m[1] as any, { shouldValidate: true, shouldDirty: true });
    }
  }}
          onBlur={commitBranchByText}
          placeholder="例）新宿 / 123"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[--brand]"
          style={{ ['--brand' as any]: BRAND }}
          list="branch-suggest"
          aria-invalid={!!errors.branch_code}
          disabled={!bankCode}
        />
        <datalist id="branch-suggest">
          {branchCandidates.map((br) => (
            <option key={br.code} value={`${br.name}（${br.code}）`}>{br.name}</option>
          ))}
        </datalist>

        <input type="hidden" {...register('branch_code', {
          required: '支店を選択してください。',
          pattern: { value: /^\d{3}$/, message: '支店コードが不正です。' },
        })} />
        {errors.branch_code && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {/* @ts-ignore */}{errors.branch_code.message}
          </p>
        )}
      </div>

      {/* 口座種別 */}
      <div className="mb-4">
        <span className="block text-sm font-semibold text-gray-800 mb-1.5">
          口座種別<span className="text-red-600">＊</span>
        </span>
        <div className="flex gap-6">
          <label className="flex items-center gap-2">
            <input type="radio" value="futsu" {...register('account_type', { required: '口座種別を選択してください。' })} /> 普通
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="toza" {...register('account_type', { required: '口座種別を選択してください。' })} /> 当座
          </label>
        </div>
        {errors.account_type && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {/* @ts-ignore */}{errors.account_type.message}
          </p>
        )}
      </div>

      {/* 口座番号 */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          口座番号（最大7桁）<span className="text-red-600">＊</span>
        </label>
        <input
          inputMode="numeric"
          placeholder="例）1234567"
          aria-invalid={!!errors.account_number}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[--brand]"
          style={{ ['--brand' as any]: BRAND }}
          {...register('account_number', {
            required: '口座番号は必須です。',
            pattern: { value: /^\d{1,7}$/, message: '1〜7桁の数字で入力してください。' },
          })}
        />
        {errors.account_number && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {/* @ts-ignore */}{errors.account_number.message}
          </p>
        )}
      </div>

      {/* 口座名義カナ */}
      <div className="mb-1">
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          口座名義（全角カナ）<span className="text-red-600">＊</span>
        </label>
        <input
          placeholder="例）ヤマダ　タロウ"
          aria-invalid={!!errors.account_name_kana}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[--brand]"
          style={{ ['--brand' as any]: BRAND }}
          {...register('account_name_kana', {
            required: '口座名義カナは必須です。',
            validate: (v) => v?.trim().length > 0 || '空白のみは使用できません。',
          })}
        />
        {errors.account_name_kana && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {/* @ts-ignore */}{errors.account_name_kana.message}
          </p>
        )}
      </div>

      {/* 同意 */}
      <div className="mt-3">
        <label className="inline-flex items-center gap-2 text-sm text-gray-800">
          <input type="checkbox" {...register('agree_bank_use', { required: '振込のための利用に同意が必要です。' })} />
          売上の月次振込のために、上記の口座情報を me-ish が保存・利用することに同意します
        </label>
        {errors.agree_bank_use && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {/* @ts-ignore */}{errors.agree_bank_use.message}
          </p>
        )}
      </div>
    </div>
  );
}
