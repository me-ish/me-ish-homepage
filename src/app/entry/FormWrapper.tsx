'use client';

import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { AnimatePresence, motion } from 'framer-motion';
import Step1_ArtistInfo from '@/components/entryForm/Step1_ArtistInfo';
import Step2_WorkInfo from '@/components/entryForm/Step2_WorkInfo';
import Step3_SalesAndAgreement from '@/components/entryForm/Step3_SalesAndAgreement';
import ConfirmPage from '@/components/entryForm/ConfirmPage';
import CompletePage from '@/components/entryForm/CompletePage';
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
  saleType: string;
  price: string;
  wallet: string;
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
};

const slideVariants = {
  enter: (dir: 'left' | 'right') => ({ x: dir === 'left' ? -300 : 300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: 'left' | 'right') => ({ x: dir === 'left' ? 300 : -300, opacity: 0 }),
};

const FormWrapper = () => {
  const methods = useForm<FormValues>({
    defaultValues: {
      artistName: '', email: '', snsLinks: [''], homepageUrl: '',
      twitterUrl: '', instagramUrl: '', title: '', image: undefined as unknown as FileList,
      description: '', isForSale: '', saleType: '', price: '', gallery_type: '', displayPlan: '',
      agreeTerms: false, confirmRights: false, confirmOriginal: false,
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
    case 1: return ['artistName', 'email'];
    case 2: return ['gallery_type', 'title', 'image', 'has_signature'];
    case 3: {
      const base: (keyof FormValues)[] = ['isForSale', 'agreeTerms', 'confirmRights', 'confirmOriginal'];
      if (isForSale === 'yes') {
        base.push('saleType', 'price', 'displayPlan', 'editionMode'); // ★ 追加
        if (editionMode === 'limited') base.push('editionTotal');     // ★ 条件追加
        // 口座の必須チェックは現状どおり
        base.push('bank_code', 'branch_code', 'account_type', 'account_number', 'account_name_kana', 'agree_bank_use');
      }
      return base;
    }
    default: return [];
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

      const now = new Date();
      let displayStartAt: string | null = null;
      let displayEndAt: string | null = null;
      if (data.gallery_type === 'white') {
        displayStartAt = now.toISOString();
      } else if (data.gallery_type === 'float') {
        const end = new Date(now);
        end.setMonth(end.getMonth() + 1);
        displayStartAt = now.toISOString();
        displayEndAt = end.toISOString();
      }

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

      const type = data.isForSale === 'yes' ? data.saleType : 'none';
      const displayPlan = data.isForSale === 'yes' ? data.displayPlan || 'free' : 'free';

      // ★ entries 登録（既存ロジックを維持）
      const { error } = await supabase.from('entries').insert([{
        artist_name: data.artistName,
        email: data.email,
        sns_links: snsLinksJson,
        title: data.title,
        description: data.description || '',
        is_for_sale: data.isForSale === 'yes',
        sale_type: data.saleType || '',
        type,
        display_plan: displayPlan,
        price: data.isForSale === 'yes' && data.price ? Number(data.price) : null,
        image_url: publicUrl,
        gallery_type: data.gallery_type || '',
        display_start_at: displayStartAt,
        display_end_at: displayEndAt,
        file_name: fileName,
        external_user_id: externalUserId,
           // 無制限⇄限定の切替に強い代入（限定のときだけ数値、無制限は必ず null）
  　　　 edition_total:
    　　 data.isForSale === 'yes'
       ? (data.editionMode === 'limited' ? Number(data.editionTotal) : null)
       : null,
        edition_sold: 0,
        meish_fee_yen: (data as any).meish_fee_yen ?? null,
        artist_reward_yen: (data as any).artist_reward_yen ?? null,
        has_signature: data.has_signature === 'yes',
      }]);

      if (error) {
        alert(`登録に失敗しました: ${error.message}`);
        setSubmitting(false);
        return;
      }

      // ★ 販売する場合のみ、口座情報を別テーブルに保存したい場合はここで upsert（任意）
      //   ※ 既存のスキーマに合わせてコメントアウト。テーブルがあるなら解除してください。
      if (data.isForSale === 'yes') {
        const { error: bankErr } = await supabase
          .from('artists_bank_accounts')
          .upsert([{
            external_user_id: externalUserId,
            bank_code: data.bank_code,
            branch_code: data.branch_code,
            account_type: data.account_type,
            account_number: data.account_number,
            account_name_kana: data.account_name_kana,
          }], { onConflict: 'external_user_id' });
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
          // manageUrl: `https://www.me-ish.art/manage/${externalUserId}`,
        });
      } catch (e) {
        console.error('submit mail failed:', e);
      }
    } catch (e: any) {
      alert(`送信中にエラーが発生しました：${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <div className="max-w-[700px] w-full mx-auto px-4 py-10">
        {step === 5 ? (
          <CompletePage />
        ) : (
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 && (
                <motion.div key="step1" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }}>
                  <h2 className="text-2xl font-bold mb-6">STEP 1：アーティスト情報</h2>
                  <Step1_ArtistInfo />
                  <div className="flex justify-end mt-6">
                    <button type="button" onClick={nextStep} className="button">次へ</button>
                  </div>
                </motion.div>
              )}
              {step === 2 && (
                <motion.div key="step2" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }}>
                  <h2 className="text-2xl font-bold mb-6">STEP 2：作品情報</h2>
                  <Step2_WorkInfo preview={preview} setPreview={setPreview} localImageFile={localImageFile} setLocalImageFile={setLocalImageFile} />
                  <div className="flex justify-between mt-6">
                    <button type="button" onClick={prevStep} className="button">戻る</button>
                    <button type="button" onClick={nextStep} className="button">次へ</button>
                  </div>
                </motion.div>
              )}
              {step === 3 && (
                <motion.div key="step3" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }}>
                  <h2 className="text-2xl font-bold mb-6">STEP 3：販売・規約</h2>
                  <Step3_SalesAndAgreement />
                  <div className="flex justify-between mt-6">
                    <button type="button" onClick={prevStep} className="button">戻る</button>
                    <button type="button" onClick={nextStep} className="button">次へ</button>
                  </div>
                </motion.div>
              )}
              {step === 4 && (
                <motion.div key="step4" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }}>
                  <h2 className="text-2xl font-bold mb-6">STEP 4：入力内容の確認</h2>
                  <ConfirmPage
                    onBack={() => {
                      setDirection('left');
                      setStep(3);
                    }}
                    onSubmit={onSubmit}
                    validateFields={['agreeTerms', 'confirmRights', 'confirmOriginal']}
                  />
                  <div className="flex justify-between mt-6">
                    <button type="button" onClick={prevStep} className="button">戻る</button>
                    <button type="submit" disabled={submitting} className="button bg-[#00a1e9] text-white hover:bg-[#008ec4] disabled:opacity-60">
                      送信
                    </button>
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
