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
};

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
      saleType: '',
      price: '',
      wallet: '',
      gallery_type: '',
      displayPlan: '',
      agreeTerms: false,
      confirmRights: false,
      confirmOriginal: false,
    },
    shouldUnregister: false,
  });

  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const [localImageFile, setLocalImageFile] = useState<File | null>(null);

  const getStepFields = (step: number, isForSale: string): (keyof FormValues)[] => {
    switch (step) {
      case 1:
        return ['artistName', 'email'];
      case 2:
        return ['gallery_type', 'title', 'image'];
      case 3:
        return [
          'isForSale',
          'agreeTerms',
          'confirmRights',
          'confirmOriginal',
          ...(isForSale === 'yes'
            ? (['saleType', 'price', 'displayPlan'] as (keyof FormValues)[])
            : []),
        ];
      default:
        return [];
    }
  };

  const nextStep = async () => {
    const isForSale = methods.watch('isForSale');
    const fieldsToValidate = getStepFields(step, isForSale);
    const isValid = await methods.trigger(fieldsToValidate);
    if (isValid) setStep((prev) => prev + 1);
  };

  const prevStep = () => setStep((prev) => prev - 1);

  const onSubmit = async (data: FormValues) => {
    try {
      const snsLinksJson = JSON.stringify({
        homepage: data.homepageUrl || '',
        twitter: data.twitterUrl || '',
        instagram: data.instagramUrl || '',
      });

      const imageFile =
        data.image instanceof FileList && data.image.length > 0 ? data.image[0] : null;

      if (!imageFile) {
        alert('画像ファイルが見つかりませんでした');
        return;
      }

      const originalName = imageFile.name;
      const extension = originalName.split('.').pop();
      const baseName = originalName.split('.').slice(0, -1).join('.');
      const sanitizedBase = baseName.normalize('NFKC').replace(/[^\w.-]/g, '_');
      const fileName = `${Date.now()}_${sanitizedBase}.${extension}`;

      const uploadRes = await supabase.storage.from('artworks').upload(fileName, imageFile, {
        upsert: true,
      });

      if (uploadRes.error || !uploadRes.data) {
        alert('画像のアップロードに失敗しました');
        return;
      }

      const { publicUrl } = supabase.storage.from('artworks').getPublicUrl(uploadRes.data.path).data;
      if (!publicUrl) {
        alert('画像URLの取得に失敗しました');
        return;
      }

      const type = data.isForSale === 'yes' ? data.saleType : 'none';
      const displayPlan = data.isForSale === 'yes' ? data.displayPlan || 'free' : 'free';

      const { error } = await supabase.from('entries').insert([
        {
          artist_name: data.artistName,
          email: data.email,
          sns_links: snsLinksJson,
          title: data.title,
          description: data.description || '',
          is_for_sale: data.isForSale === 'yes',
          sale_type: data.saleType || '',
          type,                    // ✅ New: entries.type に保存
          display_plan: displayPlan, // ✅ New: entries.display_plan に保存
          price: data.price ? Number(data.price) : null,
          wallet_address: data.wallet || '',
          image_url: publicUrl,
          gallery_type: data.gallery_type || '',
          file_name: fileName,
        },
      ]);

      if (error) {
        alert(`登録に失敗しました: ${error.message}`);
        return;
      }

      setStep(5);

      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: data.email, name: data.artistName }),
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
        ) : step === 4 ? (
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <ConfirmPage
              onBack={() => setStep(3)}
              onSubmit={onSubmit}
              validateFields={['agreeTerms', 'confirmRights', 'confirmOriginal']}
            />
          </form>
        ) : (
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ x: 300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="text-2xl font-bold mb-6">STEP 1：アーティスト情報</h2>
                  <Step1_ArtistInfo />
                  <div className="flex justify-end mt-6">
                    <button type="button" onClick={nextStep} className="button">次へ</button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ x: 300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="text-2xl font-bold mb-6">STEP 2：作品情報</h2>
                  <Step2_WorkInfo
                    preview={preview}
                    setPreview={setPreview}
                    localImageFile={localImageFile}
                    setLocalImageFile={setLocalImageFile}
                  />
                  <div className="flex justify-between mt-6">
                    <button type="button" onClick={prevStep} className="button">戻る</button>
                    <button type="button" onClick={nextStep} className="button">次へ</button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ x: 300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="text-2xl font-bold mb-6">STEP 3：販売・規約</h2>
                  <Step3_SalesAndAgreement />
                  <div className="flex justify-between mt-6">
                    <button type="button" onClick={prevStep} className="button">戻る</button>
                    <button type="button" onClick={nextStep} className="button">次へ</button>
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

