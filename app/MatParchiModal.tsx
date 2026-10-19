'use client';
import React from 'react';

interface MatParchiModalProps {
  isOpen: boolean;
  onClose: () => void;
  pollTitle: string;
  selectedOptionText: string;
  seatName: string;
  stateName: string;
  username: string;
  lang: 'EN' | 'HI';
  referralCode?: string;
}

export default function MatParchiModal({
  isOpen,
  onClose,
  pollTitle,
  selectedOptionText,
  seatName,
  stateName,
  username,
  lang,
  referralCode = 'BM78491'
}: MatParchiModalProps) {
  if (!isOpen) return null;

  const voteDate = new Date().toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const handleWhatsAppShare = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vote.bhumat.com';
    const cleanSeatParam = encodeURIComponent(seatName);

    // Truncate long issue titles to avoid URL intent truncation on mobile devices
    const safeTitle = pollTitle.length > 80 ? `${pollTitle.slice(0, 77)}...` : pollTitle;
    const safeChoice = selectedOptionText.length > 40 ? `${selectedOptionText.slice(0, 37)}...` : selectedOptionText;

    const text = lang === 'HI'
      ? `🇮🇳 मैंने अभी भूमत पर अपनी संसदीय सीट *${seatName}* (${stateName}) से मत दिया!\n\n📋 *मुद्दा:* ${safeTitle}\n🗳️ *मेरा मत:* ${safeChoice}\n\nआप भी अपने लोकसभा क्षेत्र की आवाज़ बनें:\n${origin}?seat=${cleanSeatParam}&ref=${referralCode}`
      : `🇮🇳 I just cast my ballot on BhuMat from *${seatName}* (${stateName})!\n\n📋 *Issue:* ${safeTitle}\n🗳️ *My Stance:* ${safeChoice}\n\nMake your constituency count across Bharat:\n${origin}?seat=${cleanSeatParam}&ref=${referralCode}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
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
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '380px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Tricolor Header Accent */}
        <div style={{ height: '6px', background: 'linear-gradient(90deg, #ff9933 33.3%, #ffffff 33.3%, #ffffff 66.6%, #138808 66.6%)' }} />

        <div style={{ padding: '22px 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Card Top Branding */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {lang === 'HI' ? 'भारत का संप्रभु जनमत ग्रिड' : 'Sovereign Public Opinion Grid'}
              </div>
              <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                {lang === 'HI' ? 'डिजिटल मत पर्ची' : 'Digital Mat Parchi'}
              </h3>
            </div>
            <button
              onClick={onClose}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 800, color: '#64748b' }}
            >
              ✕
            </button>
          </div>

          {/* Physical Parchi Container */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1.5px dashed #cbd5e1',
              borderRadius: '16px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                {lang === 'HI' ? 'मुद्दा / प्रश्न' : 'Issue / Question'}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', lineHeight: 1.35, marginTop: '2px' }}>
                {pollTitle}
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '10px', color: '#059669', fontWeight: 800, textTransform: 'uppercase' }}>
                {lang === 'HI' ? 'दर्ज मत' : 'Cast Choice'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                ✓ {selectedOptionText}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '4px' }}>
              <div>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700 }}>
                  {lang === 'HI' ? 'संसदीय क्षेत्र' : 'Constituency'}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                  📍 {seatName}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>({stateName})</div>
              </div>
              <div>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700 }}>
                  {lang === 'HI' ? 'नागरिक एवं तिथि' : 'Citizen & Date'}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                  @{username}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>{voteDate}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={handleWhatsAppShare}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)'
              }}
            >
              <span>📲</span>
              <span>{lang === 'HI' ? 'व्हाट्सएप पर शेयर करें' : 'Share to WhatsApp'}</span>
            </button>
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '9px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {lang === 'HI' ? 'बंद करें' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}