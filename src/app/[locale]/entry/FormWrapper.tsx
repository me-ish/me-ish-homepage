'use client';

import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Send, Loader2 } from 'lucide-react';
import Step1_ArtistInfo from '@/components/entryForm/Step1_ArtistInfo';
import Step2_WorkInfo from '@/components/entryForm/Step2_WorkInfo';
import Step3_SalesAndAgreement from '@/components/entryForm/Step3_SalesAndAgreement';
import ConfirmPage from '@/components/entryForm/ConfirmPage';
import CompletePage from '@/components/entryForm/CompletePage';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail } from '@/app/_actions/sendEmail'; // ★ 追加：サーバーアクション経由で送信

export type FormValues = {
  artistName: string;
  email: string;
  snsLinks: string[];
  homepageUrl: string;
  twitterUrl: string;
  instagramUrl: string;
  title: string;
  image: FileList;
  description: string;

  isForSale: string;

  /**
   * 販売種別：通常販売のみ。
   * 送信時に isForSale に応じて固定値をセットする（"normal" / ""）。
   */
  saleType: string;

  price: string;

  gallery_type: string;
  displayPlan: string;

  agreeTerms: boolean;
  confirmRights: boolean;
  confirmOriginal: boolean;

  editionTotal: string;
  displayStartAt?: string;
  displayEndAt?: string;

  has_signature: 'yes' | 'no'; // ★ 追加：サイン有無

  // ★ 追加（販売時のみ必須にする口座情報）
  bank_code: string;          // 4桁
  branch_code: string;        // 3桁
  account_type: 'futsu' | 'toza';
  account_number: string;     // 1〜7桁
  account_name_kana: string;  // 全角カナ
  agree_bank_use: boolean;    // 利用同意

  editionMode: 'limited' | 'unlimited';

  ai_usage: 'none' | 'assist' | 'gen_assist';
  ai_usage_scope?: string[];
  ai_usage_note?: string;
  agreePromotion?: boolean; // 公式広報での紹介に同意
  agreeStorage?: boolean;   // 展示終了後も作品データを保持（ポートフォリオ用途）

};

