'use client';
import React, { useState, useEffect } from 'react';

export type CivicNavTarget = 'schedule' | 'rankings' | 'search';

interface CivicCarouselProps {
  lang: 'EN' | 'HI';
  onNavigateTab?: (target: CivicNavTarget) => void;
}

export default function CivicCarousel({ lang, onNavigateTab }: CivicCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 'cadence_schedule',
      icon: '📅',
      tag: lang === 'HI' ? 'मासिक चक्र नियम' : 'Monthly Cycle Rule',
      tagColor: '#d97706',
      tagBg: '#fffbeb',
      tagBorder: '#fde68a',
      title: lang === 'HI' 
        ? 'मासिक प्रश्न कब खुलते और बंद होते हैं?' 
        : 'How do Monthly Poll Windows Work?',
      body: lang === 'HI'
        ? 'हर मासिक प्रश्न जारी होने की तारीख से माह के अंतिम दिन तक खुला रहता है। माह के अंत में उस चक्र का परिणाम सील हो जाता है और अगले माह उसी तारीख को पुनः मतदान अनलॉक होता है।'
        : 'Each monthly audit is open from its drop date through month-end. At month-end, consensus is sealed, and re-voting unlocks on the same date next month.',
      actionLabel: lang === 'HI' ? 'कैलेंडर देखें ❯' : 'View Calendar ❯',
      actionTab: 'schedule' as const
    },
    {
      id: 'secret_ballot',
      icon: '🔒',
      tag: lang === 'HI' ? 'पूर्ण गोपनीयता' : '100% Secret Ballot',
      tagColor: '#059669',
      tagBg: '#ecfdf5',
      tagBorder: '#a7f3d0',
      title: lang === 'HI' 
        ? 'शून्य जीपीएस • 100% अनाम जनमत ऑडिट' 
        : 'Zero GPS • Completely Decoupled Audits',
      body: lang === 'HI'
        ? 'जनमत नागरिक ऑडिट में आपका फोन या पहचान कभी भी आपके वोट से नहीं जुड़ती। सिस्टम केवल यह सत्यापित करता है कि आपने मत दिया, किंतु आपका विकल्प पूरी तरह गोपनीय रहता है।'
        : 'JanMat decouples your identity from your ballot. The ledger verifies that you voted to block duplicates, but zero individuals - even admins - can trace your choice.',
      actionLabel: lang === 'HI' ? 'सुरक्षा प्रोटोकॉल ❯' : 'Security Protocol ❯',
      actionTab: 'search' as const
    },
    {
      id: 'quorum_fortification',
      icon: '🛡️',
      tag: lang === 'HI' ? 'सॉवरेन कोरम' : '50-Vote Quorum',
      tagColor: '#0284c7',
      tagBg: '#f0f9ff',
      tagBorder: '#bae6fd',
      title: lang === 'HI' 
        ? 'नक्शे पर रंग कब दिखाई देता है?' 
        : 'Why do Unfortified Seats Stay Slate?',
      body: lang === 'HI'
        ? 'किसी संसदीय क्षेत्र में जब तक 50 सत्यापित नागरिक मतदान नहीं करते, तब तक वहां का नक्शा तटस्थ रहता है। यह नियम अल्प-संख्यात्मक पूर्वाग्रह को रोकता है।'
        : 'Constituency polygons remain neutral slate until ≥50 verified citizen ballots land. This statistical threshold prevents small-sample skew from distorting regional opinion.',
      actionLabel: null,
      actionTab: null
    },
    {
      id: 'dual_rhythm',
      icon: '🌅',
      tag: lang === 'HI' ? 'दैनिक लय' : 'Daily Dual Drops',
      tagColor: '#b45309',
      tagBg: '#fef3c7',
      tagBorder: '#fde68a',
      title: lang === 'HI' 
        ? 'सुबह 8 बजे लोकमत • रात 8 बजे जनमत' 
        : '8:00 AM LokMat • 8:00 PM JanMat',
      body: lang === 'HI'
        ? 'सुबह की चाय पर भारत की सांस्कृतिक राय (खेल, सिनेमा, जीवनशैली) और रात 8 बजे अपने जिले की सड़कों, बिजली, स्वास्थ्य और नागरिक व्यवस्था का निष्पक्ष ऑडिट।'
        : 'Morning chai brings open cultural debates (cinema, sports, heritage), while 8:00 PM transitions to verified civic and governance audits for your constituency.',
      actionLabel: lang === 'HI' ? 'आगामी प्रश्न ❯' : 'Upcoming Drops ❯',
      actionTab: 'schedule' as const
    },
    {
      id: 'civic_league',
      icon: '🏆',
      tag: lang === 'HI' ? 'भारत नागरिक लीग' : 'Bharat Civic League',
      tagColor: '#7c3aed',
      tagBg: '#f5f3ff',
      tagBorder: '#ddd6fe',
      title: lang === 'HI' 
        ? 'अपनी सीट को राष्ट्रीय चैंपियन बनाएं' 
        : 'Earn DBG & Elevate Your Home Seat',
      body: lang === 'HI'
        ? 'प्रत्येक मतदान पर DBG अंक और XP प्राप्त करें। आपके क्षेत्र से जितना अधिक मतदान होगा, आपका संसदीय क्षेत्र राष्ट्रीय लीडरबोर्ड में उतना ही ऊपर पहुंचेगा।'
        : 'Earn DBG credits and civic XP with every ballot. High local turnout propels your Parliamentary Constituency to the top of the monthly All-India leaderboard.',
      actionLabel: lang === 'HI' ? 'रैंकिंग देखें ❯' : 'View League ❯',
      actionTab: 'rankings' as const
    }
  ];

  // Auto-scroll every 7 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[currentSlide];

  return (
    <div style={{
      width: '100%',
      maxWidth: '460px',
      margin: '0 auto 14px auto',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '20px',
        padding: '14px 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '128px',
        position: 'relative',
        transition: 'all 0.25s ease'
      }}>
        {/* Top Header Row: Icon + Badge + Navigation Dots */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{slide.icon}</span>
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              color: slide.tagColor,
              backgroundColor: slide.tagBg,
              border: `1px solid ${slide.tagBorder}`,
              padding: '2px 8px',
              borderRadius: '6px',
              letterSpacing: '0.02em',
              textTransform: 'uppercase'
            }}>
              {slide.tag}
            </span>
          </div>

          {/* Dots Indicator */}
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                style={{
                  width: idx === currentSlide ? '16px' : '6px',
                  height: '6px',
                  borderRadius: '999px',
                  backgroundColor: idx === currentSlide ? '#0f172a' : '#cbd5e1',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease'
                }}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div style={{ marginTop: '8px', marginBottom: '8px' }}>
          <h4 style={{
            fontSize: '13.5px',
            fontWeight: 850,
            color: '#0f172a',
            margin: '0 0 4px 0',
            lineHeight: 1.3
          }}>
            {slide.title}
          </h4>
          <p style={{
            fontSize: '11.5px',
            color: '#475569',
            margin: 0,
            lineHeight: 1.45
          }}>
            {slide.body}
          </p>
        </div>

        {/* Footer Row: Progress bar + Contextual Action Link */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px dashed #f1f5f9',
          paddingTop: '6px',
          fontSize: '10.5px'
        }}>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>
            {currentSlide + 1} / {slides.length} • BhuMat Protocol
          </span>
          {slide.actionLabel && onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab(slide.actionTab!)}
              style={{
                background: 'none',
                border: 'none',
                color: '#0284c7',
                fontWeight: 800,
                fontSize: '11px',
                cursor: 'pointer',
                padding: '2px 4px'
              }}
            >
              {slide.actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}