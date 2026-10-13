'use client';
import React, { useState } from 'react';
import { supabase, safeStorage } from './utils/supabaseClient';

interface PhoneAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  guestToken: string;
  userState?: string;
  userSeat?: string;
  onAuthSuccess: (newToken: string) => void;
}

export default function PhoneAuthModal({
  isOpen,
  onClose,
  guestToken,
  userState = 'Bihar',
  userSeat = 'Karakat',
  onAuthSuccess
}: PhoneAuthModalProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('request_phone_otp', {
        p_phone: phone
      });
      if (error || !data?.success) {
        setErrorMsg(data?.error || error?.message || 'Failed to request OTP');
      } else {
        setStep('OTP');
        if (data?.dev_otp) {
          setDevOtpHint(data.dev_otp);
          setOtp(data.dev_otp); // Auto-fill for friction-free dev testing
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('verify_phone_otp', {
        p_phone: phone,
        p_otp: otp.trim(),
        p_guest_token: guestToken,
        p_state: userState,
        p_seat: userSeat
      });
      if (error || !data?.success) {
        setErrorMsg(data?.error || error?.message || 'Invalid OTP code');
      } else {
        const verifiedToken = data.voter_token;
        safeStorage.setItem('bhumat_voter_token', verifiedToken);
        safeStorage.setItem('bhumat_user_phone', phone.slice(-10));

        // Unlock pending referral milestone bonuses now that the phone number is verified
        try {
          await supabase.rpc('check_and_reward_referral', {
            p_voter_token: verifiedToken,
            p_category: 'JanMat'
          });
          await supabase.rpc('check_and_reward_referral', {
            p_voter_token: verifiedToken,
            p_category: 'LokMat'
          });
        } catch (refErr) {
          console.warn('Pending referral milestone disbursement skipped:', refErr);
        }

        onAuthSuccess(verifiedToken);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(5px)',
        zIndex: 250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '26px 22px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 800, padding: '3px 9px', borderRadius: '6px' }}>
            SOVEREIGN PASSPORT
          </span>
          <button
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 800, color: '#64748b' }}
          >
            ✕
          </button>
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 900, margin: '8px 0 4px 0', color: '#0f172a' }}>
          {step === 'PHONE' ? 'Signup' : 'Enter Sovereign OTP'}
        </h3>
        <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.45 }}>
          {step === 'PHONE'
            ? 'Bind your civic XP, seasonal streaks, and DBG wallet to your mobile. Keeps your ballots completely secret while preserving your profile across devices.'
            : `Enter the 6-digit code sent to +91 ${phone.slice(-10)}`}
        </p>
        {step === 'PHONE' ? (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ padding: '12px', backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                🇮🇳 +91
              </span>
              <input
                type="tel"
                required
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid #0284c7', fontSize: '13px', fontWeight: 700, outline: 'none' }}
              />
            </div>
            {errorMsg && <div style={{ fontSize: '11.5px', color: '#ef4444', fontWeight: 700 }}>{errorMsg}</div>}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '13px',
                backgroundColor: loading ? '#94a3b8' : '#10b981',
                color: '#ffffff',
                fontWeight: 800,
                borderRadius: '12px',
                border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                fontSize: '13px'
              }}
            >
              {loading ? 'Generating Code...' : 'Get OTP Code ❯'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {devOtpHint && (
              <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', color: '#065f46', fontWeight: 800 }}>
                ⚡ Test Mode: OTP is <strong>{devOtpHint}</strong>
              </div>
            )}
            <input
              type="text"
              required
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={{ padding: '12px', borderRadius: '10px', border: '1.5px solid #0284c7', fontSize: '18px', fontWeight: 800, textAlign: 'center', letterSpacing: '0.2em', outline: 'none' }}
            />
            {errorMsg && <div style={{ fontSize: '11.5px', color: '#ef4444', fontWeight: 700 }}>{errorMsg}</div>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setStep('PHONE')}
                style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 800, borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '12px' }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{ flex: 2, padding: '12px', backgroundColor: loading ? '#94a3b8' : '#0284c7', color: '#ffffff', fontWeight: 800, borderRadius: '10px', border: 'none', cursor: loading ? 'wait' : 'pointer', fontSize: '12px' }}
              >
                {loading ? 'Verifying...' : 'Verify & Bind Passport'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}