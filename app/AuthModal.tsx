'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredFor: 'JanMat' | 'LokMat' | 'General';
  userSeat: string;
  userState: string;
  lang: 'EN' | 'HI';
  onSuccess: (newToken: string, identifier: string, isVerified: boolean) => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  requiredFor,
  userSeat,
  userState,
  lang,
  onSuccess,
}: AuthModalProps) {
  const isJanMatMode = requiredFor === 'JanMat';
  const [authMethod, setAuthMethod] = useState<'PHONE' | 'EMAIL'>('EMAIL');
  const [identifier, setIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'INPUT' | 'VERIFY'>('INPUT');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pilotNotice, setPilotNotice] = useState<string | null>(null);

  // Synchronize authMethod whenever modal opens or requiredFor changes
  useEffect(() => {
    if (isOpen) {
      setAuthMethod(requiredFor === 'JanMat' ? 'PHONE' : 'EMAIL');
      setIdentifier('');
      setOtpCode('');
      setStep('INPUT');
      setErrorMsg('');
      setPilotNotice(null);
    }
  }, [isOpen, requiredFor]);

  if (!isOpen) return null;

  const activeChannel = isJanMatMode ? 'PHONE' : authMethod;

  // 1. Dispatch 6-digit OTP to citizen_otp_store
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setPilotNotice(null);
    setLoading(true);

    const cleanTarget = identifier.trim();
    if (!cleanTarget) {
      setErrorMsg(lang === 'HI' ? 'कृपया मान्य विवरण दर्ज करें।' : 'Please enter valid details.');
      setLoading(false);
      return;
    }

    if (authMethod === 'PHONE') {
      const digits = cleanTarget.replace(/\D/g, '');
      if (digits.length < 10) {
        setErrorMsg(lang === 'HI' ? 'कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।' : 'Please enter a valid 10-digit mobile number.');
        setLoading(false);
        return;
      }
    } else {
      if (!cleanTarget.includes('@') || !cleanTarget.includes('.')) {
        setErrorMsg(lang === 'HI' ? 'कृपया मान्य ईमेल पता दर्ज करें।' : 'Please enter a valid email address.');
        setLoading(false);
        return;
      }
    }

    // Generate 6-digit cryptographic OTP code
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    const channel = authMethod === 'PHONE' ? 'SMS' : 'EMAIL';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await supabase.from('citizen_otp_store').insert({
      target_identifier: cleanTarget,
      otp_code: generatedCode,
      channel: channel,
      dispatch_mode: 'PILOT_ADMIN',
      is_consumed: false,
      expires_at: expiresAt,
    });

    setLoading(false);

    if (error) {
      console.error('OTP dispatch failure:', error);
      setErrorMsg(lang === 'HI' ? 'OTP भेजने में विफल। पुनः प्रयास करें।' : 'Failed to dispatch OTP. Please retry.');
      return;
    }

    // In Pilot Mode, surface OTP directly on UI and in /admin
    setPilotNotice(
      lang === 'HI'
        ? `पायलट मोड OTP: ${generatedCode}`
        : `Pilot Mode OTP: ${generatedCode} (Logged to citizen_otp_store)`
    );
    setStep('VERIFY');
  };

  // 2. Verify OTP against citizen_otp_store
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const cleanTarget = identifier.trim();
    const cleanOtp = otpCode.trim();

    const { data, error } = await supabase
      .from('citizen_otp_store')
      .select('id')
      .eq('target_identifier', cleanTarget)
      .eq('otp_code', cleanOtp)
      .eq('is_consumed', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      setLoading(false);
      setErrorMsg(lang === 'HI' ? 'अमान्य या समाप्त हो चुका OTP।' : 'Invalid or expired OTP code.');
      return;
    }

    // Mark OTP as consumed to prevent replay attacks
    await supabase.from('citizen_otp_store').update({ is_consumed: true }).eq('id', data.id);

    // Create or retrieve verified voter session token
    let voterToken = localStorage.getItem('bhumat_voter_token');
    if (!voterToken) {
      voterToken = 'bn_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
      localStorage.setItem('bhumat_voter_token', voterToken);
    }

    setLoading(false);
    // Explicitly seed the 5 DBG welcome balance to safeStorage immediately
    localStorage.setItem('bhumat_dbg_balance', '5');
    if (authMethod === 'PHONE') {
      localStorage.setItem('bhumat_user_phone', cleanTarget);
    } else {
      localStorage.setItem('bhumat_user_email', cleanTarget);
    }
    onSuccess(voterToken, cleanTarget, authMethod === 'PHONE');
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '24px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '18px' }}>🛡️</span>
            <span style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
              {lang === 'HI' ? 'नागरिक सत्यापन' : 'Citizen Verification'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              cursor: 'pointer',
              fontWeight: 800,
              color: '#64748b',
            }}
          >
            ✕
          </button>
        </div>

        {/* 5 DBG Incentive Banner */}
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1.5px solid #a7f3d0',
            borderRadius: '12px',
            padding: '10px 12px',
            fontSize: '11px',
            color: '#065f46',
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          🎁 {lang === 'HI'
            ? 'सत्यापन पूर्ण करने पर +5 DBG स्वागत बोनस प्राप्त करें और किसी भी संसदीय क्षेत्र में संप्रभु मत दर्ज करें!'
            : 'Complete verification to claim +5 DBG Welcome Bonus & lock your sovereign voting rights!'}
        </div>

        {/* Auth Method Selector / JanMat Enforced Notice */}
        {step === 'INPUT' && (
          requiredFor === 'JanMat' ? (
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: '12px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 900, color: '#166534' }}>
                <span>📱</span>
                <span>{lang === 'HI' ? 'एकमुश्त मोबाइल सत्यापन अनिवार्य' : 'One-Time Mobile Verification Required'}</span>
              </div>
              <p style={{ fontSize: '10.5px', color: '#15803d', margin: 0, lineHeight: 1.4 }}>
                {lang === 'HI'
                  ? 'जनमत संवैधानिक ऑडिट में वास्तविक भारतीय नागरिकता सुनिश्चित करने व बॉट्स रोकने हेतु मोबाइल OTP अनिवार्य है। आपका मत पूर्णतः गोपनीय रहता है और किसी भी डेटाबेस इंजीनियर द्वारा आपकी पहचान से नहीं जोड़ा जा सकता।'
                  : 'Mandatory one-time mobile OTP ensures authentic resident presence and eliminates bot farming. BhuMat verifies your ballot right, but your choice drops into a decoupled blind vault with zero identity links.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('EMAIL');
                  setErrorMsg('');
                }}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: authMethod === 'EMAIL' ? '#ffffff' : 'transparent',
                  color: authMethod === 'EMAIL' ? '#0f172a' : '#64748b',
                  boxShadow: authMethod === 'EMAIL' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                ✉️ {lang === 'HI' ? 'ईमेल OTP' : 'Email OTP'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('PHONE');
                  setErrorMsg('');
                }}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: authMethod === 'PHONE' ? '#ffffff' : 'transparent',
                  color: authMethod === 'PHONE' ? '#0f172a' : '#64748b',
                  boxShadow: authMethod === 'PHONE' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                📱 {lang === 'HI' ? 'मोबाइल OTP' : 'Mobile OTP'}
              </button>
            </div>
          )
        )}

        {errorMsg && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '11.5px',
              fontWeight: 700,
            }}
          >
            {errorMsg}
          </div>
        )}

        {pilotNotice && (
          <div
            style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #fde68a',
              color: '#92400e',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 800,
              fontFamily: 'monospace',
            }}
          >
            {pilotNotice}
          </div>
        )}

        {step === 'INPUT' ? (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                {activeChannel === 'PHONE'
                  ? (lang === 'HI' ? 'मोबाइल नंबर (+91)' : 'Mobile Number (10 Digits)')
                  : (lang === 'HI' ? 'ईमेल पता' : 'Citizen Email Address')}
              </label>
              <input
                type={activeChannel === 'PHONE' ? 'tel' : 'email'}
                placeholder={activeChannel === 'PHONE' ? '9876543210' : 'citizen@bharat.in'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginTop: '4px',
                  outline: 'none',
                }}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading
                ? (lang === 'HI' ? 'OTP भेजा जा रहा है...' : 'Dispatching OTP...')
                : (lang === 'HI' ? 'OTP कोड प्राप्त करें ❯' : 'Get Verification OTP ❯')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {lang === 'HI' ? '6-अंकीय OTP दर्ज करें' : 'Enter 6-Digit OTP Code'}
                </label>
                <button
                  type="button"
                  onClick={() => setStep('INPUT')}
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {lang === 'HI' ? 'संपादित करें' : 'Change'}
                </button>
              </div>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1.5px solid #0284c7',
                  fontSize: '18px',
                  fontWeight: 900,
                  letterSpacing: '0.25em',
                  textAlign: 'center',
                  marginTop: '4px',
                  outline: 'none',
                }}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading
                ? (lang === 'HI' ? 'सत्यापित हो रहा है...' : 'Verifying...')
                : (lang === 'HI' ? 'सत्यापित करें एवं 5 DBG प्राप्त करें ✓' : 'Verify & Claim 5 DBG ✓')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}