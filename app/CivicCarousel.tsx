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
      id: 'bharat_voice',
      icon: '🇮🇳',
      accentColor: '#f97316',
      tag: lang === 'HI' ? 'भारत का जनमत' : 'Bharat Scoreboard',
      tagColor: '#ea580c',
      tagBg: '#fff7ed',
      tagBorder: '#ffedd5',
      title: lang === 'HI' 
        ? '543 संसदीय क्षेत्र • ज़मीनी जनमत का सीधा आईना' 
        : '543 Constituencies. Direct Citizen Voice.',
      body: lang === 'HI'
        ? 'भूमत देश के हर संसदीय क्षेत्र की वास्तविक आवाज़ को सीधे राष्ट्रीय मानचित्र पर लाता है। यहां हर जिले की राय वहां के स्थानीय नागरिक खुद तय करते हैं।'
        : 'BhuMat brings public sentiment directly from the ground to the map. Every Lok Sabha constituency speaks through its own local residents, building a living, transparent national scoreboard.',
      actionLabel: null,
      actionTab: null
    },
    {
      id: 'secret_ballot',
      icon: '🔒',
      accentColor: '#0284c7',
      tag: lang === 'HI' ? 'अभेद्य गोपनीयता' : 'Unlinked Ballot',
      tagColor: '#0284c7',
      tagBg: '#f0f9ff',
      tagBorder: '#bae6fd',
      title: lang === 'HI' 
        ? 'आपकी पहचान और आपके मत में कोई संबंध नहीं' 
        : 'Your Identity & Your Vote Are Never Linked',
      body: lang === 'HI'
        ? 'जैसे मतदान केंद्र पर उंगली की स्याही सिर्फ यह दर्ज करती है कि आपने वोट दिया, वैसे ही भूमत पर आपकी पहचान और आपकी पसंद दो अलग-अलग बंद कमरों में रहती है। आपने किसे चुना, यह कोई नहीं जान सकता, भूमत भी नहीं।'
        : 'Like indelible ink on your finger, mobile verification only proves you showed up (blocking fake bots). The option you select drops into an encrypted vault with zero phone numbers, zero tokens, and zero timestamps. No one, not even BhuMat engineers can see your vote.',
      actionLabel: lang === 'HI' ? 'सुरक्षा नियम ❯' : 'Security Shield ❯',
      actionTab: 'search' as const
    },
    {
      id: 'proof_of_ballot',
      icon: '🗳️',
      accentColor: '#059669',
      tag: lang === 'HI' ? 'निष्पक्ष सहभागिता' : 'Proof of Ballot',
      tagColor: '#059669',
      tagBg: '#ecfdf5',
      tagBorder: '#a7f3d0',
      title: lang === 'HI' 
        ? 'पहले अपना मत दर्ज करें, फिर देखें जनता का रुख' 
        : 'Vote First, Then Reveal the Collective Mood',
      body: lang === 'HI'
        ? 'ताकि पहले से दिख रहे रुझान आपके व्यक्तिगत फैसले को प्रभावित न करें। जैसे ही आप अपना मत दर्ज करते हैं, आपके जिले और पूरे देश के आंकड़े तुरंत खुल जाते हैं।'
        : 'To keep public opinion completely honest and free from peer pressure, live constituency percentages and Drishti heatmaps unlock only after you vote. Your sincere voice comes first.',
      actionLabel: null,
      actionTab: null
    },
    {
      id: 'quorum_evolution',
      icon: '🛡️',
      accentColor: '#d97706',
      tag: lang === 'HI' ? 'सशक्त कोरम' : '50-Vote Quorum',
      tagColor: '#b45309',
      tagBg: '#fef3c7',
      tagBorder: '#fde68a',
      title: lang === 'HI' 
        ? 'पहले वोट से शुरुआती रुझान • 50 मतों पर पक्का कोरम' 
        : 'From Early Trends to Certified District Consensus',
      body: lang === 'HI'
        ? 'पहले ही वोट से आपके जिले का रंग हल्के शेड में दिखने लगता है। जैसे ही क्षेत्र के 50 नागरिक मतदान पूरा करते हैं, आपके जिले का जनमत आधिकारिक रूप से सुदृढ़ होकर गहरे रंग में चमक उठता है।'
        : 'Your constituency boundary reflects live sentiment from the very first vote in a subtle tone. Once 50 verified local residents participate, your seat solidifies into a certified, deep consensus color.',
      actionLabel: null,
      actionTab: null
    },
    {
      id: 'dual_rhythm',
      icon: '🌅',
      accentColor: '#ea580c',
      tag: lang === 'HI' ? 'दैनिक संतुलन' : 'Daily Rhythm',
      tagColor: '#c2410c',
      tagBg: '#fff7ed',
      tagBorder: '#ffedd5',
      title: lang === 'HI' 
        ? 'सुबह चाय पर सांस्कृतिक चर्चा • रात 8 बजे शहर का ऑडिट' 
        : 'Morning Chai Debates • Evening District Audits',
      body: lang === 'HI'
        ? 'सुबह 8 बजे लोकमत पर खेल, सिनेमा और जीवनशैली से जुड़ी सांस्कृतिक चर्चाएं। \nरात 8 बजे जनमत पर अपने क्षेत्र की नागरिक व्यवस्था का निष्पक्ष ऑडिट।'
        : '8:00 AM LokMat brings high-spirited cultural debates on sports, cinema, and heritage. \n8:00 PM JanMat transitions to uncompromised civic audits on local governance.',
      actionLabel: lang === 'HI' ? 'दैनिक कार्यक्रम ❯' : 'Daily Schedule ❯',
      actionTab: 'schedule' as const
    },
    {
      id: 'monthly_cycle',
      icon: '📅',
      accentColor: '#059669',
      tag: lang === 'HI' ? 'मासिक चक्र' : 'Monthly Cycle',
      tagColor: '#047857',
      tagBg: '#ecfdf5',
      tagBorder: '#a7f3d0',
      title: lang === 'HI' 
        ? 'साल के 12 नियमित मासिक चक्र' 
        : '12 Monthly Seasons per Year',
      body: lang === 'HI'
        ? 'हर मासिक प्रश्न जारी होने की तारीख से महीने के आखिरी दिन तक खुला रहता है। माह के अंत में उस चक्र के नतीजे सील होते हैं और अगले महीने उसी तारीख को नया चक्र खुलता है।'
        : 'Each monthly poll runs from its drop date through the final second of that calendar month. Standings lock at month-end, and a fresh round unlocks on the exact same date next month.',
      actionLabel: lang === 'HI' ? 'कैलेंडर देखें ❯' : 'View Calendar ❯',
      actionTab: 'schedule' as const
    },
    {
      id: 'civic_league',
      icon: '🏆',
      accentColor: '#7c3aed',
      tag: lang === 'HI' ? 'संसदीय गौरव' : 'Civic League',
      tagColor: '#6d28d9',
      tagBg: '#f5f3ff',
      tagBorder: '#ddd6fe',
      title: lang === 'HI' 
        ? 'अपनी भागीदारी से अपने संसदीय क्षेत्र का मान बढ़ाएं' 
        : 'Earn DBG Credits & Elevate Your Lok Sabha',
      body: lang === 'HI'
        ? 'हर मतदान पर DBG क्रेडिट और नागरिक XP पाएं। आपके क्षेत्र से जितनी अधिक भागीदारी होगी, आपकी लोकसभा सीट अखिल भारतीय लीडरबोर्ड पर उतनी ही ऊपर पहुंचेगी।'
        : 'Collect DBG points and civic XP with every vote. Active participation strengthens your constituency\'s voice and propels your Lok Sabha seat up the All-India Leaderboard.',
      actionLabel: lang === 'HI' ? 'लीडरबोर्ड देखें ❯' : 'View League ❯',
      actionTab: 'rankings' as const
    }
  ];

  // Auto-scroll every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 15000);
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
        padding: '14px 16px 12px 16px',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '198px',
        maxHeight: '198px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.25s ease'
      }}>
        {/* Subtle Top Gradient Accent Strip */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          backgroundColor: slide.accentColor,
          transition: 'background-color 0.4s ease'
        }} />

        {/* Top Header Row: Icon Badge + Category Pill + Step Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: slide.tagBg,
              border: `1px solid ${slide.tagBorder}`,
              fontSize: '15px'
            }}>
              {slide.icon}
            </span>
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

          {/* Micro Pill Dots */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                style={{
                  width: idx === currentSlide ? '18px' : '5px',
                  height: '5px',
                  borderRadius: '999px',
                  backgroundColor: idx === currentSlide ? slide.accentColor : '#cbd5e1',
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

        {/* Content Body: Header + Full 5-Line Narrative */}
        <div style={{ marginTop: '6px', marginBottom: '4px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
            lineHeight: 1.46,
            display: '-webkit-box',
            WebkitLineClamp: 5,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {slide.body}
          </p>
        </div>

        {/* Footer Row: Sequence Indicator + Action Link */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px dashed #f1f5f9',
          paddingTop: '6px',
          fontSize: '10.5px'
        }}>
          <span style={{ color: '#94a3b8', fontWeight: 700 }}>
            {currentSlide + 1} / {slides.length} • BhuMat Protocol
          </span>
          {slide.actionLabel && onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab(slide.actionTab!)}
              style={{
                background: 'none',
                border: 'none',
                color: slide.tagColor,
                fontWeight: 800,
                fontSize: '11px',
                cursor: 'pointer',
                padding: '2px 4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px'
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