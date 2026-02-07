'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';

type EntryLite = { id: number; title: string | null };

const plans = [
  { id: 'free',     name: 'Free',     price: 0,    desc: '表示保証なし・ローテーション枠' },
  { id: 'mini',     name: 'Mini',     price: 400,  desc: '月4回保証' },
  { id: 'light',    name: 'Light',    price: 800,  desc: '月9回保証' },
  { id: 'standard', name: 'Standard', price: 1200, desc: '月14回保証' },
  { id: 'premium',  name: 'Premium',  price: 2400, desc: '月30回保証' },
];

export default function RenewPage() {
  const supabase = createClient();

  const [user, setUser] = useState<{ id: string } | null>(null);
  const [entries, setEntries] = useState<EntryLite[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('free');
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user ? { id: user.id } : null);

      if (!user) return;

      const { data, error } = await supabase
        .from('entries')
        .select('id,title')
        .eq('user_id', user.id)
        // .eq('status', 'ended') // 実スキーマに無ければ外す
        .order('id', { ascending: false })
        .limit(50);

      if (error) {
        setEntries([]);
      } else {
        setEntries((data ?? []) as EntryLite[]);
      }
    })();
  }, [supabase]);

  const handleSubmit = async () => {
    if (!user) {
      alert('ログインが必要です');
      return;
    }
    if (selectedEntryId == null) {
      alert('作品を選択してください');
      return;
    }
    setLoading(true);

    const { error } = await supabase
      .from('renewals' as any) // 型未整備のため any で回避
      .insert({
        entry_id: selectedEntryId, // number
        user_id: user.id,          // uuid
        plan: selectedPlan,
      } as any);

    setLoading(false);

    if (error) {
      console.error('[renew] insert error:', error);
      alert('再出展の申請に失敗しました');
    } else {
      alert('再出展の申請を受け付けました');
      setSelectedEntryId(null);
      setSelectedPlan('free');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="font-bold text-2xl text-[#00a1e9] mb-4">再出展・プラン延長</h1>
      <p className="text-gray-700 mb-6">展示が終了した作品の再出展申請が行えます。</p>

      {!user ? (
        <p className="text-gray-500">※ ログイン後に再出展が可能です</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500">現在、再出展可能な作品はありません。</p>
      ) : (
        <div className="space-y-8">
          {/* 1. 対象作品の選択 */}
          <div>
            <h2 className="font-bold mb-2">1. 対象作品の選択</h2>
            <div className="grid gap-4">
              {entries.map((entry) => (
                <Card
                  key={entry.id}
                  className={`cursor-pointer transition border ${selectedEntryId === entry.id ? 'border-[#00a1e9] ring-2 ring-[#00a1e9]/30' : ''}`}
                  onClick={() => setSelectedEntryId(entry.id)}
                >
                  <CardContent className="p-4">
                    <p className="font-bold text-lg">{entry.title ?? '(無題)'}</p>
                    <p className="text-sm text-gray-600">ID: {entry.id}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* 2. プラン選択 */}
          <div>
            <h2 className="font-bold mb-2">2. プラン選択</h2>
            <RadioGroup
              defaultValue={selectedPlan}        // ← value ではなく defaultValue を使う
              onValueChange={(v) => setSelectedPlan(v)}
            >
              {plans.map((plan) => (
                <div key={plan.id} className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value={plan.id} id={plan.id} />
                  <label htmlFor={plan.id} className="text-gray-800">
                    {plan.name}（¥{plan.price.toLocaleString()} / {plan.desc}）
                  </label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* 3. 送信 */}
          <div>
            <Button
              onClick={handleSubmit}
              disabled={loading || selectedEntryId == null}
              className="bg-[#00a1e9] hover:bg-[#008ec4] text-white px-6 py-2 rounded-lg disabled:opacity-50"
            >
              {loading ? '送信中…' : '再出展を申請する'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/*
将来的に制御コンポーネント（value を使う）にしたい場合：
- `@/components/ui/radio-group` の型を Radix の Root に合わせて `value?: string` を含む定義へ修正
- あるいは shadcn/ui の最新版テンプレートを再反映
*/
