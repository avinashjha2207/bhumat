'use client';

import React from 'react';

interface Poll {
  id: string;
  category: string;
  title_en: string;
  title_hi: string;
  target_region_type?: string;
  target_seats?: string[];
  blackout_seats?: string[];
  starts_at?: string;
  participation_mode?: string;
  current_cycle?: string;
  recurrence?: string;
  is_active?: boolean;
  next_starts_at?: string;
  options: { id: number; text_en: string; text_hi: string }[];
}

interface SearchTabProps {
  polls: Poll[];
  searchPollMatches: Poll[];
  pollSearchQuery: string;
  setPollSearchQuery: (q: string) => void;
  activeCategoryFilter: 'ALL' | 'JanMat' | 'LokMat';
  setActiveCategoryFilter: (filter: 'ALL' | 'JanMat' | 'LokMat') => void;
  lang: 'EN' | 'HI';
  votedCycleKeys: string[];
  flippedOverrides: Record<string, boolean>;
  openExpandedView: (poll: Poll) => void;
  setActiveTab: (tab: 'vote' | 'schedule' | 'search' | 'profile') => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  triggerInfoPopup?: (title: string, desc: string, e: React.MouseEvent) => void;
}

export default function SearchTab({
  polls,
  searchPollMatches,
  pollSearchQuery,
  setPollSearchQuery,
  activeCategoryFilter,
  setActiveCategoryFilter,
  lang,
  votedCycleKeys,
  openExpandedView,
  setActiveTab,
  searchInputRef,
  triggerInfoPopup
}: SearchTabProps) {
  // Accurate Chronological Counting
  const now = new Date();
  const activePollsCount = polls.filter((p) => p.is_active !== false && (!p.starts_at || new Date(p.starts_at) <= now)).length;
  const scheduledCount = polls.filter((p) => p.starts_at && new Date(p.starts_at) > now).length;

  const handleInfo = (title: string, desc: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (triggerInfoPopup) {
      triggerInfoPopup(title, desc, e);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box' }}>
      
      {/* 1. Contextual Tip Banner */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{ fontSize: '13px' }}>💡</span>
        <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600, lineHeight: 1.35 }}>
          {lang === 'HI'
            ? 'सक्रिय या पहले हो चुके किसी भी प्रश्न को खोजें और अपने क्षेत्र का नक्शा देखें।'
            : 'Search active or past topics to view your district and state map.'}
        </span>
      </div>

      {/* 2. Compact Search & Filter Island */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '16px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
      }}>
        {/* Header Badges with Live Radar Pulse */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#475569', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: '5px', letterSpacing: '0.04em' }}>
              {lang === 'HI' ? 'जनमत संग्रह' : 'OPINION ARCHIVE'}
            </span>
            <span
              onClick={(e) => handleInfo(
                lang === 'HI' ? 'अखिल भारतीय जनमत संग्रह' : 'National Opinion Archive',
                lang === 'HI'
                  ? 'यहां भारत के सभी 543 संसदीय क्षेत्रों के वर्तमान एवं पुराने प्रश्न मौजूद हैं। आप किसी भी प्रश्न पर मत देकर तुरंत अपने क्षेत्र का परिणाम देख सकते हैं।'
                  : 'Search all active and previous topics across Bharat. Casting your ballot on any poll instantly unmasks your constituency consensus.',
                e
              )}
              style={{ fontSize: '10px', color: '#0284c7', cursor: 'pointer', padding: '0 2px' }}
            >
              ⓘ
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Live Radar Active Badge */}
            <div
              onClick={(e) => handleInfo(
                lang === 'HI' ? 'सक्रिय मतदान (Active)' : 'Active Ballots',
                lang === 'HI'
                  ? 'वे प्रश्न जिनपर अभी मतदान चालू है। आप अभी वोट देकर अपने क्षेत्र का लाइव स्कोर प्रभावित कर सकते हैं।'
                  : 'Polls currently open for voting. Cast your ballot to directly update your district tally.',
                e
              )}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '2px 7px',
                borderRadius: '999px',
                cursor: 'pointer'
              }}
            >
              <div style={{ position: 'relative', width: '7px', height: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#10b981', animation: 'headerRadarWave 2s infinite cubic-bezier(0.4, 0, 0.2, 1)' }} />
                <div style={{ position: 'relative', width: '4.5px', height: '4.5px', borderRadius: '50%', backgroundColor: '#059669', zIndex: 2 }} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#065f46' }}>
                {activePollsCount} {lang === 'HI' ? 'सक्रिय' : 'Active'} ⓘ
              </span>
            </div>

            {/* Scheduled Badge */}
            <div
              onClick={(e) => handleInfo(
                lang === 'HI' ? 'निर्धारित प्रश्न (Scheduled)' : 'Upcoming Scheduled Drops',
                lang === 'HI'
                  ? 'ये प्रश्न आने वाले दिनों में सुबह 8 बजे या शाम 8 बजे अनलॉक होंगे। निष्पक्षता बनाए रखने के लिए विकल्प अभी सीलबंद हैं।'
                  : 'Questions releasing in upcoming days. Options remain locked until the official drop time.',
                e
              )}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                padding: '2px 7px',
                borderRadius: '999px',
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#0369a1' }}>
                📅 {scheduledCount} {lang === 'HI' ? 'आगामी' : 'Scheduled'} ⓘ
              </span>
            </div>
          </div>
        </div>

        {/* Input Field with Clear Button */}
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={lang === 'HI' ? "🔍 विषय, मुद्दा या शब्द खोजें..." : "🔍 Search by topic, keyword, or issue..."}
            value={pollSearchQuery}
            onChange={(e) => setPollSearchQuery(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '9px 32px 9px 12px',
              borderRadius: '10px',
              border: '1.5px solid #cbd5e1',
              fontSize: '12px',
              color: '#0f172a',
              outline: 'none',
              backgroundColor: '#f8fafc'
            }}
          />
          {pollSearchQuery && (
            <button
              type="button"
              onClick={() => setPollSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 800
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Strip */}
        <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
          {(['ALL', 'JanMat', 'LokMat'] as const).map((cat) => {
            const isActive = activeCategoryFilter === cat;
            const label = cat === 'ALL'
              ? (lang === 'HI' ? 'सभी प्रश्न' : `All (${polls.length})`)
              : (cat === 'JanMat' ? '🌆 JanMat' : '🌅 LokMat');
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategoryFilter(cat)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isActive ? '#0f172a' : 'transparent',
                  color: isActive ? '#ffffff' : '#64748b',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Search Results List */}
      {searchPollMatches.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1.5px solid #e2e8f0',
          padding: '28px 20px',
          textAlign: 'center',
          color: '#64748b',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>🔍</div>
          <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>
            {lang === 'HI' ? 'कोई प्रश्न नहीं मिला' : 'No matching questions found'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            {lang === 'HI' ? 'अन्य शब्द लिखकर खोजें या सभी प्रश्न देखें।' : 'Try different keywords or browse all categories.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {searchPollMatches.map((poll) => {
            const isJanMat = (poll.category || '').toLowerCase() === 'janmat';
            const isOneTime = poll.participation_mode === 'one_time';
            const hasVoted = votedCycleKeys.some((k) => k.startsWith(`${poll.id}___`));
            const isScheduledFuture = Boolean(poll.starts_at && new Date(poll.starts_at) > now);

            const handleCardClick = () => {
              if (isScheduledFuture) {
                const dateStr = new Date(poll.starts_at!).toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                handleInfo(
                  lang === 'HI' ? '🔒 आगामी प्रश्न' : '🔒 Scheduled Drop',
                  lang === 'HI'
                    ? `यह प्रश्न ${dateStr} को खुलेगा। निष्पक्षता बनाए रखने के लिए विकल्प अभी सीलबंद हैं।`
                    : `Drops on ${dateStr}. Options unlock at scheduled release time.`,
                  { stopPropagation: () => {} } as any
                );
                return;
              }
              if (hasVoted) {
                openExpandedView(poll);
              } else {
                setActiveTab('vote');
                setTimeout(() => {
                  const targetNode = document.getElementById(`poll-card-${poll.id}`);
                  if (targetNode) {
                    targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }, 150);
              }
            };

            return (
              <div
                key={poll.id}
                onClick={handleCardClick}
                style={{
                  backgroundColor: '#ffffff',
                  border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  transition: 'transform 0.12s ease'
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      color: isJanMat ? '#059669' : '#d97706',
                      backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb',
                      border: `1px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                      padding: '1.5px 6px',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}>
                      <span>{isJanMat ? '🌆' : '🌅'}</span>
                      <span>{poll.category}</span>
                    </span>

                    {/* Cadence Explainer Tag */}
                    <span
                      onClick={(e) => handleInfo(
                        isOneTime 
                          ? (lang === 'HI' ? 'एकमुश्त मत (One-Time)' : 'One-Time Ballot') 
                          : (lang === 'HI' ? 'मासिक चक्र (Monthly)' : 'Monthly Recurring Cycle'),
                        isOneTime
                          ? (lang === 'HI' ? 'इस प्रश्न पर हर नागरिक केवल एक बार मत देता है। यह हमेशा के लिए राष्ट्रीय स्कोरबोर्ड का हिस्सा बन जाता है।' : 'Every citizen votes once on this issue. Permanently records your district consensus.')
                          : (lang === 'HI' ? 'यह प्रश्न प्रत्येक माह ताजा राय जानने हेतु खुलता है, ताकि देखा जा सके कि स्थिति सुधर रही है या बिगड़ रही है।' : 'Re-opens every month to measure whether local conditions are improving or worsening.'),
                        e
                      )}
                      style={{
                        fontSize: '8.5px',
                        fontWeight: 700,
                        color: '#64748b',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '1.5px 5px',
                        borderRadius: '4px'
                      }}
                    >
                      {isOneTime ? (lang === 'HI' ? 'एकमुश्त ⓘ' : 'ONE-TIME ⓘ') : (lang === 'HI' ? 'मासिक ⓘ' : 'MONTHLY ⓘ')}
                    </span>
                  </div>

                  {/* Action Link: Drishti or Vote */}
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: isScheduledFuture ? '#64748b' : (hasVoted ? '#059669' : '#0284c7'),
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    {isScheduledFuture ? (
                      <span>⏳ {poll.starts_at ? new Date(poll.starts_at).toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' }) : 'Soon'}</span>
                    ) : (
                      <>
                        <span>{hasVoted ? (lang === 'HI' ? 'नक्शा देखें' : 'View Drishti') : (lang === 'HI' ? 'मत देकर खोलें' : 'Vote to Unlock')}</span>
                        <span>❯</span>
                      </>
                    )}
                  </span>
                </div>

                {/* English Question (Compact 13.5px) */}
                <h4 style={{
                  fontSize: '13.5px',
                  fontWeight: 750,
                  color: '#0f172a',
                  lineHeight: 1.38,
                  margin: '2px 0 3px 0',
                  letterSpacing: '-0.01em'
                }}>
                  {poll.title_en}
                </h4>

                {/* Localized Hindi Translation */}
                <p style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#64748b',
                  lineHeight: 1.4,
                  margin: 0,
                  paddingTop: '3px',
                  borderTop: '1px dashed #f1f5f9'
                }}>
                  {poll.title_hi}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}