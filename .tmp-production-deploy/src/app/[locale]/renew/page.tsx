'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

type EntryLite = { id: number; title: string | null };

const planBases = [
  { id: 'free',     name: 'Free',     price: 0    },
  { id: 'mini',     name: 'Mini',     price: 400  },
  { id: 'light',    name: 'Light',    price: 800  },
  { id: 'standard', name: 'Standard', price: 1200 },
  { id: 'premium',  name: 'Premium',  price: 2400 },
] as const;

export default function RenewPage() {
  const supabase = createClient();
  const t = useTranslations('pages.renew');

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
      alert(t('alertLoginRequired'));
      return;
    }
    if (selectedEntryId == null) {
      alert(t('alertSelectWork'));
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
      alert(t('alertError'));
    } else {
      alert(t('alertSuccess'));
      setSelectedEntryId(null);
      setSelectedPlan('free');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="font-bold text-2xl text-[#00a1e9] mb-4">{t('title')}</h1>
      <p className="text-gray-700 mb-6">{t('subtitle')}</p>

      {!user ? (
        <p className="text-gray-500">{t('loginRequired')}</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500">{t('noWorks')}</p>
      ) : (
        <div className="space-y-8">
          {/* 1. 対象作品の選択 */}
          <div>
            <h2 className="font-bold mb-2">{t('selectWork')}</h2>
            <div className="grid gap-4">
              {entries.map((entry) => (
                <Card
                  key={entry.id}
                  className={`cursor-pointer transition border ${selectedEntryId === entry.id ? 'border-[#00a1e9] ring-2 ring-[#00a1e9]/30' : ''}`}
                  onClick={() => setSelectedEntryId(entry.id)}
                >
                  <CardContent className="p-4">
                    <p className="font-bold text-lg">{entry.title ?? t('untitled')}</p>
                    <p className="text-sm text-gray-600">ID: {entry.id}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* 2. プラン選択 */}
          <div>
            <h2 className="font-bold mb-2">{t('selectPlan')}</h2>
            <RadioGroup
              defaultValue={selectedPlan}
              onValueChange={(v) => setSelectedPlan(v)}
            >
              {planBases.map((plan) => (
                <div key={plan.id} className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value={plan.id} id={plan.id} />
                  <label htmlFor={plan.id} className="text-gray-800">
                    {plan.name}（¥{plan.price.toLocaleString()} / {t(`planDesc.${plan.id}`)}）
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
              {loading ? t('submitting') : t('submitButton')}
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
