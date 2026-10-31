'use client';
import React, { useState } from 'react';
import { evaluatePollSchedule } from './utils/pollScheduler';
import { getCurrentCycleId } from './utils/cycleManager';

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

interface ScheduleTabProps {
  polls: any[];
  scheduledQueueList: any[];
  archivedPollsList?: any[];
  lang: 'EN' | 'HI';
  votedCycleKeys: string[];
  openExpandedView: (poll: any) => void;
  setActiveCategoryFilter: (filter: 'ALL' | 'LokMat' | 'JanMat') => void;
  setActiveTab: (tab: 'vote' | 'schedule' | 'search' | 'profile') => void;
  triggerInfoPopup: (title: string, desc: string, e: React.MouseEvent) => void;
}

export default function ScheduleTab({
  polls,
  scheduledQueueList,
  archivedPollsList = [],
  lang,
  votedCycleKeys,
  openExpandedView,
  setActiveCategoryFilter,
  setActiveTab,
  triggerInfoPopup,
}: ScheduleTabProps) {
  const [scheduleViewMode, setScheduleViewMode] = useState<'OVERVIEW' | 'CALENDAR'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('bhumat_schedule_view_mode');
      if (saved === 'CALENDAR' || saved === 'OVERVIEW') return saved;
    }
    return 'OVERVIEW';
  });

  const handleSetScheduleViewMode = (mode: 'OVERVIEW' | 'CALENDAR') => {
    setScheduleViewMode(mode);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('bhumat_schedule_view_mode', mode);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number>(() => new Date().getDate());
  const [scheduleCategoryFilter, setScheduleCategoryFilter] = useState<'ALL' | 'LokMat' | 'JanMat'>('ALL');
  const [scheduleMonthOffset, setScheduleMonthOffset] = useState<number>(0);

  // Anchor to day 1 to prevent 31st end-of-month rollover bugs
  const todayDate = new Date();
  const rawTargetMonth = todayDate.getMonth() + (scheduleMonthOffset || 0);
  const currentYear = todayDate.getFullYear() + Math.floor(rawTargetMonth / 12);
  const currentMonth = ((rawTargetMonth % 12) + 12) % 12;
  const baseDate = new Date(currentYear, currentMonth, 1);
  const seasonNumber = currentMonth + 1;
  const activeMonthName = baseDate.toLocaleString(lang === 'HI' ? 'hi-IN' : 'en-US', { month: 'long' });
  const activeMonthShort = baseDate.toLocaleString(lang === 'HI' ? 'hi-IN' : 'en-US', { month: 'short' }).toUpperCase();
  const seasonTitleText = lang === 'HI'
    ? `${activeMonthName} सत्र (सत्र ${seasonNumber} • ${currentYear})`
    : `${activeMonthName} Season (Season ${seasonNumber} • ${currentYear})`;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayRaw = new Date(currentYear, currentMonth, 1).getDay();
  const startOffset = (firstDayRaw + 6) % 7;
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
  const safeSelectedDay = Math.min(selectedCalendarDay, daysInMonth);
  const selectedDateObj = new Date(currentYear, currentMonth, safeSelectedDay);
  const selectedDayWeekday = selectedDateObj.toLocaleString(lang === 'HI' ? 'hi-IN' : 'en-US', { weekday: 'short' }).toUpperCase();

  const isViewingCurrentMonth = currentMonth === todayDate.getMonth() && currentYear === todayDate.getFullYear();
  const pollsForSelectedDay = polls
    .filter((p) => {
      const dropDateStr = p.starts_at || p.next_starts_at;
      if (!dropDateStr) return false;
      const pd = new Date(dropDateStr);
      return (
        pd.getDate() === safeSelectedDay &&
        pd.getMonth() === currentMonth &&
        pd.getFullYear() === currentYear
      );
    })
  .sort((a, b) => {
    const hourA = new Date(a.starts_at || 0).getHours();
    const hourB = new Date(b.starts_at || 0).getHours();
    if (hourA !== hourB) return hourA - hourB;
    const isLokA = (a.category || '').toLowerCase() === 'lokmat';
    const isLokB = (b.category || '').toLowerCase() === 'lokmat';
    if (isLokA && !isLokB) return -1;
    if (!isLokA && isLokB) return 1;
    return 0;
  });

  if (scheduleViewMode === 'CALENDAR') {
    return (
      <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
          <button
            type="button"
            onClick={() => handleSetScheduleViewMode('OVERVIEW')}
            style={{
              background: '#ffffff',
              border: '1.5px solid #cbd5e1',
              borderRadius: '10px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
          >
            <span>←</span>
            <span>{lang === 'HI' ? 'समय-सारणी मुख्य पृष्ठ' : 'Schedule Overview'}</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {activeMonthShort} {currentYear}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 7px', borderRadius: '5px' }}>
              {lang === 'HI' ? `सत्र ${seasonNumber}` : `S-${seasonNumber}`}
            </span>
          </div>
        </div>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          border: '1.5px solid #e2e8f0',
          padding: '18px 16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
        }}>
          {/* Running Month vs Next Month Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 4px' }}>
            <button
              type="button"
              disabled={scheduleMonthOffset === 0}
              onClick={() => setScheduleMonthOffset(0)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: scheduleMonthOffset === 0 ? '#f1f5f9' : '#ffffff',
                color: scheduleMonthOffset === 0 ? '#94a3b8' : '#0f172a',
                fontSize: '11px',
                fontWeight: 800,
                cursor: scheduleMonthOffset === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              ◀ {lang === 'HI' ? 'चालू माह' : 'Current Month'}
            </button>
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
              {(() => {
                const d = new Date();
                d.setMonth(d.getMonth() + scheduleMonthOffset);
                return d.toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' });
              })()}
            </span>
            <button
              type="button"
              disabled={scheduleMonthOffset === 1}
              onClick={() => setScheduleMonthOffset(1)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: scheduleMonthOffset === 1 ? '#f1f5f9' : '#ffffff',
                color: scheduleMonthOffset === 1 ? '#94a3b8' : '#0f172a',
                fontSize: '11px',
                fontWeight: 800,
                cursor: scheduleMonthOffset === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              {lang === 'HI' ? 'अगला माह' : 'Next Month'} ▶
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
            <span
              onClick={(e) => triggerInfoPopup(
                lang === 'HI' ? 'दैनिक प्रश्न समय-सारणी' : 'Daily Question Schedule',
                lang === 'HI'
                  ? 'यह कैलेंडर दिखाता है कि किस तारीख को कौन सा प्रश्न खुलेगा। 🟠 नारंगी बिंदी सुबह 8 बजे का लोकमत है, 🟢 हरी बिंदी शाम 8 बजे का जनमत ऑडिट है। वोट देने पर बिंदी सही के निशान (✓) में बदल जाती है।'
                  : 'Shows which questions unlock on each date. 🟠 Orange dots mark 08:00 AM LokMat drops, 🟢 Green dots mark 08:00 PM JanMat audits. Once you cast a vote, the dot turns into a checkmark (✓).',
                e
              )}
              style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', letterSpacing: '0.04em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>{lang === 'HI' ? 'दैनिक कैलेंडर' : 'Daily Schedule Matrix'}</span>
              <span style={{ fontSize: '10px' }}>ⓘ</span>
            </span>
            <div style={{ display: 'flex', gap: '10px', fontSize: '11px', fontWeight: 800 }}>
              <span style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                LokMat (08 AM)
              </span>
              <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                JanMat (08 PM)
              </span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '10px' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, idx) => (
              <div key={idx} style={{ fontSize: '11.5px', fontWeight: 800, color: idx >= 5 ? '#ef4444' : '#64748b' }}>
                {w}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center' }}>
            {Array.from({ length: startOffset }).map((_, idx) => {
              const dayNum = prevMonthDays - startOffset + idx + 1;
              return (
                <div key={`prev-${idx}`} style={{ padding: '8px 2px', opacity: 0.25, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>{dayNum}</span>
                </div>
              );
            })}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const isSelected = selectedCalendarDay === dayNum;
              const isWeekend = (startOffset + idx) % 7 >= 5;
              const dayPolls = polls.filter((p) => {
                const dropDateStr = p.starts_at || p.next_starts_at;
                if (!dropDateStr) return false;
                const pd = new Date(dropDateStr);
                return pd.getDate() === dayNum && pd.getMonth() === currentMonth && pd.getFullYear() === currentYear;
              });

              const lokmatPollsForDay = dayPolls.filter((p) => (p.category || '').toLowerCase() === 'lokmat');
              const janmatPollsForDay = dayPolls.filter((p) => (p.category || '').toLowerCase() === 'janmat');
              const hasActualLokMat = lokmatPollsForDay.length > 0;
              const hasActualJanMat = janmatPollsForDay.length > 0;

              // Robust Vote Check: Evaluates votedCycleKeys, localStorage, and session state
              const isPollVoted = (pId: string) => {
                if (votedCycleKeys.some((k) => k.startsWith(`${pId}___`))) return true;
                if (typeof window !== 'undefined') {
                  const stored = localStorage.getItem('bhumat_voted_cycles') || '';
                  if (stored.includes(pId)) return true;
                  const storedChoices = localStorage.getItem('bhumat_voted_polls') || '';
                  if (storedChoices.includes(pId)) return true;
                }
                return false;
              };

              const hasVotedLokMatOnDay = lokmatPollsForDay.some((p) => isPollVoted(p.id));
              const hasVotedJanMatOnDay = janmatPollsForDay.some((p) => isPollVoted(p.id));

              

              return (
                <div
                  key={dayNum}
                  onClick={() => setSelectedCalendarDay(dayNum)}
                  style={{
                    padding: '8px 2px 10px 2px',
                    borderRadius: '12px',
                    border: isSelected ? '2px solid #0284c7' : '1.5px solid transparent',
                    backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{
                    fontSize: '12.5px',
                    fontWeight: isSelected ? 900 : 700,
                    color: isSelected ? '#0284c7' : isWeekend ? '#ef4444' : '#0f172a'
                  }}>
                    {dayNum}
                  </span>
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'center', minHeight: '8px' }}>
                    {hasActualLokMat && (
                      <span
                        title={hasVotedLokMatOnDay ? 'LokMat Voted ✓' : 'LokMat Drop'}
                        style={{
                          width: hasVotedLokMatOnDay ? '11px' : '6px',
                          height: hasVotedLokMatOnDay ? '11px' : '6px',
                          borderRadius: hasVotedLokMatOnDay ? '3px' : '50%',
                          backgroundColor: '#f59e0b',
                          color: '#ffffff',
                          fontSize: '8px',
                          fontWeight: 900,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1
                        }}
                      >
                        {hasVotedLokMatOnDay ? '✓' : ''}
                      </span>
                    )}
                    {hasActualJanMat && (
                      <span
                        title={hasVotedJanMatOnDay ? 'JanMat Voted ✓' : 'JanMat Drop'}
                        style={{
                          width: hasVotedJanMatOnDay ? '11px' : '6px',
                          height: hasVotedJanMatOnDay ? '11px' : '6px',
                          borderRadius: hasVotedJanMatOnDay ? '3px' : '50%',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          fontSize: '8px',
                          fontWeight: 900,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1
                        }}
                      >
                        {hasVotedJanMatOnDay ? '✓' : ''}
                      </span>
                    )}
                    {!hasActualLokMat && !hasActualJanMat && (
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#e2e8f0' }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {selectedCalendarDay}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#64748b' }}>
              {selectedDayWeekday} • {activeMonthName} {currentYear}
            </span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7' }}>
            {pollsForSelectedDay.length} {pollsForSelectedDay.length === 1 ? (lang === 'HI' ? 'प्रश्न निर्धारित' : 'Poll Scheduled') : (lang === 'HI' ? 'प्रश्न निर्धारित' : 'Polls Scheduled')}
          </span>
        </div>
        {pollsForSelectedDay.length === 0 ? (
          <div style={{
            backgroundColor: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '20px',
            padding: '28px 20px',
            textAlign: 'center',
            color: '#64748b',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔒</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              {lang === 'HI' ? 'इस तिथि हेतु कोई प्रश्न निर्धारित नहीं है' : 'No Drops Scheduled For This Date'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
              {lang === 'HI' 
                ? 'इस तिथि के प्रश्न ड्रॉप समय के करीब प्रकाशित किए जाएंगे।' 
                : 'Polls for this date will appear as the seasonal cycle progresses.'}
            </div>
          </div>
        ) : (
          pollsForSelectedDay.map((p) => {
            const isJanMat = (p.category || '').toLowerCase() === 'janmat';
            const dropTime = isJanMat ? '08:00 PM' : '08:00 AM';
            
            const hasVotedThis = votedCycleKeys.some((k) => k.startsWith(`${p.id}___`)) ||
              (typeof window !== 'undefined' && (
                (localStorage.getItem('bhumat_voted_cycles') || '').includes(p.id) ||
                (localStorage.getItem('bhumat_voted_polls') || '').includes(p.id)
              ));
              
            const choicesCount = Array.isArray(p.options) ? p.options.length : 3;

            const handleDayCardClick = () => {
              // If already voted or archived, open the 543 Drishti map
              if (hasVotedThis || (p.closes_at && new Date(p.closes_at) <= new Date())) {
                openExpandedView(p);
              } else {
                // If active and unvoted, navigate to Vote tab and scroll to card
                setActiveTab('vote');
                setTimeout(() => {
                  const targetCard = document.getElementById(`poll-card-${p.id}`);
                  if (targetCard) {
                    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }, 150);
              }
            };

            return (
              <div
                key={p.id}
                onClick={handleDayCardClick}
                style={{
                  backgroundColor: '#ffffff',
                  border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                  borderRadius: '16px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease'
                }}
              >
                {/* Header: Pillar Badge + Options Pill + Unified Time Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color: isJanMat ? '#059669' : '#d97706',
                      backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb',
                      padding: '2.5px 8px',
                      borderRadius: '999px',
                      border: `1px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span>{isJanMat ? '🌆' : '🌅'}</span>
                      <span>{p.category}</span>
                    </span>

                    <span style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      color: '#64748b',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: '2px 7px',
                      borderRadius: '6px'
                    }}>
                      {choicesCount} {lang === 'HI' ? 'विकल्प' : 'Choices'}
                    </span>
                  </div>

                  {/* Single Unified Time Badge */}
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: '#0284c7',
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>{hasVotedThis ? '✓' : '🔒'}</span>
                    <span>{dropTime}</span>
                  </span>
                </div>

                {/* Primary English Question */}
                <div style={{
                  fontSize: '14.5px',
                  fontWeight: 750,
                  color: '#0f172a',
                  lineHeight: 1.42,
                  marginTop: '2px',
                  letterSpacing: '-0.01em'
                }}>
                  {lang === 'EN' ? p.title_en : p.title_hi}
                </div>

                {/* Secondary Localized Translation with Soft Divider & Breathing Room */}
                <div style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#64748b',
                  lineHeight: 1.45,
                  paddingTop: '8px',
                  marginTop: '2px',
                  borderTop: '1px dashed #f1f5f9'
                }}>
                  {lang === 'EN' ? p.title_hi : p.title_en}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.04em' }}>
            {lang === 'EN' ? `SEASON ${seasonNumber} • ACTIVE CYCLE` : `सत्र ${seasonNumber} • सक्रिय चक्र`}
          </span>
          <span
            onClick={(e) => triggerInfoPopup(
              lang === 'EN' ? '12 Monthly Seasons' : '12 मासिक सत्र',
              lang === 'EN'
                ? 'BhuMat operates in 12 monthly cycles per year. At the end of each month, final district rankings and scores are recorded.'
                : 'भूमत साल में 12 मासिक चक्रों में चलता है। हर महीने के अंत में सभी संसदीय क्षेत्रों के अंतिम परिणाम दर्ज किए जाते हैं।',
              e
            )}
            style={{ fontSize: '11px', fontWeight: 700, color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span>● {lang === 'EN' ? '12 Seasons / Year' : '12 सत्र / वर्ष'}</span>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>ⓘ</span>
          </span>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 850, margin: '4px 0 3px 0', color: '#0f172a', letterSpacing: '-0.015em' }}>
          {seasonTitleText}
        </h2>
        <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.45 }}>
          {lang === 'EN'
            ? 'National ballots follow scheduled drops. Once cast, your vote is recorded in your Lok Sabha seat\'s tally for this cycle.'
            : 'राष्ट्रीय मत निर्धारित समय पर जारी होते हैं। मतदान के बाद आपका मत आपके संसदीय क्षेत्र के आंकड़े में सुरक्षित जुड़ जाता है।'}
        </p>
      </div>
      {/* Contextual Tip Banner for Schedule */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px' }}>💡</span>
          <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
            {lang === 'HI' ? 'लोकमत सुबह 8 बजे एवं जनमत शाम 8 बजे जारी होता है। 7 दिन की स्ट्रीक पर +1 DBG पाएं।' : 'Morning Drop (08 AM) & Evening Audit (08 PM). Maintain 7-day streaks for +1 DBG.'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2px 4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>
            {lang === 'EN' ? 'Daily Drop Rhythm' : 'दैनिक मतदान समय'}
          </span>
          <span
            onClick={(e) => triggerInfoPopup(
              lang === 'HI' ? 'दैनिक मतदान की दिनचर्या' : 'The Daily Drop Rhythm',
              lang === 'HI'
                ? 'भूमत पर रोज़ दो बार मतदान होता है:\n• सुबह 08:00 बजे: लोकमत (मनोरंजन, खेल, खान-पान - खुला मत)\n• शाम 08:00 बजे: जनमत (सड़क, बिजली, सुरक्षा - 100% गोपनीय मत)'
                : 'BhuMat drops two ballots daily:\n• 08:00 AM: LokMat (Culture, lifestyle & sports - open profile stance)\n• 08:00 PM: JanMat (Civic infrastructure - 100% anonymous secret ballot)',
              e
            )}
            style={{ fontSize: '10.5px', fontWeight: 700, color: '#0284c7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
          >
            <span>{lang === 'HI' ? 'समय नियम' : 'Rhythm Rules'}</span>
            <span style={{ fontSize: '10px' }}>ⓘ</span>
          </span>
        </div>
        <div
          onClick={() => {
            setActiveCategoryFilter('LokMat');
            setActiveTab('vote');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          style={{ backgroundColor: '#ffffff', border: '1.5px solid #fde68a', borderRadius: '16px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
              🌅
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#92400e' }}>
                {lang === 'EN' ? '08:00 AM Morning Drop' : 'सुबह 08:00 बजे'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#d97706', fontWeight: 600 }}>
                {lang === 'EN' ? 'LokMat Cultural Pulse • Public Mat' : 'लोकमत सांस्कृतिक पल्स • खुला मत'}
              </div>
            </div>
          </div>
          <span style={{ fontSize: '11.5px', color: '#f59e0b', fontWeight: 800 }}>
            {lang === 'EN' ? 'Active ❯' : 'सक्रिय ❯'}
          </span>
        </div>
        <div
          onClick={() => {
            setActiveCategoryFilter('JanMat');
            setActiveTab('vote');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          style={{ backgroundColor: '#ffffff', border: '1.5px solid #a7f3d0', borderRadius: '16px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
              🌆
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#064e3b' }}>
                {lang === 'EN' ? '08:00 PM Evening Drop' : 'शाम 08:00 बजे'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600 }}>
                {lang === 'EN' ? 'JanMat Civic Audit • Secret Ballot' : 'जनमत नागरिक ऑडिट • गोपनीय मतपेटी'}
              </div>
            </div>
          </div>
          <span style={{ fontSize: '11.5px', color: '#10b981', fontWeight: 800 }}>
            {lang === 'EN' ? 'Active ❯' : 'सक्रिय ❯'}
          </span>
        </div>
      </div>
      
      {/* Row 1: Clean Header with Calendar View aligned flush right */}
      {(() => {
        const filteredList = scheduledQueueList
          .filter((item) => {
            if (scheduleCategoryFilter === 'ALL') return true;
            return (item.category || '').toLowerCase() === scheduleCategoryFilter.toLowerCase();
          })
          .sort((a, b) => new Date(a.starts_at || 0).getTime() - new Date(b.starts_at || 0).getTime());

        return (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', marginBottom: '8px' }}>
              <div
                onClick={(e) => triggerInfoPopup(
                  lang === 'HI' ? 'आगामी निर्धारित प्रश्न' : 'Upcoming Scheduled Drops',
                  lang === 'HI'
                    ? 'ये वे प्रश्न हैं जो आने वाले दिनों में निर्धारित समय पर अनलॉक होंगे। ड्रॉप समय आने से पहले विकल्प सीलबंद रहते हैं ताकि कोई पक्षपात न हो।'
                    : 'These are questions scheduled to unlock in the coming days. Options remain strictly sealed until the drop time to ensure complete fairness.',
                  e
                )}
                style={{ fontSize: '12.5px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.04em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>{lang === 'HI' ? 'आगामी प्रश्न' : 'Upcoming Scheduled Drops'} ({filteredList.length})</span>
                <span style={{ fontSize: '10.5px', color: '#0284c7' }}>ⓘ</span>
              </div>
              <button
                type="button"
                onClick={() => handleSetScheduleViewMode('CALENDAR')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#0f172a',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                <span>📅</span>
                <span>{lang === 'HI' ? 'कैलेंडर देखें' : 'Calendar View'}</span>
              </button>
            </div>

            {/* Row 2: Clean LokMat / JanMat Filter Strip */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {(['ALL', 'LokMat', 'JanMat'] as const).map((cat) => {
                const isCatActive = scheduleCategoryFilter === cat;
                const label = cat === 'ALL'
                  ? (lang === 'HI' ? 'सभी ड्रॉप्स' : 'All Drops')
                  : (cat === 'LokMat' ? '🌅 LokMat' : '🌆 JanMat');
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setScheduleCategoryFilter(cat)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: isCatActive ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                      backgroundColor: isCatActive ? '#0f172a' : '#ffffff',
                      color: isCatActive ? '#ffffff' : '#475569',
                      fontSize: '11.5px',
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

            {/* Scheduled Drops List */}
            {filteredList.length === 0 ? (
              <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '24px 20px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
                {lang === 'EN'
                  ? '✓ No scheduled drops found for this category filter.'
                  : '✓ इस श्रेणी फ़िल्टर के लिए कोई निर्धारित प्रश्न नहीं मिला।'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredList.map((item) => {
                  const isItemJanMat = (item.category || '').toLowerCase() === 'janmat';
                  
                  // Compute Human-Readable Drop Time (e.g. "28 Oct • 08:00 AM")
                  const rawDropDate = item.starts_at ? new Date(item.starts_at) : (item.next_starts_at ? new Date(item.next_starts_at) : null);
                  const formattedDropTime = rawDropDate ? rawDropDate.toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  }) : (isItemJanMat ? '08:00 PM Drop' : '08:00 AM Drop');

                  const choicesCount = Array.isArray(item.options) ? item.options.length : 3;

                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '16px',
                        padding: '16px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                      }}
                    >
                      {/* Top Header Badge Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            color: isItemJanMat ? '#059669' : '#d97706',
                            backgroundColor: isItemJanMat ? '#ecfdf5' : '#fffbeb',
                            padding: '2.5px 8px',
                            borderRadius: '999px',
                            border: `1px solid ${isItemJanMat ? '#a7f3d0' : '#fde68a'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>{isItemJanMat ? '🌆' : '🌅'}</span>
                            <span>{item.category}</span>
                          </span>

                          <span style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            color: '#64748b',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            padding: '2px 7px',
                            borderRadius: '6px'
                          }}>
                            {choicesCount} {lang === 'HI' ? 'विकल्प' : 'Choices'}
                          </span>
                        </div>

                        {/* Explicit Date & Time Unlock Badge */}
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          color: '#0284c7',
                          backgroundColor: '#f0f9ff',
                          border: '1px solid #bae6fd',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>🔒</span>
                          <span>{formattedDropTime}</span>
                        </span>
                      </div>

                      {/* Primary English Question */}
                      <div style={{
                        fontSize: '14.5px',
                        fontWeight: 750,
                        color: '#0f172a',
                        lineHeight: 1.42,
                        marginTop: '2px',
                        letterSpacing: '-0.01em'
                      }}>
                        {lang === 'EN' ? item.title_en : item.title_hi}
                      </div>

                      {/* Secondary Localized Translation with Soft Divider & Breathing Room */}
                      <div style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#64748b',
                        lineHeight: 1.45,
                        paddingTop: '8px',
                        marginTop: '2px',
                        borderTop: '1px dashed #f1f5f9'
                      }}>
                        {lang === 'EN' ? item.title_hi : item.title_en}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}