const slideVariants = {
  enter: (dir: 'left' | 'right') => ({ x: dir === 'left' ? -300 : 300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: 'left' | 'right') => ({ x: dir === 'left' ? 300 : -300, opacity: 0 }),
};

const STEPS = [
  { num: 1, label: 'アーティスト情報' },
  { num: 2, label: '作品情報' },
  { num: 3, label: '販売・規約' },
  { num: 4, label: '確認' },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, idx) => (
        <div key={s.num} className="flex items-center">
          <div
            className={`
              flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all
              ${currentStep === s.num
                ? 'bg-[#00a1e9] text-white shadow-md'
                : currentStep > s.num
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }
            `}
            aria-current={currentStep === s.num ? 'step' : undefined}
          >
            {currentStep > s.num ? '✓' : s.num}
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={`w-8 h-0.5 mx-1 transition-colors ${
                currentStep > s.num ? 'bg-emerald-500' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

const FormWrapper = () => {
  const methods = useForm<FormValues>({
    defaultValues: {
      artistName: '',
      email: '',
      snsLinks: [''],
      homepageUrl: '',
      twitterUrl: '',
      instagramUrl: '',
      title: '',
      image: undefined as unknown as FileList,
      description: '',

      isForSale: '',
      saleType: 'normal', // 既定は normal（通常販売のみ）
      price: '',

      gallery_type: '',
      displayPlan: '',

      agreeTerms: false,
      confirmRights: false,
      confirmOriginal: false,

            // ★ 任意同意（Step3）
      agreePromotion: false,
      agreeStorage: false,


      has_signature: undefined as unknown as 'yes' | 'no',

      editionMode: 'limited',
      editionTotal: '',

      // ★ 追加：口座系は空でOK（Step3の「販売する」選択時のみ必須化）
      bank_code: '',
      branch_code: '',
      account_type: undefined as unknown as 'futsu' | 'toza',
      account_number: '',
      account_name_kana: '',
      agree_bank_use: false,

      // ★ AI使用区分（Step2で必須）
      ai_usage: undefined as unknown as 'none' | 'assist' | 'gen_assist',
      ai_usage_scope: undefined,
      ai_usage_note: '',
    },
    shouldUnregister: false,
    mode: 'onChange',
    reValidateMode: 'onChange',
    shouldFocusError: true,
    criteriaMode: 'all',
  });

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [preview, setPreview] = useState<string | null>(null);
  const [localImageFile, setLocalImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false); // ★ 二重送信防止

  const getStepFields = (
    step: number,
    isForSale: string,
    editionMode: FormValues['editionMode']
  ): (keyof FormValues)[] => {
    switch (step) {
      case 1:
        return ['artistName', 'email'];

      case 2:
        return ['gallery_type', 'title', 'image', 'has_signature', 'ai_usage'];

      case 3: {
        const base: (keyof FormValues)[] = ['isForSale', 'agreeTerms', 'confirmRights', 'confirmOriginal'];

        if (isForSale === 'yes') {
          // ★ saleType は UI が無いので検証対象から外す（送信時に "normal" 固定）
          base.push('price', 'displayPlan', 'editionMode');

          if (editionMode === 'limited') base.push('editionTotal');

          // 口座の必須チェックは現状どおり
          base.push(
            'bank_code',
            'branch_code',
            'account_type',
            'account_number',
            'account_name_kana',
            'agree_bank_use'
          );
        }

        return base;
      }

      default:
        return [];
    }
  };

  const nextStep = async () => {
    const isForSale = methods.getValues('isForSale');
    const editionMode = methods.getValues('editionMode');
    const fieldsToValidate = getStepFields(step, isForSale, editionMode);
    const ok = await methods.trigger(fieldsToValidate, { shouldFocus: true });

    if (!ok) {
      const first = fieldsToValidate.find((name) => methods.getFieldState(name).invalid);
      if (first) {
        const el = document.querySelector(`[name="${String(first)}"]`) as HTMLElement | null;
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setDirection('right');
    setStep((prev) => prev + 1);
  };

  // ★ 戻る処理
  const prevStep = () => {
    setDirection('left');
    setStep((prev) => Math.max(1, prev - 1));
  };

  const onSubmit = async (data: FormValues & { meish_fee_yen?: number; artist_reward_yen?: number }) => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const externalUserId = uuidv4();
      const snsLinksJson = JSON.stringify({
        homepage: data.homepageUrl || '',
        twitter: data.twitterUrl || '',
        instagram: data.instagramUrl || '',
      });

      const imageFile = data.image instanceof FileList && data.image.length > 0 ? data.image[0] : null;
      if (!imageFile) {
        alert('画像ファイルが見つかりませんでした');
        setSubmitting(false);
        return;
      }

      // 展示開始/終了日は display_ready=true 時（sync-display-ready）に設定
      // 応募時点では null のまま

      // ファイル名サニタイズ
      const originalName = imageFile.name;
      const extension = originalName.split('.').pop();
      const baseName = originalName.split('.').slice(0, -1).join('.');
      const sanitizedBase = baseName.normalize('NFKC').replace(/[^\w.-]/g, '_');
      const fileName = `${Date.now()}_${sanitizedBase}.${extension}`;

      // 画像アップロード
      const uploadRes = await supabase.storage.from('artworks').upload(fileName, imageFile, { upsert: true });
      if (uploadRes.error || !uploadRes.data) {
        alert('画像のアップロードに失敗しました');
        setSubmitting(false);
        return;
      }

      const { publicUrl } = supabase.storage.from('artworks').getPublicUrl(uploadRes.data.path).data;
      if (!publicUrl) {
        alert('画像URLの取得に失敗しました');
        setSubmitting(false);
        return;
      }

      const isSale = data.isForSale === 'yes';

      // 販売時は常に normal 固定
      const saleTypeFixed = isSale ? 'normal' : '';
      const type = isSale ? 'normal' : 'none';

      const displayPlan = isSale ? (data.displayPlan || 'free') : 'free';
      const planAmountMap: Record<string, number> = {
        free: 0,
        mini: 400,
        light: 800,
        standard: 1200,
        premium: 2400,
      };
      const planAmountYen = planAmountMap[displayPlan] ?? 0;
      const planPaymentRequired = isSale && displayPlan !== 'free';
      const planPaymentStatus = planPaymentRequired ? 'pending' : 'unneeded';

      const editionModeToSave: 'limited' | 'unlimited' | null = isSale ? data.editionMode : null;

      let editionTotalNum: number | null = null;
      if (isSale && editionModeToSave === 'limited') {
        const n = Number.parseInt(data.editionTotal, 10);
        if (!Number.isFinite(n) || n <= 0) {
          alert('エディション総数は1以上の整数で入力してください');
          setSubmitting(false);
          return;
        }
        editionTotalNum = n;
      }

      const FEE_RATE = 0.10;
      const priceNum =
        isSale && data.price
          ? Number(String(data.price).replace(/[^\d]/g, ''))
          : 0;

      const meishFeeYen = Math.floor(priceNum * FEE_RATE);
      const artistRewardYen = Math.max(0, priceNum - meishFeeYen);

      // ★ entries 登録
      const { error } = await supabase.from('entries').insert([
        {
          artist_name: data.artistName,
          email: data.email,
          sns_links: snsLinksJson,
          title: data.title,
          description: data.description || '',

          is_for_sale: isSale,
          sale_type: saleTypeFixed,
          type,

          display_plan: displayPlan,
          plan_payment_status: planPaymentStatus,
          plan_payment_amount_yen: planPaymentRequired ? planAmountYen : null,
          price: isSale ? priceNum : null,

          image_url: publicUrl,

          // ★ edition関連（重複なし）
          edition_mode: editionModeToSave, // 'limited' | 'unlimited' | null
          edition_total: editionTotalNum,  // limited のときだけ 1以上の整数、unlimited/非売品は null
          edition_sold: 0,

          gallery_type: data.gallery_type || '',
          display_start_at: null,  // sync-display-ready で設定
          display_end_at: null,    // sync-display-ready で設定

          file_name: fileName,
          external_user_id: externalUserId,

          meish_fee_yen: isSale ? meishFeeYen : null,
          artist_reward_yen: isSale ? artistRewardYen : null,

          has_signature: data.has_signature === 'yes',

          // ★ AI使用区分
          ai_usage: data.ai_usage,
          ai_usage_scope: data.ai_usage === 'gen_assist' ? (data.ai_usage_scope ?? null) : null,
          ai_usage_note: data.ai_usage === 'gen_assist' ? (data.ai_usage_note ?? null) : null,
                    // ★ 任意同意（Step3）
          agree_promotion: !!data.agreePromotion,
          agree_storage: !!data.agreeStorage,

        },
      ]);

      if (error) {
        alert(`登録に失敗しました: ${error.message}`);
        setSubmitting(false);
        return;
      }

      // ★ 販売する場合のみ、口座情報を別テーブルに保存
      if (isSale) {
        const { error: bankErr } = await supabase
          .from('artists_bank_accounts')
          .upsert(
            [
              {
                external_user_id: externalUserId,
                bank_code: data.bank_code,
                branch_code: data.branch_code,
                account_type: data.account_type,
                account_number: data.account_number,
                account_name_kana: data.account_name_kana,
              },
            ],
            { onConflict: 'external_user_id' }
          );

        if (bankErr) {
          alert(`口座情報の登録に失敗しました: ${bankErr.message}`);
          setSubmitting(false);
          return;
        }
      }

      // 完了画面へ
      setStep(5);

      // 完了メール（既存）
      try {
        await sendEmail('submit', {
          to: data.email,
          name: data.artistName,
        });
      } catch (e) {
        console.error('submit mail failed:', e);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      alert(`送信中にエラーが発生しました：${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <div className="max-w-[700px] w-full mx-auto px-4 py-8">
        {step === 5 ? (
          <CompletePage />
        ) : (
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <StepIndicator currentStep={step} />
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 && (
                <motion.div
                  key="step1"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="text-xl md:text-2xl font-bold text-[#023] mb-6 flex items-center gap-2">
                    <span className="text-[#00a1e9]">STEP 1</span>
                    <span className="text-gray-300">|</span>
                    アーティスト情報
                  </h2>
                  <Step1_ArtistInfo />
                  <div className="flex justify-end mt-8">
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="rounded-full px-6 py-2.5 h-auto font-semibold shadow-md hover:shadow-lg transition-all"
                    >
                      次へ <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="text-xl md:text-2xl font-bold text-[#023] mb-6 flex items-center gap-2">
                    <span className="text-[#00a1e9]">STEP 2</span>
                    <span className="text-gray-300">|</span>
                    作品情報
                  </h2>
                  <Step2_WorkInfo
                    preview={preview}
                    setPreview={setPreview}
                    localImageFile={localImageFile}
                    setLocalImageFile={setLocalImageFile}
                  />
                  <div className="flex justify-between mt-8">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={prevStep}
                      className="rounded-full px-5 py-2.5 h-auto font-medium border-gray-300 hover:bg-gray-50"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" /> 戻る
                    </Button>
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="rounded-full px-6 py-2.5 h-auto font-semibold shadow-md hover:shadow-lg transition-all"
                    >
                      次へ <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="text-xl md:text-2xl font-bold text-[#023] mb-6 flex items-center gap-2">
                    <span className="text-[#00a1e9]">STEP 3</span>
                    <span className="text-gray-300">|</span>
                    販売・規約
                  </h2>
                  <Step3_SalesAndAgreement />
                  <div className="flex justify-between mt-8">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={prevStep}
                      className="rounded-full px-5 py-2.5 h-auto font-medium border-gray-300 hover:bg-gray-50"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" /> 戻る
                    </Button>
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="rounded-full px-6 py-2.5 h-auto font-semibold shadow-md hover:shadow-lg transition-all"
                    >
                      次へ <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="text-xl md:text-2xl font-bold text-[#023] mb-6 flex items-center gap-2">
                    <span className="text-[#00a1e9]">STEP 4</span>
                    <span className="text-gray-300">|</span>
                    入力内容の確認
                  </h2>
                  <ConfirmPage
                    onBack={() => {
                      setDirection('left');
                      setStep(3);
                    }}
                  />
                  <div className="flex justify-between mt-8">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={prevStep}
                      className="rounded-full px-5 py-2.5 h-auto font-medium border-gray-300 hover:bg-gray-50"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" /> 戻る
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="rounded-full px-8 py-3 h-auto font-semibold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-[#00a1e9] to-[#0080c0] hover:from-[#0090d4] hover:to-[#0070a8] disabled:opacity-60"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          送信中...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          送信する
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        )}
      </div>
    </FormProvider>
  );
};

export default FormWrapper;
