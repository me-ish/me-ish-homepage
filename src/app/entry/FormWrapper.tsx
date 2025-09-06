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

  const getStepFields = (step: number, isForSale: string): (keyof FormValues)[] => {
    switch (step) {
      case 1: return ['artistName', 'email'];
      case 2: return ['gallery_type', 'title', 'image'];
      case 3: return [
        'isForSale', 'agreeTerms', 'confirmRights', 'confirmOriginal',
        ...(isForSale === 'yes' ? (['saleType', 'price', 'displayPlan'] as (keyof FormValues)[]) : [])
      ];
      default: return [];
    }
  };

const nextStep = async () => {
  const isForSale = methods.getValues('isForSale');
  const fieldsToValidate = getStepFields(step, isForSale);
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

// ★ 追加：戻る処理
const prevStep = () => {
  setDirection('left');
  setStep((prev) => Math.max(1, prev - 1));
};



  const onSubmit = async (data: FormValues & { meish_fee_yen?: number; artist_reward_yen?: number }) => {
    try {
      const externalUserId = uuidv4();
      const snsLinksJson = JSON.stringify({
        homepage: data.homepageUrl || '',
        twitter: data.twitterUrl || '',
        instagram: data.instagramUrl || '',
      });

      const imageFile = data.image instanceof FileList && data.image.length > 0 ? data.image[0] : null;
      if (!imageFile) return alert('画像ファイルが見つかりませんでした');

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

      const originalName = imageFile.name;
      const extension = originalName.split('.').pop();
      const baseName = originalName.split('.').slice(0, -1).join('.');
      const sanitizedBase = baseName.normalize('NFKC').replace(/[^\w.-]/g, '_');
      const fileName = `${Date.now()}_${sanitizedBase}.${extension}`;

      const uploadRes = await supabase.storage.from('artworks').upload(fileName, imageFile, { upsert: true });
      if (uploadRes.error || !uploadRes.data) return alert('画像のアップロードに失敗しました');

      const { publicUrl } = supabase.storage.from('artworks').getPublicUrl(uploadRes.data.path).data;
      if (!publicUrl) return alert('画像URLの取得に失敗しました');

      const type = data.isForSale === 'yes' ? data.saleType : 'none';
      const displayPlan = data.isForSale === 'yes' ? data.displayPlan || 'free' : 'free';

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
        price: data.price ? Number(data.price) : null,
        image_url: publicUrl,
        gallery_type: data.gallery_type || '',
        display_start_at: displayStartAt,
        display_end_at: displayEndAt,
        file_name: fileName,
        external_user_id: externalUserId,
        edition_total: data.editionTotal ? Number(data.editionTotal) : null,
        edition_sold: 0,
        meish_fee_yen: data.meish_fee_yen ?? null,
        artist_reward_yen: data.artist_reward_yen ?? null,
      }]);

      if (error) return alert(`登録に失敗しました: ${error.message}`);
      setStep(5);

      await fetch('/api/send-email/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: data.email, name: data.artistName, externalUserId }),
      });
    } catch (e: any) {
      alert(`送信中にエラーが発生しました：${e.message}`);
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
                    <button type="submit" className="button bg-[#00a1e9] text-white hover:bg-[#008ec4]">送信</button>
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

