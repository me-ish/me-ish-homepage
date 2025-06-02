'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';

const plans = [
  { id: 'free', name: 'Free', price: 0, desc: '表示保証なし・ローテーション枠' },
  { id: 'mini', name: 'Mini', price: 400, desc: '月1回保証' },
  { id: 'light', name: 'Light', price: 1000, desc: '月3回保証' },
  { id: 'standard', name: 'Standard', price: 2000, desc: '月7回保証' },
  { id: 'premium', name: 'Premium', price: 4000, desc: '月15回保証' },
];

export default function RenewPage() {
  const supabase = createClientComponentClient<Database>();

  const [user, setUser] = useState<any>(null); // nullでも進むように
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('free');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user); // ← ユーザーが null でもOK
      if (user) {
        const { data, error } = await supabase
          .from('entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'ended');

        if (!error) setEntries(data || []);
      }
    })();
  }, [supabase]);

  const handleSubmit = async () => {
    if (!user) {
      alert('ログインが必要です');
      return;
    }

    if (!selectedEntryId) return alert('作品を選択してください');

    const { error } = await supabase.from('renewals').insert({
      entry_id: selectedEntryId,
      user_id: user.id,
      plan: selectedPlan,
    });

    if (error) {
      console.error(error);
      alert('再出展の申請に失敗しました');
    } else {
      alert('再出展の申請を受け付けました');
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
          <div>
            <h2 className="font-bold mb-2">1. 対象作品の選択</h2>
            <div className="grid gap-4">
              {entries.map((entry) => (
                <Card
                  key={entry.id}
                  className={`cursor-pointer ${selectedEntryId === entry.id ? 'border-[#00a1e9]' : ''}`}
                  onClick={() => setSelectedEntryId(entry.id)}
                >
                  <CardContent className="p-4">
                    <p className="font-bold text-lg">{entry.title}</p>
                    <p className="text-sm text-gray-600">ID: {entry.id}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-bold mb-2">2. プラン選択</h2>
            <RadioGroup defaultValue="free" onValueChange={setSelectedPlan}>
              {plans.map((plan) => (
                <div key={plan.id} className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value={plan.id} id={plan.id} />
                  <label htmlFor={plan.id} className="text-gray-800">
                    {plan.name}（¥{plan.price} / {plan.desc}）
                  </label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Button onClick={handleSubmit} className="bg-[#00a1e9] hover:bg-[#008ec4] text-white px-6 py-2 rounded-lg">
              再出展を申請する
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

