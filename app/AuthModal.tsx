'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredFor: 'JanMat' | 'LokMat' | 'General';
  userSeat: string;
  userState: string;
  onSuccess: (token: string, identifier: string, isVerifiedCitizen: boolean) => void;
  lang?: 'EN' | 'HI';
}

export default function AuthModal({
  isOpen,
  onClose,
  requiredFor,
  userSeat,
  userState,
  onSuccess,
  lang = 'EN'
}: AuthModalProps) {
  const isJanMat = requiredFor === 'JanMat';
  const [authMethod, setAuthMethod] = useState<'PHONE' | 'EMAIL'>(isJanMat ? 'PHONE' : 'EMAIL');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'INPUT' | 'OTP'>('INPUT');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  useEffect(() => {
    if (isJanMat) {
      setAuthMethod('PHONE');
    }
  }, [isJanMat]);

  if (!isOpen) return null;

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (authMethod === 'PHONE') {
        const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
        if (cleanPhone.length !== 10) {
          setErrorMsg(lang === 'HI' ? 'कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें' : 'Please enter a valid 10-digit mobile number');
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.rpc('request_phone_otp', {
          p_phone: cleanPhone
        });

        if (error || !data?.success) {
          throw new Error(data?.error || error?.message || 'Failed to dispatch OTP');
        }

        if (data?.dev_otp) {
          setDevOtpHint(data.dev_otp);
          setOtp(data.dev_otp);
        }
        setStep('OTP');
      } else {
        if (!email.includes('@') || !email.includes('.')) {
          setErrorMsg(lang === 'HI' ? 'मान्य ईमेल पता दर्ज करें' : 'Please enter a valid email address');
          setLoading(false);
          return;
        }

        const emailToken = 'em_' + Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase())))
        ).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20);

        await supabase.from('voter_wallets').upsert({
          voter_token: emailToken,
          dbg_balance: 1,
          is_verified: false,
          voting_since: new Date().toISOString()
        }, { onConflict: 'voter_token' });

        onSuccess(emailToken, email.trim(), false);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
      const guestToken = typeof window !== 'undefined' ? localStorage.getItem('bhumat_voter_token') : null;

      const { data, error } = await supabase.rpc('verify_phone_otp', {
        p_phone: cleanPhone,
        p_otp: otp.trim(),
        p_guest_token: guestToken,
        p_state: userState,
        p_seat: userSeat
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Invalid OTP code');
      }

      onSuccess(data.voter_token, cleanPhone, true);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 250,
      backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '390px',
        padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', position: 'relative',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', right: '16px', top: '16px', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '32px', marginBottom: '4px' }}>
            {isJanMat ? '🛡️' : '🗳️'}
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0' }}>
            {isJanMat
              ? (lang === 'HI' ? 'जनमत संप्रभु सत्यापन' : 'JanMat Sovereign Verification')
              : (lang === 'HI' ? 'नागरिक प्रवेश' : 'Citizen Access')}
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
            {isJanMat
              ? (lang === 'HI'
                  ? 'जनमत नीतिगत आडिट हेतु एकमुश्त मोबाइल OTP आवश्यक है ताकि घरेलू नागरिकता की पुष्टि हो सके।'
                  : 'One-time mobile OTP verification required to vote in JanMat to confirm domestic residency.')
              : (lang === 'HI'
                  ? 'सांस्कृतिक एवं सामान्य मतों के लिए ईमेल या मोबाइल से सीधे प्रवेश करें।'
                  : 'Sign in seamlessly with Email or Mobile OTP.')}
          </p>
        </div>

        {isJanMat && (
          <div style={{
            backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px',
            padding: '10px 12px', marginBottom: '14px', fontSize: '11px', color: '#166534', lineHeight: 1.45
          }}>
            <strong>🔒 {lang === 'HI' ? '100% गोपनीय मतपेटी' : '100% Secret Ballot'}:</strong>{' '}
            {lang === 'HI'
              ? 'जैसे चुनाव में उंगली की स्याही केवल मतदान की पुष्टि करती है, वैसे ही भूमत केवल यह जानता है कि आपने मत दिया है। आपका मोबाइल नंबर और आपका चुना हुआ विकल्प कभी लिंक नहीं हो सकते।'
              : 'Just like EVM voting ink on your finger, BhuMat confirms that you voted, but nobody—not even BhuMat engineers—can see which option you chose.'}
          </div>
        )}

        {!isJanMat && step === 'INPUT' && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => setAuthMethod('EMAIL')}
              style={{
                flex: 1, padding: '7px 0', borderRadius: '8px', border: `1.5px solid ${authMethod === 'EMAIL' ? '#0284c7' : '#cbd5e1'}`,
                backgroundColor: authMethod === 'EMAIL' ? '#e0f2fe' : '#ffffff',
                color: authMethod === 'EMAIL' ? '#0369a1' : '#475569', fontSize: '11px', fontWeight: 800, cursor: 'pointer'
              }}
            >
              ✉️ {lang === 'HI' ? 'ईमेल' : 'Email'}
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod('PHONE')}
              style={{
                flex: 1, padding: '7px 0', borderRadius: '8px', border: `1.5px solid ${authMethod === 'PHONE' ? '#059669' : '#cbd5e1'}`,
                backgroundColor: authMethod === 'PHONE' ? '#ecfdf5' : '#ffffff',
                color: authMethod === 'PHONE' ? '#065f46' : '#475569', fontSize: '11px', fontWeight: 800, cursor: 'pointer'
              }}
            >
              📱 {lang === 'HI' ? 'मोबाइल OTP' : 'Mobile OTP'}
            </button>
          </div>
        )}

        {step === 'INPUT' ? (
          <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {authMethod === 'PHONE' ? (
              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  {lang === 'HI' ? 'मोबाइल नंबर (10 अंक)' : 'Mobile Number (10 digits)'}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #0284c7', borderRadius: '10px', overflow: 'hidden' }}>
                  <span style={{ padding: '10px 12px', backgroundColor: '#f8fafc', color: '#334155', fontWeight: 800, fontSize: '13px', borderRight: '1px solid #cbd5e1' }}>
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                    style={{ flex: 1, padding: '10px 12px', border: 'none', fontSize: '14px', fontWeight: 700, outline: 'none' }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  {lang === 'HI' ? 'ईमेल पता' : 'Email Address'}
                </label>
                <input
                  type="email"
                  required
                  placeholder="citizen@bharat.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1.5px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', fontWeight: 700, outline: 'none' }}
                />
              </div>
            )}

            {errorMsg && (
              <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700 }}>
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none',
                borderRadius: '12px', fontSize: '13px', fontWeight: 800, cursor: loading ? 'wait' : 'pointer', marginTop: '4px'
              }}
            >
              {loading
                ? (lang === 'HI' ? 'प्रतीक्षा करें...' : 'Processing...')
                : authMethod === 'PHONE'
                  ? (lang === 'HI' ? 'OTP प्राप्त करें ❯' : 'Get Verification OTP ❯')
                  : (lang === 'HI' ? 'प्रवेश करें ❯' : 'Continue ❯')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>
                  {lang === 'HI' ? '6-अंकों का OTP कोड' : '6-Digit OTP Code'}
                </label>
                <button
                  type="button"
                  onClick={() => setStep('INPUT')}
                  style={{ background: 'none', border: 'none', fontSize: '10.5px', color: '#0284c7', fontWeight: 700, cursor: 'pointer' }}
                >
                  {lang === 'HI' ? 'नंबर बदलें' : 'Change number'}
                </button>
              </div>

              {devOtpHint && (
                <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', color: '#065f46', fontWeight: 800, marginBottom: '6px' }}>
                  ⚡ Auto-filled Dev OTP: {devOtpHint}
                </div>
              )}

              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '12px', textAlign: 'center',
                  letterSpacing: '6px', fontSize: '18px', fontWeight: 900, border: '1.5px solid #0284c7',
                  borderRadius: '10px', outline: 'none'
                }}
              />
            </div>

            {errorMsg && (
              <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700 }}>
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none',
                borderRadius: '12px', fontSize: '13px', fontWeight: 800, cursor: loading ? 'wait' : 'pointer', marginTop: '4px'
              }}
            >
              {loading ? (lang === 'HI' ? 'सत्यापित हो रहा है...' : 'Verifying...') : (lang === 'HI' ? 'सत्यापित करें और मत डालें ❯' : 'Verify & Cast Ballot ❯')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}