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
  setPollSearchQuery: (query: string) => void;
  activeCategoryFilter: 'ALL' | 'JanMat' | 'LokMat';
  setActiveCategoryFilter: (filter: 'ALL' | 'JanMat' | 'LokMat') => void;
  lang: 'EN' | 'HI';
  votedCycleKeys: string[];
  flippedOverrides: Record<string, boolean>;
  openExpandedView: (poll: Poll) => void;
  setActiveTab: (tab: 'search' | 'vote' | 'schedule' | 'profile') => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
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
  flippedOverrides,
  openExpandedView,
  setActiveTab,
  searchInputRef
}: SearchTabProps) {
  const [scheduledNotice, setScheduledNotice] = React.useState<string | null>(null);
  const now = new Date();
  const activeCount = polls.filter((p: any) => p.is_active && (!p.starts_at || new Date(p.starts_at) <= now)).length;
  const scheduledCount = polls.filter((p: any) => p.starts_at && new Date(p.starts_at) > now).length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      width: '100%',
      maxWidth: '480px',
      margin: '0 auto',
      boxSizing: 'border-box',
      paddingBottom: '140px'
    }}>
      {/* Contextual Tip Banner for Search */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px' }}>💡</span>
          <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
            {lang === 'HI' ? 'अखिल भारतीय स्तर पर सक्रिय या समाप्त हो चुके किसी भी प्रश्न को खोजें।' : 'Search active or archived topics across all 543 Lok Sabha seats.'}
          </span>
        </div>
      </div>

      <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 800, backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.04em' }}>
            {lang === 'EN' ? 'OPINION ARCHIVE' : 'सभी जनमत'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '2px 7px', borderRadius: '6px' }}>
              🟢 {activeCount} {lang === 'EN' ? 'Active' : 'सक्रिय'}
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#0284c7', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 7px', borderRadius: '6px' }}>
              🗓️ {scheduledCount} {lang === 'EN' ? 'Scheduled' : 'निर्धारित'}
            </span>
          </div>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 850, margin: '6px 0 4px 0', color: '#0f172a', letterSpacing: '-0.015em' }}>
          {lang === 'EN' ? 'Search Public Opinion' : 'सार्वजनिक जनमत खोजें'}
        </h2>
        <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 14px 0', lineHeight: 1.45 }}>
          {lang === 'EN' 
            ? 'Search past and active questions across all 543 Lok Sabha seats:' 
            : 'भारत के सभी 543 लोकसभा क्षेत्रों के सक्रिय और पुराने प्रश्न खोजें:'}
        </p>

        <div style={{ position: 'relative', width: '100%', marginBottom: '12px' }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={lang === 'EN' ? "🔍 Search by topic, keyword, or issue..." : "🔍 विषय, मुद्दा या शब्द खोजें..."}
            value={pollSearchQuery}
            onChange={(e) => setPollSearchQuery(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 36px 12px 14px',
              borderRadius: '12px',
              border: '1.5px solid #cbd5e1',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
              backgroundColor: '#f8fafc',
              color: '#0f172a'
            }}
          />
          {pollSearchQuery && (
            <button
              type="button"
              onClick={() => setPollSearchQuery('')}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', fontWeight: 800 }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('ALL')}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: activeCategoryFilter === 'ALL' ? '#0f172a' : 'transparent',
              color: activeCategoryFilter === 'ALL' ? '#ffffff' : '#64748b',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {lang === 'EN' ? 'All (543)' : 'सभी (543)'}
          </button>
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('JanMat')}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: activeCategoryFilter === 'JanMat' ? '#059669' : 'transparent',
              color: activeCategoryFilter === 'JanMat' ? '#ffffff' : '#059669',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            JanMat
          </button>
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('LokMat')}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: activeCategoryFilter === 'LokMat' ? '#d97706' : 'transparent',
              color: activeCategoryFilter === 'LokMat' ? '#ffffff' : '#d97706',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            LokMat
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '40px' }}>
        {searchPollMatches.length === 0 ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '32px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔎</div>
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              {lang === 'EN' ? 'No matching polls found' : 'कोई प्रश्न नहीं मिला'}
            </div>
            <div style={{ fontSize: '12px' }}>
              {lang === 'EN' 
                ? 'Try searching with different keywords or switch filters.' 
                : 'कृपया अन्य शब्दों से खोजें या फ़िल्टर बदलें।'}
            </div>
          </div>
        ) : (
          searchPollMatches.map((poll) => {
            const isJanMat = poll.category === 'JanMat';
            const dynamicCycle = poll.participation_mode === 'recurring'
              ? (poll.current_cycle || 'lifetime')
              : (poll.current_cycle || 'lifetime');
            const cycleVoteKey = `${poll.id}___${dynamicCycle}`;
            const hasVotedThisCycle = Boolean(
              votedCycleKeys.includes(cycleVoteKey) ||
              votedCycleKeys.some((k) => k.startsWith(`${poll.id}___`)) ||
              (flippedOverrides && flippedOverrides[poll.id])
            );

            const isScheduledFuture = poll.starts_at && new Date(poll.starts_at) > new Date();

            const handleCardClick = () => {
              if (isScheduledFuture) {
                const dateStr = new Date(poll.starts_at!).toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                setScheduledNotice(
                  lang === 'HI'
                    ? `🔒 यह मत ${dateStr} को खुलेगा। निर्धारित समय पर मतदान उपलब्ध होगा।`
                    : `🔒 Drops on ${dateStr}. Voting opens once live.`
                );
                setTimeout(() => setScheduledNotice(null), 3500);
                return;
              }

              if (hasVotedThisCycle) {
                openExpandedView(poll);
              } else {
                setActiveTab('vote');
                setTimeout(() => {
                  const targetCard = document.getElementById(`poll-card-${poll.id}`);
                  if (targetCard) {
                    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }, 100);
              }
            };

            return (
              <div
                key={poll.id}
                onClick={handleCardClick}
                style={{
                  backgroundColor: '#ffffff',
                  border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                  borderRadius: '16px',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  transition: 'transform 0.1s ease, border-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        color: isJanMat ? '#059669' : '#d97706',
                        backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb',
                        border: `1px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                        padding: '2px 8px',
                        borderRadius: '999px'
                      }}
                    >
                      ● {poll.category}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                      {poll.recurrence ? `${poll.recurrence.toUpperCase()}` : 'MONTHLY'}
                    </span>
                  </div>
                  {hasVotedThisCycle ? (
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7' }}>
                      {lang === 'EN' ? 'View Drishti ❯' : 'दृष्टि देखें ❯'}
                    </span>
                  ) : isScheduledFuture ? (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 750,
                      color: '#64748b',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span>⏳</span>
                      <span>
                        {poll.starts_at 
                          ? `${lang === 'HI' ? 'खुलने की तिथि: ' : 'Drops '}${new Date(poll.starts_at).toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}`
                          : (lang === 'HI' ? 'शीघ्र खुलेगा' : 'Coming Soon')}
                      </span>
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: '#d97706',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span>🗳️</span>
                      <span>{lang === 'EN' ? 'Vote to Unlock' : 'मतदान आवश्यक'}</span>
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '15px',
                  fontWeight: hasVotedThisCycle ? 850 : 600,
                  color: '#0f172a',
                  lineHeight: 1.35
                }}>
                  {lang === 'EN' ? poll.title_en : poll.title_hi}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 400, color: '#64748b', lineHeight: 1.4 }}>
                  {lang === 'EN' ? poll.title_hi : poll.title_en}
                </div>
              </div>
            );
          })
        )}
      </div>
      {scheduledNotice && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '10px 16px',
          borderRadius: '12px',
          fontSize: '11.5px',
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 1000,
          maxWidth: '360px',
          textAlign: 'center',
          lineHeight: 1.4
        }}>
          {scheduledNotice}
        </div>
      )}
    </div>
  );
}