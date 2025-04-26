// src/pages/Entry.jsx
import React from 'react';
import FormWrapper from '../entryForm/FormWrapper';

const Entry = () => {
  return (
    <div className="form-wrapper"> {/* ← ここにクラス名を追加！ */}
      <h1 style={{ textAlign: 'center' }}>me-ish 作品応募フォーム</h1>
      <FormWrapper />
    </div>
  );
};

export default Entry;
