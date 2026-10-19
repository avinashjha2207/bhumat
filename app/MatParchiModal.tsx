'use client';
import React, { useRef, useState } from 'react';
import { toBlob } from 'html-to-image';

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
  const parchiRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  if (!isOpen) return null;

  const voteDate = new Date().toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vote.bhumat.com';
  const cleanSeatParam = encodeURIComponent(seatName);
  const safeTitle = pollTitle.length > 80 ? `${pollTitle.slice(0, 77)}...` : pollTitle;
  const safeChoice = selectedOptionText.length > 40 ? `${selectedOptionText.slice(0, 37)}...` : selectedOptionText;

  const shareText = lang === 'HI'
    ? `🇮🇳 मैंने अभी भूमत पर अपनी संसदीय सीट *${seatName}* (${stateName}) से मत दिया!\n\n📋 *मुद्दा:* ${safeTitle}\n🗳️ *मेरा मत:* ${safeChoice}\n\nआप भी अपने लोकसभा क्षेत्र की आवाज़ बनें:\n${origin}?seat=${cleanSeatParam}&ref=${referralCode}`
    : `🇮🇳 I just cast my ballot on BhuMat from *${seatName}* (${stateName})!\n\n📋 *Issue:* ${safeTitle}\n🗳️ *My Stance:* ${safeChoice}\n\nMake your constituency count across Bharat:\n${origin}?seat=${cleanSeatParam}&ref=${referralCode}`;

  const handleWhatsAppShare = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleCaptureStoryCard = async () => {
    if (!parchiRef.current || isCapturing) return;
    try {
      setIsCapturing(true);
      const blob = await toBlob(parchiRef.current, {
        backgroundColor: '#0f172a',
        pixelRatio: 2.5
      });

      if (!blob) throw new Error('Image generation failed');

      const file = new File([blob], `BhuMat_Parchi_${seatName}.png`, { type: 'image/png' });

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Mat Parchi - ${seatName}`,
          text: shareText
        });
      } else {
        const link = document.createElement('a');
        link.download = `BhuMat_MatParchi_${seatName}.png`;
        link.href = URL.createObjectURL(blob);
        link.click();
      }
    } catch (err) {
      console.warn('Capture fallback to text share:', err);
      handleWhatsAppShare();
    } finally {
      setIsCapturing(false);
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
        {/* Story Card Container (Captured by html-to-image) */}
        <div
          ref={parchiRef}
          style={{
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box'
          }}
        >
          {/* Tricolor Header Accent */}
          <div style={{ height: '6px', background: 'linear-gradient(90deg, #ff9933 33.3%, #ffffff 33.3%, #ffffff 66.6%, #138808 66.6%)' }} />

          <div style={{ padding: '20px 20px 16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Header Branding */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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

            {/* Stylized Parchi Ticket */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '16px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  {lang === 'HI' ? 'मुद्दा / प्रश्न' : 'Constitutional Poll Question'}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', lineHeight: 1.35, marginTop: '2px' }}>
                  {pollTitle}
                </div>
              </div>

              {/* Stance Pill */}
              <div style={{ backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: '12px', border: '1.5px solid #10b981' }}>
                <div style={{ fontSize: '9.5px', color: '#059669', fontWeight: 800, textTransform: 'uppercase' }}>
                  {lang === 'HI' ? 'दर्ज मत' : 'Cast Stance'}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                  ✓ {selectedOptionText}
                </div>
              </div>

              {/* Provenance Metadata Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '2px' }}>
                <div>
                  <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    {lang === 'HI' ? 'संसदीय क्षेत्र' : 'Constituency'}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                    📍 {seatName}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>({stateName})</div>
                </div>

                <div>
                  <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    {lang === 'HI' ? 'नागरिक एवं तिथि' : 'Citizen & Date'}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                    @{username}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>{voteDate}</div>
                </div>
              </div>

              {/* Watermark Footer Stamp */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '2px' }}>
                <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700 }}>
                  vote.bhumat.com • #{referralCode}
                </span>
                <span style={{ fontSize: '9px', color: '#059669', fontWeight: 800 }}>
                  🔒 Verified Sovereign Ballot
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Primary: Share Story Card Image */}
          <button
            onClick={handleCaptureStoryCard}
            disabled={isCapturing}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: isCapturing ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
            }}
          >
            <span>📸</span>
            <span>{isCapturing ? (lang === 'HI' ? 'तैयार हो रहा है...' : 'Generating Card...') : (lang === 'HI' ? 'स्टोरी कार्ड शेयर करें (WhatsApp / Insta)' : 'Share Story Card (WhatsApp / Insta)')}</span>
          </button>

          {/* Secondary: Fast Text Link */}
          <button
            onClick={handleWhatsAppShare}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#059669',
              borderRadius: '12px',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>📲</span>
            <span>{lang === 'HI' ? 'व्हाट्सएप संदेश भेजें' : 'Send WhatsApp Message'}</span>
          </button>

          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {lang === 'HI' ? 'बंद करें' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}