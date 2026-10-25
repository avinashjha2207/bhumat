'use client';
import React, { useState } from 'react';

interface CivicCarouselProps {
  lang: 'EN' | 'HI';
  selectedSeat: { name: string; state: string } | null;
  isVerified: boolean;
  guestVoteCount: number;
  onOpenAuth: () => void;
}

export default function CivicCarousel({
  lang,
  selectedSeat,
  isVerified,
  guestVoteCount,
  onOpenAuth
}: CivicCarouselProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return (
      <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
        <button
          onClick={() => setIsDismissed(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#0284c7',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '2px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span>💡</span>
          <span>{lang === 'HI' ? 'नागरिक मार्गदर्शिका देखें' : 'Show Civic Guide'}</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', position: 'relative', marginBottom: '8px' }}>
      {/* Top micro-bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', padding: '0 2px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {lang === 'HI' ? '📢 नागरिक मार्गदर्शिका एवं नियम' : '📢 CIVIC BRIEFING & TIPS'}
        </span>
        <button
          onClick={() => setIsDismissed(true)}
          title="Minimize Guide"
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            padding: '0 4px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Horizontal Snap Scroll Track (Up to 5 Specialized Cards) */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '6px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        <style>{`
          div::-webkit-scrollbar { display: none; }
        `}</style>

        {/* CARD 1: Sovereign Privacy & Zero GPS */}
        <div
          style={{
            flex: '0 0 280px',
            scrollSnapAlign: 'start',
            backgroundColor: '#ffffff',
            border: '1.5px solid #cbd5e1',
            borderRadius: '16px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>🛡️</span>
            <span style={{ fontSize: '11px', fontWeight: 900, color: '#0369a1' }}>
              {lang === 'HI' ? 'शून्य GPS • 100% गोपनीय मत' : 'Zero GPS • Secret Ballot'}
            </span>
          </div>
          <p style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4, margin: '6px 0' }}>
            {lang === 'HI'
              ? `आपकी राय ${selectedSeat?.name || 'आपके क्षेत्र'} से जुड़ती है। भूमत आपके डिवाइस का GPS कभी ट्रैक नहीं करता।`
              : `Your vote is anchored to ${selectedSeat?.name || 'your seat'} with zero GPS tracking. JanMat audits are 100% untraceable.`}
          </p>
          <div style={{ fontSize: '9.5px', color: '#059669', fontWeight: 800 }}>
            ✓ {lang === 'HI' ? 'सत्य, स्वतंत्र व सुरक्षित' : 'Encrypted & Independent'}
          </div>
        </div>

        {/* CARD 2: Daily Rhythm (8 AM LokMat vs 8 PM JanMat) */}
        <div
          style={{
            flex: '0 0 280px',
            scrollSnapAlign: 'start',
            backgroundColor: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '16px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#d97706', backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '1px 6px', borderRadius: '4px' }}>
              🌅 08 AM LokMat
            </span>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: '4px' }}>
              🌆 08 PM JanMat
            </span>
          </div>
          <p style={{ fontSize: '11px', color: '#334155', lineHeight: 1.38, margin: '6px 0' }}>
            {lang === 'HI'
              ? 'सुबह 8 बजे: चाय पर सांस्कृतिक व रोचक बहस। शाम 8 बजे: स्थानीय सड़क, बिजली व अस्पताल ऑडिट।'
              : '8 AM: Cultural & lifestyle debates over chai. 8 PM: Local district & national civic audits.'}
          </p>
          <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700 }}>
            ⚡ {lang === 'HI' ? 'दैनिक 2 संप्रभु ड्रॉप्स' : 'Two Daily Drops Every Day'}
          </div>
        </div>

        {/* CARD 3: 50-Vote Quorum Rule */}
        <div
          style={{
            flex: '0 0 280px',
            scrollSnapAlign: 'start',
            backgroundColor: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '16px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>🏛️</span>
            <span style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>
              {lang === 'HI' ? '50 मतों का कोरम नियम' : '50-Vote Quorum Unlock'}
            </span>
          </div>
          <p style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4, margin: '6px 0' }}>
            {lang === 'HI'
              ? 'जब आपके क्षेत्र में 50 नागरिक मत देते हैं, तब नक्शे पर आपका जिला रंगीन होकर लाइव होता है।'
              : 'Seats glow in slate-grey until 50 residents vote, preventing small-sample statistical bias.'}
          </p>
          <div style={{ fontSize: '9.5px', color: '#0284c7', fontWeight: 800 }}>
            🎯 {lang === 'HI' ? 'अपने क्षेत्र को जागृत करें' : 'Mobilize Your District'}
          </div>
        </div>

        {/* CARD 4: WhatsApp Mat Parchi Virality */}
        <div
          style={{
            flex: '0 0 280px',
            scrollSnapAlign: 'start',
            backgroundColor: '#ffffff',
            border: '1.5px solid #a7f3d0',
            borderRadius: '16px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>📜</span>
            <span style={{ fontSize: '11px', fontWeight: 900, color: '#047857' }}>
              {lang === 'HI' ? 'डिजिटल मत पर्ची शेयर करें' : 'Digital Mat Parchi'}
            </span>
          </div>
          <p style={{ fontSize: '11px', color: '#334155', lineHeight: 1.4, margin: '6px 0' }}>
            {lang === 'HI'
              ? 'मत देने के बाद कार्ड पलटें और अपनी डिजिटल मत पर्ची (नक्शे सहित) व्हाट्सएप स्टेटस पर शेयर करें।'
              : 'Flip any voted card to share your official Mat Parchi with live state maps on WhatsApp.'}
          </p>
          <div style={{ fontSize: '9.5px', color: '#059669', fontWeight: 800 }}>
            📲 {lang === 'HI' ? '1-टैप में व्हाट्सएप स्टेटस' : 'Instant WhatsApp Status Asset'}
          </div>
        </div>

        {/* CARD 5: 7-Day Streaks & Civic Rewards */}
        <div
          style={{
            flex: '0 0 280px',
            scrollSnapAlign: 'start',
            backgroundColor: '#ffffff',
            border: '1.5px solid #fde68a',
            borderRadius: '16px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 6px rgba(245, 158, 11, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>🔥</span>
            <span style={{ fontSize: '11px', fontWeight: 900, color: '#b45309' }}>
              {lang === 'HI' ? '7-दिवसीय स्ट्रीक (+1 DBG)' : '7-Day Streak (+1 DBG)'}
            </span>
          </div>
          <p style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4, margin: '6px 0' }}>
            {lang === 'HI'
              ? 'लगातार 7 दिन मत देकर अपनी स्ट्रीक बनाएं और ऑल-इंडिया लीडरबोर्ड पर अपने जिले को शीर्ष पर लाएं।'
              : 'Vote daily to maintain your streak, earn DBG credits, and climb the All-India Leaderboard.'}
          </p>
          <div style={{ fontSize: '9.5px', color: '#d97706', fontWeight: 800 }}>
            🏆 {lang === 'HI' ? 'नागरिक पद एवं प्रतिष्ठा' : 'Civilian Rank & Recognition'}
          </div>
        </div>

      </div>
    </div>
  );
}