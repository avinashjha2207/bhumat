'use client';

import React, { useState } from 'react';
import { supabase } from './utils/supabaseClient';

interface SuggestPollModalProps {
  voterToken: string;
  username: string;
  userState: string;
  userSeat: string;
  userDbgBalance: number;
  lang: 'EN' | 'HI';
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

const SUGGEST_FEE_DBG = 5;

export default function SuggestPollModal({
  voterToken,
  username,
  userState,
  userSeat,
  userDbgBalance,
  lang,
  onClose,
  onSuccess
}: SuggestPollModalProps) {
  const [category, setCategory] = useState<'JanMat' | 'LokMat'>('LokMat');
  const [questionText, setQuestionText] = useState('');
  const [questionTextHi, setQuestionTextHi] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleOptionChange = (idx: number, val: string) => {
    const updated = [...options];
    updated[idx] = val;
    setOptions(updated);
  };

  const handleAddOption = () => {
    if (options.length < 4) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== idx));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!questionText.trim()) {
      setErrorMsg(lang === 'HI' ? 'कृपया अपना प्रश्न लिखें।' : 'Please enter your proposed question.');
      return;
    }

    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      setErrorMsg(lang === 'HI' ? 'कम से कम 2 विकल्प आवश्यक हैं।' : 'At least 2 options are required.');
      return;
    }

    // Balance verification at submission time
    if (userDbgBalance < SUGGEST_FEE_DBG) {
      setErrorMsg(
        lang === 'HI'
          ? `पर्याप्त DBG नहीं है। सुझाव शुल्क 5 DBG है (आपका शेष: ${userDbgBalance} DBG)। रोज़ वोट देकर या मित्रों को जोड़कर DBG कमाएं।`
          : `Insufficient DBG balance. Suggesting a poll costs 5 DBG (Your balance: ${userDbgBalance} DBG). Vote daily or invite friends to earn credits.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const formattedOptions = validOptions.map((opt, i) => ({
        id: i,
        text_en: opt,
        text_hi: opt
      }));

      // Atomic deduction & submission RPC
      const { data, error } = await supabase.rpc('propose_citizen_poll', {
        p_voter_token: voterToken,
        p_category: category,
        p_title_en: questionText.trim(),
        p_title_hi: questionTextHi.trim() || questionText.trim(),
        p_options: JSON.stringify(formattedOptions)
      });

      if (error || (data && data.success === false)) {
        throw new Error(error?.message || data?.error || 'Submission failed');
      }

      const updatedBalance = data?.new_balance !== undefined ? data.new_balance : userDbgBalance - SUGGEST_FEE_DBG;
      onSuccess(updatedBalance);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Transaction aborted. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px',
        overflowY: 'auto'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '420px',
          padding: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxSizing: 'border-box',
          margin: 'auto'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '15px' }}>💡</span>
            <span style={{ fontSize: '11px', fontWeight: 900, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {lang === 'HI' ? 'संपादकीय प्रश्न सुझाव' : 'SUGGEST A QUESTION'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '26px',
              height: '26px',
              cursor: 'pointer',
              fontWeight: 800,
              color: '#64748b'
            }}
          >
            ✕
          </button>
        </div>

        {/* Title & Explainer */}
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', fontWeight: 900, color: '#0f172a' }}>
            {lang === 'HI' ? 'राष्ट्रीय मंच पर सवाल उठाएं' : 'Propose a Topic for Bharat'}
          </h3>
          <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b', lineHeight: 1.4 }}>
            {lang === 'HI'
              ? `संपादकीय मंडल द्वारा स्वीकृत होने पर आपका प्रश्न 543 संसदीय क्षेत्रों में लाइव किया जाएगा (शुल्क: ${SUGGEST_FEE_DBG} DBG)।`
              : `Reviewed by the editorial desk. If approved, your topic drops nationally across all 543 seats (Fee: ${SUGGEST_FEE_DBG} DBG).`}
          </p>
        </div>

        {/* Pillar Choice Pill (LokMat First, JanMat Second) */}
        <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
          <button
            type="button"
            onClick={() => setCategory('LokMat')}
            style={{
              flex: 1,
              padding: '7px 0',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: category === 'LokMat' ? '#d97706' : 'transparent',
              color: category === 'LokMat' ? '#ffffff' : '#92400e',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            🌅 {lang === 'HI' ? 'लोकमत (सांस्कृतिक)' : 'LokMat (Culture)'}
          </button>
          <button
            type="button"
            onClick={() => setCategory('JanMat')}
            style={{
              flex: 1,
              padding: '7px 0',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: category === 'JanMat' ? '#059669' : 'transparent',
              color: category === 'JanMat' ? '#ffffff' : '#065f46',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            🌆 {lang === 'HI' ? 'जनमत (नागरिक ऑडिट)' : 'JanMat (Civic Audit)'}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Question Text English */}
          <div>
            <label style={{ fontSize: '10.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
              {lang === 'HI' ? 'प्रश्न (अंग्रेजी या हिंग्लिश में):' : 'Proposed Question (English):'}
            </label>
            <input
              type="text"
              placeholder={lang === 'HI' ? "उदा. Is drinking water pressure adequate in your ward?" : "e.g. Is drinking water pressure adequate in your ward?"}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '12.5px',
                marginTop: '3px'
              }}
            />
          </div>

          {/* Question Text Hindi (Optional) */}
          <div>
            <label style={{ fontSize: '10.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
              {lang === 'HI' ? 'प्रश्न हिन्दी में (वैकल्पिक):' : 'Question in Hindi (Optional):'}
            </label>
            <input
              type="text"
              placeholder={lang === 'HI' ? "उदा. क्या आपके वार्ड में पेयजल आपूर्ति संतोषजनक है?" : "Optional Hindi translation..."}
              value={questionTextHi}
              onChange={(e) => setQuestionTextHi(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '12.5px',
                marginTop: '3px'
              }}
            />
          </div>

          {/* Options */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <label style={{ fontSize: '10.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                {lang === 'HI' ? 'विकल्प (2 से 4):' : 'Ballot Options (2 to 4):'}
              </label>
              {options.length < 4 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284c7',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  + {lang === 'HI' ? 'विकल्प जोड़ें' : 'Add Option'}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {options.map((opt, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', width: '18px' }}>
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    placeholder={`${lang === 'HI' ? 'विकल्प' : 'Option'} ${idx + 1}`}
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px'
                    }}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      style={{
                        background: '#f1f5f9',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        color: '#dc2626',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '8px 10px',
              color: '#b91c1c',
              fontSize: '11px',
              lineHeight: 1.35
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Wallet Balance & Submit Dock */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '8px 12px',
            marginTop: '4px'
          }}>
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
                {lang === 'HI' ? 'आपका DBG शेष:' : 'Current DBG Balance:'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: userDbgBalance >= SUGGEST_FEE_DBG ? '#059669' : '#dc2626' }}>
                ⚡ {userDbgBalance} DBG
              </div>
            </div>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
              {lang === 'HI' ? 'शुल्क: 5 DBG (अप्रतिदेय)' : 'Fee: 5 DBG (Non-refundable)'}
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: submitting ? 'wait' : 'pointer',
              marginTop: '4px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
            }}
          >
            {submitting
              ? (lang === 'HI' ? 'प्रस्ताव भेजा जा रहा है...' : 'Submitting to Queue...')
              : (lang === 'HI' ? `संपादकीय सुझाव भेजें (${SUGGEST_FEE_DBG} DBG)` : `Submit Suggestion (${SUGGEST_FEE_DBG} DBG)`)}
          </button>
        </form>
      </div>
    </div>
  );
}