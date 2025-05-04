import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import Step1_ArtistInfo from './Step1_ArtistInfo';
import Step2_WorkInfo from './Step2_WorkInfo';
import Step3_SalesAndAgreement from './Step3_SalesAndAgreement';
import ConfirmPage from './ConfirmPage';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

function FormWrapper() {
  const methods = useForm({
    defaultValues: {
      artistName: '',
      email: '',
      snsLinks: [''],
      title: '',
      image: null,
      description: '',
      isForSale: '',
      saleType: '',
      price: '',
      wallet: '',
      agreeTerms: false,
      confirmRights: false,
      confirmOriginal: false,
    },
  });

  const [step, setStep] = useState(1);

  const getStepFields = (step) => {
    switch (step) {
      case 1:
        return ['artistName', 'email'];
      case 2:
        return ['title', 'image'];
      case 3:
        return ['agreeTerms', 'confirmRights', 'confirmOriginal'];
      default:
        return [];
    }
  };

  const nextStep = async () => {
    const fieldsToValidate = getStepFields(step);
    const isValid = await methods.trigger(fieldsToValidate);
    if (isValid) setStep((prev) => prev + 1);
  };

  const prevStep = () => setStep((prev) => prev - 1);

  const onSubmit = async (data) => {
    try {
      const snsLinks = {
        homepage: data.homepageUrl || '',
        twitter: data.twitterUrl || '',
        instagram: data.instagramUrl || '',
      };
      const snsLinksJson = JSON.stringify(snsLinks);

      const imageFile = Array.isArray(data.image) ? data.image[0] : data.image;
      if (!imageFile) {
        alert('画像ファイルが見つかりませんでした');
        return;
      }

      // 修正ポイント：アンダーバー2つを維持しつつ不正文字を除外
      const safeName = imageFile.name
        .normalize("NFKC")                      // 全角を半角へ、結合文字除去など
        .replace(/[^\w.\-]/g, '_');             // アンダーバー・英数字・ドット・ハイフンのみ許可

      const fileName = `${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('artworks')
        .upload(fileName, imageFile);

      if (uploadError) {
        console.error('画像アップロードエラー:', uploadError);
        alert('画像のアップロードに失敗しました');
        return;
      }

      const imageUrl = supabase.storage
        .from('artworks')
        .getPublicUrl(fileName).data.publicUrl;

      const { error: insertError } = await supabase.from('entries').insert([{
        artist_name: data.artistName,
        email: data.email,
        sns_links: snsLinksJson,
        title: data.title,
        description: data.description || '',
        is_for_sale: data.isForSale === 'yes',
        sale_type: data.saleType || '',
        price: data.price ? Number(data.price) : null,
        wallet_address: data.wallet || '',
        image_url: imageUrl,
        gallery_type: data.gallery_type || '',
        file_name: fileName,  // Supabaseに正確な名前を登録
      }]);

      if (insertError) {
        console.error('DB保存エラー:', insertError.message);
        alert('データの保存に失敗しました');
        return;
      }

      setStep(5);
    } catch (e) {
      console.error('送信中のエラー:', e);
      alert(`送信中にエラーが発生しました：${e.message}`);
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="form-wrapper">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} transition={{ duration: 0.4 }}>
              <h2 className="form-title">STEP 1：アーティスト情報</h2>
              <Step1_ArtistInfo />
              <div className="form-nav">
                <button type="button" onClick={nextStep}>次へ</button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} transition={{ duration: 0.4 }}>
              <h2 className="form-title">STEP 2：作品情報</h2>
              <Step2_WorkInfo />
              <div className="form-nav">
                <button type="button" onClick={prevStep}>戻る</button>
                <button type="button" onClick={nextStep}>次へ</button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} transition={{ duration: 0.4 }}>
              <h2 className="form-title">STEP 3：販売・規約</h2>
              <Step3_SalesAndAgreement />
              <div className="form-nav">
                <button type="button" onClick={prevStep}>戻る</button>
                <button type="button" onClick={nextStep}>次へ</button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} transition={{ duration: 0.4 }}>
              <ConfirmPage
                onBack={() => setStep(3)}
                onSubmit={methods.handleSubmit(onSubmit)}
              />
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="form-complete"
            >
              <h2 className="form-title">送信完了！</h2>
              <p>ご応募ありがとうございました。</p>
              <p>ご記入いただいた内容を確認し、後日ご連絡いたします。</p>

              <div className="form-nav">
                <a href="/float">
                  <button type="button">ギャラリーに戻る</button>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </FormProvider>
  );
}

export default FormWrapper;
