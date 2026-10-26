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
  const [scheduleViewMode, setScheduleViewMode] = useState<'OVERVIEW' | 'CALENDAR'>('OVERVIEW');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number>(() => new Date().getDate());
  const [scheduleCategoryFilter, setScheduleCategoryFilter] = useState<'ALL' | 'LokMat' | 'JanMat'>('ALL');
  const [scheduleMonthOffset, setScheduleMonthOffset] = useState<number>(0);

  const baseDate = new Date();
  baseDate.setMonth(baseDate.getMonth() + (scheduleMonthOffset || 0));
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth();
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

  const today = new Date();
  const isViewingCurrentMonth = currentMonth === today.getMonth() && currentYear === today.getFullYear();
  const pollsForSelectedDay = polls
  .filter((p) => {
    if (!p.starts_at) return false;
    const pd = new Date(p.starts_at);
    const isExactDay = pd.getDate() === safeSelectedDay && pd.getMonth() === currentMonth && pd.getFullYear() === currentYear;
    if (isExactDay) return true;
    if (isViewingCurrentMonth && safeSelectedDay === today.getDate() && p.is_active) {
      return pd <= today;
    }
    return false;
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
            onClick={() => setScheduleViewMode('OVERVIEW')}
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
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {lang === 'HI' ? 'दैनिक ड्रॉप चक्र' : 'Daily Cadence Matrix'}
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
                if (!p.starts_at) return false;
                const pd = new Date(p.starts_at);
                const isExactStartDay = pd.getDate() === dayNum && pd.getMonth() === currentMonth;
                if (isExactStartDay) return true;
                const todayInner = new Date();
                const isViewingToday = dayNum === todayInner.getDate() && currentMonth === todayInner.getMonth();
                if (isViewingToday && p.is_active) {
                  return pd <= todayInner;
                }
                return false;
              });
              const hasActualLokMat = dayPolls.some((p) => p.category === 'LokMat');
              const hasActualJanMat = dayPolls.some((p) => p.category === 'JanMat');
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
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '6px' }}>
                    {hasActualLokMat && (
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                    )}
                    {hasActualJanMat && (
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
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
            const isJanMat = p.category === 'JanMat';
            const dropTimeText = isJanMat ? '08:00 PM' : '08:00 AM';
            return (
              <div
                key={p.id}
                style={{
                  backgroundColor: '#ffffff',
                  border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#383423'}`,
                  borderRadius: '20px',
                  padding: '18px 18px 14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: isJanMat ? '#059669' : '#d97706',
                    backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    border: `1px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`
                  }}>
                    ● {p.category.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', backgroundColor: '#f0f9ff', padding: '3px 8px', borderRadius: '6px' }}>
                    ⏰ {dropTimeText}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', lineHeight: 1.35, marginBottom: '4px' }}>
                    {lang === 'EN' ? p.title_en : p.title_hi}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', lineHeight: 1.4 }}>
                    {lang === 'EN' ? p.title_hi : p.title_en}
                  </div>
                </div>
                <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '12px',
                      paddingTop: '8px',
                      borderTop: '1px dashed #e2e8f0',
                      fontSize: '11px'
                    }}>
                      <span style={{ color: isJanMat ? '#059669' : '#d97706', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{isJanMat ? '🔒' : '🌅'}</span>
                        <span>
                          {isJanMat 
                            ? (lang === 'HI' ? 'गोपनीय जनमत ऑडिट' : 'Secret Ballot Audit') 
                            : (lang === 'HI' ? 'सार्वजनिक सांस्कृतिक मत' : 'Public Cultural Pulse')}
                        </span>
                      </span>
                      <span style={{
                        color: '#64748b',
                        fontWeight: 700,
                        backgroundColor: '#f1f5f9',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '10.5px'
                      }}>
                        {lang === 'HI' 
                          ? `निर्धारित समय: ${isJanMat ? 'रात 08:00 बजे' : 'सुबह 08:00 बजे'}` 
                          : `Scheduled Drop: ${isJanMat ? '08:00 PM' : '08:00 AM'}`}
                      </span>
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
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '2px 4px' }}>
          {lang === 'EN' ? 'Daily Drop Rhythm' : 'दैनिक मतदान समय'}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', marginBottom: '8px' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {lang === 'HI' ? 'आगामी निर्धारित ड्रॉप्स' : 'Upcoming Scheduled Drops'} ({scheduledQueueList.length})
        </div>
        <button
          type="button"
          onClick={() => setScheduleViewMode('CALENDAR')}
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
      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
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
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

        {/* SECTION 1: GENUINE UPCOMING SCHEDULED DROPS */}
      <div style={{ marginTop: '16px', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0' }}>
          {lang === 'HI' 
            ? `आगामी निर्धारित प्रश्न (${scheduledQueueList.length})` 
            : `Upcoming Scheduled Drops (${scheduledQueueList.length})`}
        </h3>

        {scheduledQueueList.length === 0 ? (
          <div style={{ backgroundColor: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '16px', padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
            {lang === 'HI' ? 'वर्तमान में कोई नया प्रश्न निर्धारित नहीं है।' : 'No upcoming drops currently in queue.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {scheduledQueueList.map((poll) => {
              // Existing card render code for upcoming polls
              return (
                <div key={poll.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: poll.category === 'JanMat' ? '#059669' : '#d97706', backgroundColor: poll.category === 'JanMat' ? '#ecfdf5' : '#fffbeb', padding: '2px 8px', borderRadius: '6px' }}>
                      • {poll.category}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '6px' }}>
                      🔒 {poll.next_starts_at ? new Date(poll.next_starts_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Scheduled'}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
                    {lang === 'HI' ? poll.title_hi : poll.title_en}
                  </h4>
                  <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0 }}>
                    {lang === 'HI' ? poll.title_en : poll.title_hi}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: CONCLUDED AUDITS & HISTORICAL CONSENSUS ARCHIVE */}
      {archivedPollsList.length > 0 && (
        <div style={{ marginTop: '24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
              {lang === 'HI' 
                ? `सील किए गए जनमत परिणाम (${archivedPollsList.length})` 
                : `Concluded Consensus Archive (${archivedPollsList.length})`}
            </h3>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
              {lang === 'HI' ? 'अंतिम प्रमाणित आंकड़े' : 'Final Certified Results'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {archivedPollsList.map((poll) => {
              const hasVoted = votedCycleKeys.some((k) => k.startsWith(`${poll.id}___`));
              return (
                <div
                  key={poll.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '16px',
                    padding: '14px 16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#475569', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                      • {poll.category} (Archived)
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#dc2626', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: '6px' }}>
                      🔒 Concluded
                    </span>
                  </div>

                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
                    {lang === 'HI' ? poll.title_hi : poll.title_en}
                  </h4>
                  <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 10px 0' }}>
                    {lang === 'HI' ? poll.title_en : poll.title_hi}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: '8px' }}>
                    <span style={{ fontSize: '10.5px', color: hasVoted ? '#059669' : '#64748b', fontWeight: 700 }}>
                      {hasVoted ? (lang === 'HI' ? '✓ आपका मत दर्ज है' : '✓ Ballot Cast') : (lang === 'HI' ? 'सत्र समाप्त' : 'Window Closed')}
                    </span>
                    <button
                      type="button"
                      onClick={() => openExpandedView(poll)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#0f172a',
                        cursor: 'pointer'
                      }}
                    >
                      {lang === 'HI' ? 'प्रमाणित परिणाम देखें ↗' : 'View Certified Results ↗'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scheduled Drops List */}
      {scheduledQueueList.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
          {lang === 'EN'
            ? '✓ All scheduled drops for this cycle are live in your Vote feed.'
            : '✓ इस चक्र के सभी निर्धारित प्रश्न आपके वोट फीड में सक्रिय हैं।'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {scheduledQueueList
            .filter((item) => scheduleCategoryFilter === 'ALL' || item.category === scheduleCategoryFilter)
            .sort((a, b) => new Date(a.starts_at || 0).getTime() - new Date(b.starts_at || 0).getTime())
            .map((item) => {
              const sched = evaluatePollSchedule(item);
              const isItemJanMat = item.category === 'JanMat';
              return (
                <div key={item.id} style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: isItemJanMat ? '#059669' : '#d97706',
                      backgroundColor: isItemJanMat ? '#ecfdf5' : '#fffbeb',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      border: `1px solid ${isItemJanMat ? '#a7f3d0' : '#fde68a'}`
                    }}>
                      ● {item.category}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', backgroundColor: '#f0f9ff', padding: '2px 8px', borderRadius: '6px' }}>
                      🔒 {sched.nextUnlockLabel ? sched.nextUnlockLabel.replace(/\s20\d{2},?/, '') : (lang === 'HI' ? 'निर्धारित' : 'Scheduled')}
                    </span>
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#334155', lineHeight: 1.35 }}>
                    {lang === 'EN' ? item.title_en : item.title_hi}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>
                    {lang === 'EN' ? item.title_hi : item.title_en}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}