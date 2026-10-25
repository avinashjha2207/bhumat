'use client';

import React, { useRef, useState } from 'react';
import DrishtiMap from './DrishtiMap';

interface MatParchiModalProps {
  isOpen: boolean;
  onClose: () => void;
  pollId?: string;
  pollTitle: string;
  pollCategory?: string;
  options?: any[];
  selectedOptionText?: string;
  seatName: string;
  stateName: string;
  username?: string;
  isProfilePrivate?: boolean;
  lang: 'EN' | 'HI';
  referralCode?: string;
}

export default function MatParchiModal({
  isOpen,
  onClose,
  pollId = '',
  pollTitle,
  pollCategory = 'LokMat',
  options = [],
  selectedOptionText,
  seatName,
  stateName,
  username,
  isProfilePrivate = false,
  lang,
  referralCode = 'BM78491'
}: MatParchiModalProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  // Real-time formatted date & timestamp
  const now = new Date();
  const dateStr = now.toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString(lang === 'HI' ? 'hi-IN' : 'en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const isJanMat = pollCategory === 'JanMat';
  // Strict rule: Never expose personal stance on JanMat OR when user profile is private
  const canShowStance = !isJanMat && !isProfilePrivate && Boolean(selectedOptionText);

  // 1. WhatsApp Text Share Handler
  const handleWhatsAppTextShare = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vote.bhumat.com';
    const cleanSeatParam = encodeURIComponent(seatName);
    const cleanPollParam = pollId ? `&poll=${encodeURIComponent(pollId)}` : '';

    let stanceSnippet = '';
    if (canShowStance && selectedOptionText) {
      stanceSnippet = lang === 'HI'
        ? `\n🗳️ *मेरा रुख:* ${selectedOptionText}`
        : `\n🗳️ *My Stance:* ${selectedOptionText}`;
    } else if (isJanMat) {
      stanceSnippet = lang === 'HI'
        ? `\n🔒 *ऑडिट प्रकार:* 100% गोपनीय मतपेटी (Zero Tracking)`
        : `\n🔒 *Audit Nature:* 100% Anonymous Ballot (Zero Tracking)`;
    }

    const shareText = lang === 'HI'
      ? `🇮🇳 *भूमत जनमत मुकाबला • ${seatName} (${stateName})*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *मुद्दा:* ${pollTitle}\n` +
        `${stanceSnippet}\n\n` +
        `⚔️ *क्षेत्रीय चुनौती:* क्या ${seatName} राज्य औसत से सहमत है या अलग सोचता है?\n\n` +
        `👉 *1-टैप में मत दें और अपने क्षेत्र का नक्शा देखें:*\n` +
        `${origin}?seat=${cleanSeatParam}${cleanPollParam}&ref=${referralCode}`
      : `🇮🇳 *BhuMat Public Opinion Alert • ${seatName} (${stateName})*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *Issue:* ${pollTitle}\n` +
        `${stanceSnippet}\n\n` +
        `⚔️ *Regional Challenge:* Does ${seatName} agree with the state average or stand apart?\n\n` +
        `👉 *Cast your 1-tap vote and unlock ${seatName} constituency map:*\n` +
        `${origin}?seat=${cleanSeatParam}${cleanPollParam}&ref=${referralCode}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  // 2. High-Resolution Visual PNG Share/Download Handler
  const handleExportStoryImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);

    try {
      const { toBlob, toPng } = await import('html-to-image');
      
      // Generate crisp 2x retina blob
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });

      if (!blob) throw new Error('Blob generation failed');
      const file = new File([blob], `BhuMat_${seatName}_MatParchi.png`, { type: 'image/png' });

      // Native Web Share API if supported on mobile devices
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `BhuMat Parchi • ${seatName}`,
          text: `Verified Citizen Ballot from ${seatName} (${stateName}) on BhuMat: https://vote.bhumat.com`
        });
      } else {
        // Fallback: Direct PNG Download on desktop browsers
        const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `BhuMat_${seatName}_MatParchi.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.warn('Image share fallback:', err);
      // If canvas capture fails on low-end device, route cleanly to WhatsApp text
      handleWhatsAppTextShare();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
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
          maxWidth: '410px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto'
        }}
      >
        {/* Tricolor Ribbon */}
        <div style={{ height: '6px', background: 'linear-gradient(90deg, #ff9933 33.3%, #ffffff 33.3%, #ffffff 66.6%, #138808 66.6%)' }} />

        {/* Modal Top Bar */}
        <div style={{ padding: '16px 18px 0 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '15px' }}>🇮🇳</span>
            <span style={{ fontSize: '11px', fontWeight: 900, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {lang === 'HI' ? 'अखिल भारतीय जनमत पर्ची' : 'Bharat Public Opinion'}
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
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* ============================================================== */}
        {/* CAPTURE TARGET CONTAINER (Captured cleanly as 1:1 image)        */}
        {/* ============================================================== */}
        <div
          ref={cardRef}
          style={{
            backgroundColor: '#ffffff',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {/* Issue Header */}
          <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 900,
                color: isJanMat ? '#0369a1' : '#b45309',
                backgroundColor: isJanMat ? '#e0f2fe' : '#fef3c7',
                padding: '2px 7px',
                borderRadius: '6px',
                textTransform: 'uppercase'
              }}>
                {isJanMat ? 'JanMat • District Audit' : 'LokMat • Public Culture'}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>
                📍 {seatName} ({stateName})
              </span>
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', lineHeight: 1.4 }}>
              {pollTitle}
            </div>
          </div>

          {/* Embedded State Drishti Silhouette Vector */}
          <div style={{
            position: 'relative',
            borderRadius: '16px',
            border: '1.5px solid #cbd5e1',
            backgroundColor: '#f8fafc',
            overflow: 'hidden',
            padding: '8px'
          }}>
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 10,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              color: '#ffffff',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.02em'
            }}>
              🗺️ {stateName.toUpperCase()} CONSENSUS MAP
            </div>

            {/* Embedded Live State SVG with Beacon */}
            <DrishtiMap
              selectedConstituencyName={seatName}
              selectedState={stateName}
              pollId={pollId}
              options={options}
            />

            {/* Option Color Legend Strip */}
            {options && options.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px 10px',
                marginTop: '6px',
                paddingTop: '6px',
                borderTop: '1px dashed #cbd5e1',
                justifyContent: 'center'
              }}>
                {options.map((opt, idx) => {
                  const palette = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];
                  const color = palette[idx % palette.length];
                  const label = lang === 'HI' ? (opt.text_hi || opt.text_en) : opt.text_en;
                  return (
                    <div key={opt.id ?? idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 800, color: '#334155' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stance or Cryptographic Shield Row */}
          {canShowStance ? (
            <div style={{ backgroundColor: '#ecfdf5', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #a7f3d0' }}>
              <div style={{ fontSize: '10px', color: '#065f46', fontWeight: 800, textTransform: 'uppercase' }}>
                {lang === 'HI' ? 'दर्ज मत (My Stance)' : 'My Cast Stance'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#065f46', marginTop: '2px' }}>
                ✓ {selectedOptionText}
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#f0f9ff', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #bae6fd' }}>
              <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: 800, textTransform: 'uppercase' }}>
                {isJanMat ? (lang === 'HI' ? '🔒 100% गोपनीय मतपेटी' : '🔒 100% Anonymous Ballot') : (lang === 'HI' ? '🔒 निजी मत' : '🔒 Private Citizen Stance')}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0c4a6e', marginTop: '2px' }}>
                {lang === 'HI'
                  ? 'नागरिक गोपनीयता नियम: आपकी व्यक्तिगत पसंद पूरी तरह सीलबंद है।'
                  : 'Zero Identity Tracing: Personal stance permanently sealed in blind vault.'}
              </div>
            </div>
          )}

          {/* Footer Metadata & Exact Timestamp */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '10.5px',
            color: '#64748b',
            borderTop: '1px dashed #cbd5e1',
            paddingTop: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#059669', fontWeight: 800 }}>✅ Verified Elector</span>
              <span>•</span>
              <span>{seatName}</span>
            </div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>
              ⏱️ {dateStr} • {timeStr}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SHARING ACTIONS DOCK                                           */}
        {/* ============================================================== */}
        <div style={{ padding: '0 18px 18px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Official WhatsApp Channel Habit Banner */}
          <a
            href="https://whatsapp.com/channel/0029Vb4QYvX5Ui2R" // Replace with your actual BhuMat WhatsApp Channel link
            target="_blank"
            rel="noopener noreferrer"
            style={{
              textDecoration: 'none',
              backgroundColor: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '12px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '2px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📢</span>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#166534' }}>
                  {lang === 'HI' ? 'भूमत व्हाट्सएप चैनल से जुड़ें' : 'Join BhuMat WhatsApp Channel'}
                </div>
                <div style={{ fontSize: '9.5px', color: '#15803d', fontWeight: 600 }}>
                  {lang === 'HI' ? 'दैनिक 8 AM एवं 8 PM जनमत अलर्ट प्राप्त करें' : 'Get daily 8 AM & 8 PM drop alerts'}
                </div>
              </div>
            </div>
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              color: '#ffffff',
              backgroundColor: '#16a34a',
              padding: '4px 8px',
              borderRadius: '6px'
            }}>
              {lang === 'HI' ? 'जुड़ें ↗' : 'Follow ↗'}
            </span>
          </a>
          {/* Action 1: High-Conversion Status Image Share */}
          <button
            type="button"
            onClick={handleExportStoryImage}
            disabled={isExporting}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: isExporting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.28)',
              opacity: isExporting ? 0.7 : 1
            }}
          >
            <span>📸</span>
            <span>{isExporting ? (lang === 'HI' ? 'पर्ची तैयार हो रही है...' : 'Generating Image...') : (lang === 'HI' ? 'व्हाट्सएप स्टेटस इमेज शेयर करें' : 'Share Image to WhatsApp Status')}</span>
          </button>

          {/* Action 2: Text Forward Fallback */}
          <button
            type="button"
            onClick={handleWhatsAppTextShare}
            style={{
              width: '100%',
              padding: '9px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '11.5px',
              fontWeight: 750,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px'
            }}
          >
            <span>💬</span>
            <span>{lang === 'HI' ? 'सीधा व्हाट्सएप मैसेज भेजें' : 'Send Direct WhatsApp Link'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}