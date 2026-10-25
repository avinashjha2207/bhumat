'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, safeStorage } from './utils/supabaseClient';
import { getCurrentCycleId } from './utils/cycleManager';

const SEAT_CHANGE_COST_DBG = 1;

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

interface ProfileTabProps {
  lang: 'EN' | 'HI';
  deviceHash: string;
  username: string;
  setUsername: (name: string) => void;
  isEditingUsername: boolean;
  setIsEditingUsername: (editing: boolean) => void;
  usernameInput: string;
  setUsernameInput: (input: string) => void;
  selectedSeat: { name: string; state: string } | null;
  linkedPhone: string | null;
  linkedEmail: string | null;
  dbgPoints: number;
  setDbgPoints: React.Dispatch<React.SetStateAction<number>>;
  displayMonthlyVotes: number;
  recognitionTier: { title: string; color: string; level: number };
  polls: Poll[];
  sessionBallotChoices: Record<string, number>;
  cachedTalliesByPoll: Record<string, any[]>;
  setShowSponsorModal: (show: boolean) => void;
  showPointerToast: (msg: string, e?: React.MouseEvent | React.TouchEvent) => void;
  fetchLedger: (token: string) => Promise<void>;
  ledgerEntries: any[];
  isLedgerOpen: boolean;
  setIsLedgerOpen: (open: boolean) => void;
  referralCode: string;
  votingSinceDate: string;
  formatVotingSince: (dateStr?: string, lang?: 'EN' | 'HI') => string;
  totalVotesCount: number;
  lokmatPollsCount: number;
  janmatAuditsCount: number;
  setTentativeSeat: (seat: { name: string; state: string } | null) => void;
  setSeatSearchInput: (input: string) => void;
  setIsChangeSeatModalOpen: (open: boolean) => void;
  syncWallet: (token: string) => Promise<void>;
}

function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 10) return phone;
  const last10 = clean.slice(-10);
  return `+91 ***** **${last10.slice(-3)}`;
}

function maskEmailAddress(email?: string | null): string {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 3) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 3)}****${local.slice(-3)}@${domain}`;
}

export default function ProfileTab({
  lang,
  deviceHash,
  username,
  setUsername,
  isEditingUsername,
  setIsEditingUsername,
  usernameInput,
  setUsernameInput,
  selectedSeat,
  linkedPhone,
  linkedEmail,
  dbgPoints,
  setDbgPoints,
  displayMonthlyVotes,
  recognitionTier,
  polls,
  sessionBallotChoices,
  cachedTalliesByPoll,
  setShowSponsorModal,
  showPointerToast,
  fetchLedger,
  ledgerEntries,
  isLedgerOpen,
  setIsLedgerOpen,
  referralCode,
  votingSinceDate,
  formatVotingSince,
  totalVotesCount,
  lokmatPollsCount,
  janmatAuditsCount,
  setTentativeSeat,
  setSeatSearchInput,
  setIsChangeSeatModalOpen,
  syncWallet
}: ProfileTabProps) {
  const router = useRouter();
  const now = new Date();
  const activeMonthLabel = now.toLocaleString(lang === 'HI' ? 'hi-IN' : 'en-US', { month: 'long' });
  const seasonNumber = now.getMonth() + 1;
  const storedStreak = safeStorage.getItem('bhumat_daily_streak') || '1';
  const streakDays = Math.max(1, parseInt(storedStreak, 10));

  // Distinct LokMat Stance Visibility Toggle
  const [showLokMatStances, setShowLokMatStances] = useState<boolean>(() => {
    return safeStorage.getItem('bhumat_show_lokmat_stances') !== 'false';
  });

  const handleToggleLokMatStances = async () => {
    const nextVal = !showLokMatStances;
    setShowLokMatStances(nextVal);
    safeStorage.setItem('bhumat_show_lokmat_stances', String(nextVal));

    if (deviceHash) {
      await supabase
        .from('nagrik_profiles')
        .update({ is_public_profile: nextVal })
        .or(`voter_token.eq.${deviceHash},device_hash.eq.${deviceHash}`);
    }

    showPointerToast(
      nextVal
        ? (lang === 'HI' ? '✓ लोकमत सांस्कृतिक मत सार्वजनिक प्रोफ़ाइल पर दृश्यमान हैं' : '✓ LokMat cultural stances visible on public profile')
        : (lang === 'HI' ? '🔒 लोकमत मत सार्वजनिक प्रोफ़ाइल पर छिपे हुए हैं' : '🔒 LokMat cultural stances hidden from public profile')
    );
  };

  const isVerified = Boolean(linkedPhone || linkedEmail);
  const effectiveTotal = Math.max(totalVotesCount, Object.keys(sessionBallotChoices).length);
  const effectiveLokMat = Math.max(lokmatPollsCount, Object.keys(sessionBallotChoices).length);

  return (
    <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
      
      {/* ============================================================== */}
      {/* ZONE 1: PUBLIC CITIZEN DOSSIER (WHAT OTHERS SEE)              */}
      {/* ============================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 900, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🪪 {lang === 'HI' ? 'सार्वजनिक नागरिक पहचान' : 'Public Citizen Dossier'}
          </span>
          <button
            onClick={() => router.push(`/citizen/${encodeURIComponent(username)}`)}
            style={{
              background: '#0284c7',
              border: 'none',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '5px 12px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
            }}
          >
            <span>{lang === 'HI' ? 'सार्वजनिक प्रोफ़ाइल देखें' : 'View Public Profile'}</span>
            <span>↗</span>
          </button>
        </div>

        {/* Dossier Hero Card */}
        <div style={{
          backgroundColor: '#0a1128',
          color: '#ffffff',
          borderRadius: '24px',
          padding: '20px',
          boxShadow: '0 8px 24px rgba(10, 17, 40, 0.35)',
          border: '1.5px solid #1e293b'
        }}>
          {/* Season Pill & Streak with Informative Tooltip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span
              onClick={(e) => showPointerToast(
                lang === 'HI'
                  ? `सत्र ${seasonNumber}: भूमत साल में 12 मासिक सत्रों में संचालित होता है। माह के अंत में अंतिम परिणाम दर्ज होते हैं।`
                  : `Season ${seasonNumber}: BhuMat operates in 12 monthly civic seasons per year. Rankings finalize at month-end.`,
                e
              )}
              style={{
                fontSize: '10px',
                fontWeight: 900,
                color: '#38bdf8',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '3px 8px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {lang === 'HI' ? `${activeMonthLabel.toUpperCase()} सत्र • ${now.getFullYear()}` : `${activeMonthLabel.toUpperCase()} SEASON • ${now.getFullYear()}`} ⓘ
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(251, 191, 36, 0.4)', padding: '3px 9px', borderRadius: '999px' }}>
              <span style={{ fontSize: '12px' }}>🔥</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#fbbf24' }}>
                {streakDays}-Day Streak
              </span>
            </div>
          </div>

          {/* Username & Avatar Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {isEditingUsername ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                  <input
                    type="text"
                    value={usernameInput}
                    maxLength={20}
                    placeholder="Unique username..."
                    onChange={(e) => setUsernameInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    style={{
                      padding: '4px 8px', borderRadius: '6px', border: '1px solid #38bdf8',
                      fontSize: '14px', fontWeight: 800, backgroundColor: '#1e293b', color: '#ffffff', outline: 'none'
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (!usernameInput.trim()) return;
                      const cleanName = usernameInput.trim();
                      const { data: existing } = await supabase
                        .from('nagrik_profiles')
                        .select('voter_token')
                        .eq('username', cleanName)
                        .neq('voter_token', deviceHash)
                        .maybeSingle();
                      if (existing) {
                        alert(lang === 'HI' ? 'यह यूजरनेम पहले से किसी अन्य नागरिक का है।' : 'This username is already taken. Please choose another.');
                        return;
                      }
                      await supabase.from('nagrik_profiles').update({ username: cleanName }).or(`voter_token.eq.${deviceHash},device_hash.eq.${deviceHash}`);
                      setUsername(cleanName);
                      safeStorage.setItem('bhumat_username', cleanName);
                      setIsEditingUsername(false);
                    }}
                    style={{ padding: '4px 8px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setIsEditingUsername(false)}
                    style={{ padding: '4px 8px', backgroundColor: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '22px', fontWeight: 900, margin: 0, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                    @{username}
                  </h2>
                  {isVerified && (
                    <span style={{ color: '#10b981', fontSize: '14px' }} title="Verified Citizen">🛡️</span>
                  )}
                  <button
                    onClick={() => {
                      setUsernameInput(username);
                      setIsEditingUsername(true);
                    }}
                    title="Edit Username"
                    style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}
                  >
                    ✏️
                  </button>
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>📍 {selectedSeat?.name || 'Unclaimed'} • {selectedSeat?.state || 'Bharat'}</span>
              </div>
            </div>

            {/* XP Score Badge with Explanatory Toaster */}
            <div
              onClick={(e) => showPointerToast(
                lang === 'HI'
                  ? 'XP गणना: लोकमत पर +10 XP, जनमत ऑडिट पर +20 XP, और 7-दिन की स्ट्रीक पर +30 XP। 100 XP पर जागरूक नागरिक पद प्राप्त होता है।'
                  : 'XP System: +10 XP per LokMat pulse, +20 XP per JanMat audit, and +30 XP per 7-day streak. Reach 100 XP to attain Jagruk Nagrik.',
                e
              )}
              style={{ textAlign: 'right', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#fbbf24' }}>
                {displayMonthlyVotes * 30} <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>XP ⓘ</span>
              </div>
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: recognitionTier.color }}>
                {recognitionTier.title}
              </span>
            </div>
          </div>

          {/* Civic Rank Progress Bar & Level Milestones */}
          <div style={{ marginTop: '14px', backgroundColor: '#1e293b', borderRadius: '14px', padding: '12px 14px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800 }}>
              <span style={{ color: '#cbd5e1' }}>
                {lang === 'HI' ? 'अगला नागरिक पद:' : 'Next Civic Rank:'}{' '}
                <strong style={{ color: '#38bdf8' }}>
                  {displayMonthlyVotes < 10 ? '🏛️ Jagruk Nagrik' : (displayMonthlyVotes < 25 ? '🛡️ Lok Prahari' : '⚖️ Rashtriya Nirdharak')}
                </strong>
              </span>
              <span style={{ color: '#fbbf24' }}>
                {displayMonthlyVotes} / {displayMonthlyVotes < 10 ? 10 : (displayMonthlyVotes < 25 ? 25 : 45)} {lang === 'HI' ? 'मत' : 'Ballots'}
              </span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#334155', borderRadius: '999px', marginTop: '8px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, Math.round((displayMonthlyVotes / (displayMonthlyVotes < 10 ? 10 : (displayMonthlyVotes < 25 ? 25 : 45))) * 100))}%`,
                height: '100%',
                backgroundColor: '#10b981',
                transition: 'width 0.4s ease'
              }} />
            </div>
            {/* Level Milestone Tags Restored */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
              <span
                onClick={(e) => showPointerToast(lang === 'HI' ? '10 मत: जागरूक नागरिक पद व प्रश्न प्रस्ताव अधिकार।' : '10 Ballots: Jagruk Nagrik rank unlocks question proposals.', e)}
                style={{ cursor: 'pointer' }}
              >
                🌱 10: Jagruk ⓘ
              </span>
              <span
                onClick={(e) => showPointerToast(lang === 'HI' ? '25 मत: लोक प्रहरी पद व विशेष कोरम बैज।' : '25 Ballots: Lok Prahari rank unlocks quorum mobilization.', e)}
                style={{ cursor: 'pointer' }}
              >
                🛡️ 25: Prahari ⓘ
              </span>
              <span
                onClick={(e) => showPointerToast(lang === 'HI' ? '45 मत: राष्ट्रीय निर्धारक पद व +1 DBG बोनस।' : '45 Ballots: Rashtriya Nirdharak rank awards +1 DBG bonus.', e)}
                style={{ cursor: 'pointer' }}
              >
                👑 45: +1 DBG ⓘ
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* PERMANENT CAQ: CONSENSUS ALIGNMENT QUOTIENT WITH 3 STAGES     */}
        {/* ============================================================== */}
        {(() => {
          let lokmatVotesCastCount = 0;
          let pcCaqEligible = 0;
          let pcCaqMatches = 0;
          let stateCaqEligible = 0;
          let stateCaqMatches = 0;
          let seatTotalVotesRecorded = 0;

          const userSeatNorm = selectedSeat?.name?.toLowerCase().trim() || '';
          const userStateNorm = selectedSeat?.state?.toLowerCase().trim() || '';

          polls.filter((p) => p.category === 'LokMat').forEach((lokmatPoll) => {
            const dynamicCycle = (lokmatPoll.participation_mode === 'recurring' && lokmatPoll.recurrence !== 'expiry')
              ? getCurrentCycleId(lokmatPoll.recurrence, lokmatPoll.starts_at)
              : (lokmatPoll.current_cycle || 'lifetime');
            const userChoice = sessionBallotChoices[`${lokmatPoll.id}___${dynamicCycle}`];

            if (typeof userChoice === 'number') {
              lokmatVotesCastCount++;
              const tallies = cachedTalliesByPoll[lokmatPoll.id] || [];

              // Constituency Match with dynamic winner resolution
              const userSeatTally = tallies.find((t) => 
                (t.pc_name && t.pc_name.toLowerCase().trim() === userSeatNorm) ||
                (t.constituency_name && t.constituency_name.toLowerCase().trim() === userSeatNorm)
              );

              if (userSeatTally) {
                const sVotes = Number(userSeatTally.total_ballots || userSeatTally.total_votes || 0);
                if (sVotes > seatTotalVotesRecorded) seatTotalVotesRecorded = sVotes;

                let highestVotes = -1;
                let winningIdx = 0;
                lokmatPoll.options.forEach((_, optIdx) => {
                  const votes = Number(userSeatTally[`opt_${optIdx}_count`] ?? userSeatTally[`opt_${optIdx}_votes`] ?? 0);
                  if (votes > highestVotes) {
                    highestVotes = votes;
                    winningIdx = optIdx;
                  }
                });

                pcCaqEligible++;
                if (winningIdx === userChoice) pcCaqMatches++;
              }

              // State Match with aggregation
              const stateTallies = tallies.filter((t) => 
                t.state_name && t.state_name.toLowerCase().trim() === userStateNorm
              );
              if (stateTallies.length > 0) {
                const stateVotesByOpt: number[] = [];
                stateTallies.forEach((t) => {
                  lokmatPoll.options.forEach((_, optIdx) => {
                    const optVotes = Number(t[`opt_${optIdx}_count`] ?? t[`opt_${optIdx}_votes`] ?? 0);
                    stateVotesByOpt[optIdx] = (stateVotesByOpt[optIdx] || 0) + optVotes;
                  });
                });
                stateCaqEligible++;
                const stateLeadingOptIdx = stateVotesByOpt.indexOf(Math.max(...stateVotesByOpt));
                if (stateLeadingOptIdx === userChoice) stateCaqMatches++;
              }
            }
          });

          // Stage 1: New user with under 5 votes
          const isUnder5 = lokmatVotesCastCount < 5;
          const pcScore = pcCaqEligible > 0 ? Math.round((pcCaqMatches / pcCaqEligible) * 100) : 100;
          const stateScore = stateCaqEligible > 0 ? Math.round((stateCaqMatches / stateCaqEligible) * 100) : 100;

          return (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '16px 18px',
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px' }}>{isUnder5 ? '🔒' : '👑'}</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                    {lang === 'HI' ? 'जनमत समानता स्कोर (CAQ)' : 'Consensus Alignment (CAQ)'}
                  </span>
                  <span
                    onClick={(e) => showPointerToast(
                      lang === 'HI'
                        ? 'CAQ मापता है कि आपकी सांस्कृतिक राय आपके संसदीय क्षेत्र और राज्य के बहुसंख्यक नागरिकों से कितनी मेल खाती है।'
                        : 'CAQ measures how often your cultural stances match the majority consensus in your constituency and state.',
                      e
                    )}
                    style={{ fontSize: '11px', color: '#0284c7', cursor: 'pointer' }}
                  >
                    ⓘ
                  </span>
                </div>
                <span style={{
                  fontSize: '11.5px',
                  fontWeight: 900,
                  color: isUnder5 ? '#0284c7' : '#059669',
                  backgroundColor: isUnder5 ? '#f0f9ff' : '#ecfdf5',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  {isUnder5 ? `${lokmatVotesCastCount} / 5 Pulses` : `${pcScore}% Match`}
                </span>
              </div>

              {/* STAGE 1: PROGRESS BAR TOWARDS 5 VOTES UNLOCK */}
              {isUnder5 ? (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(8, (lokmatVotesCastCount / 5) * 100))}%`, height: '100%', backgroundColor: '#0284c7', transition: 'width 0.4s ease' }} />
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', marginBottom: 0, lineHeight: 1.45 }}>
                    {lang === 'HI'
                      ? `🔒 CAQ स्कोर अनलॉक करने हेतु 5 लोकमत सांस्कृतिक प्रश्नों पर मतदान करें (${lokmatVotesCastCount}/5 पूर्ण)।`
                      : `🔒 Cast your vote on 5 cultural pulses to unlock your statistical consensus score (${lokmatVotesCastCount} of 5 completed).`}
                  </p>
                </div>
              ) : (
                /* STAGES 2 & 3: FULL DUAL PROGRESS BARS */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {/* Progress Bar: Constituency Alignment */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, marginBottom: '3px' }}>
                      <span style={{ color: '#334155' }}>📍 {selectedSeat?.name || 'Constituency'} Consensus</span>
                      <span style={{ color: '#059669', fontWeight: 900 }}>{pcScore}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${pcScore}%`, height: '100%', backgroundColor: '#059669', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>

                  {/* Progress Bar: State-Wide Alignment */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, marginBottom: '3px' }}>
                      <span style={{ color: '#334155' }}>🏛️ {selectedSeat?.state || 'State'} Consensus</span>
                      <span style={{ color: '#0284c7', fontWeight: 900 }}>{stateScore}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${stateScore}%`, height: '100%', backgroundColor: '#0284c7', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>

                  <p style={{ fontSize: '10px', color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.35 }}>
                    {lang === 'HI'
                      ? `आपकी राय ${selectedSeat?.name} के बहुसंख्यक जनमत से ${pcScore}% मेल खाती है। (गोपनीय जनमत ऑडिट इसमें शामिल नहीं हैं)।`
                      : `Your cultural stances align with ${selectedSeat?.name || 'your seat'} majority consensus ${pcScore}% of the time. (JanMat audits excluded).`}
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Public Stances & Participation Summary Card with SAFFRON LokMat Toggle */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1.5px solid #e2e8f0',
          padding: '16px 18px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              📊 {lang === 'HI' ? 'भागीदारी एवं राय इतिहास' : 'Participation & Stance History'}
            </span>
            {/* LOKMAT PUBLIC VISIBILITY TOGGLE BUTTON (SAFFRON THEMED) */}
            <button
              type="button"
              onClick={handleToggleLokMatStances}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                borderRadius: '8px',
                border: `1.5px solid ${showLokMatStances ? '#fde68a' : '#cbd5e1'}`,
                backgroundColor: showLokMatStances ? '#fffbeb' : '#f8fafc',
                color: showLokMatStances ? '#b45309' : '#64748b',
                fontSize: '10.5px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <span>{showLokMatStances ? '🌅 LokMat Stances: ON' : '🔒 LokMat Stances: OFF'}</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '10px 8px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                {lang === 'HI' ? 'कुल मत' : 'Total Ballots'}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                {effectiveTotal}
              </div>
            </div>
            <div style={{ backgroundColor: '#fffbeb', padding: '10px 8px', borderRadius: '12px', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '9.5px', color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>
                {lang === 'HI' ? 'लोकमत' : 'LokMat'}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#d97706', marginTop: '2px' }}>
                {effectiveLokMat}
              </div>
            </div>
            <div style={{ backgroundColor: '#ecfdf5', padding: '10px 8px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: '9.5px', color: '#065f46', fontWeight: 700, textTransform: 'uppercase' }}>
                {lang === 'HI' ? 'जनमत ऑडिट' : 'JanMat'}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                {janmatAuditsCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* ZONE 2: PRIVATE ACCOUNT & SETTINGS                             */}
      {/* ============================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 4px' }}>
          ⚙️ {lang === 'HI' ? 'खाता एवं निजी सेटिंग्स' : 'Account & Private Settings'}
        </span>

        {/* CITIZEN DBG REWARDS */}
        <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {lang === 'HI' ? 'नागरिक रिवॉर्ड अंक' : 'CITIZEN DBG REWARDS'}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#f59e0b', marginTop: '2px' }}>
                ⚡ {dbgPoints} DBG
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                onClick={() => setShowSponsorModal(true)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#ecfdf5',
                  border: '1.5px solid #a7f3d0',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#065f46',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>🎯</span>
                <span>{lang === 'HI' ? 'लोकल पोल होस्ट करें (50 DBG)' : 'Sponsor Poll (50 DBG)'}</span>
              </button>
              <button
                onClick={async () => {
                  if (dbgPoints < 10) {
                    showPointerToast(
                      lang === 'HI'
                      ? `नागरिक प्रश्न प्रस्तावित करने हेतु 10 DBG आवश्यक हैं। आपका शेष: ${dbgPoints} DBG` 
                      : `Proposing a public question to the governance editorial requires 10 DBG. Your balance: ${dbgPoints} DBG`);
                    return;
                  }
                  const topic = prompt(lang === 'HI' 
                    ? 'भूमत संपादकीय मंडल हेतु अपना प्रश्न दर्ज करें (शुल्क: 10 DBG):' 
                    : 'Submit your poll question to BhuMat (Fee: 10 DBG):');
                  if (topic && topic.trim()) {
                    const { data, error } = await supabase.rpc('propose_citizen_poll', {
                      p_voter_token: deviceHash,
                      p_category: 'JanMat',
                      p_title_en: topic.trim(),
                      p_title_hi: topic.trim(),
                      p_options: JSON.stringify([
                        { id: 0, text_en: 'Option 1', text_hi: 'विकल्प 1' },
                        { id: 1, text_en: 'Option 2', text_hi: 'विकल्प 2' }
                      ])
                    });
                    if (!error && data?.success) {
                      setDbgPoints(data.new_balance);
                      safeStorage.setItem('bhumat_dbg_balance', String(data.new_balance));
                      alert(lang === 'HI' ? '✓ आपका प्रस्ताव संपादकीय समीक्षा हेतु दर्ज कर लिया गया है।' : '✓ Proposal submitted to the sovereign editorial queue!');
                      fetchLedger(deviceHash);
                    } else {
                      alert(`Error: ${error?.message || data?.error}`);
                    }
                  }
                }}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>💡</span>
                <span>{lang === 'HI' ? 'संपादकीय सुझाव (10 DBG)' : 'Suggest Poll (10 DBG)'}</span>
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '14px', paddingTop: '10px' }}>
            <div 
              onClick={() => {
                const nextState = !isLedgerOpen;
                setIsLedgerOpen(nextState);
                if (nextState) fetchLedger(deviceHash);
              }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px' }}>📜</span>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569' }}>
                  {lang === 'EN' ? 'Audit Ledger & Receipts' : 'ऑडिट लेज़र एवं रसीदें'}
                </span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7' }}>
                {isLedgerOpen ? '▲' : '▼'}
              </span>
            </div>
            {isLedgerOpen && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                {ledgerEntries.length === 0 ? (
                  <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                    {lang === 'EN' ? 'No points activity recorded yet.' : 'अभी तक कोई अंक लेन-देन दर्ज नहीं है।'}
                  </div>
                ) : (
                  ledgerEntries.map((tx) => (
                    <div
                      key={tx.id || tx.created_at}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontSize: '11.5px', color: '#0f172a', fontWeight: 700 }}>
                          {tx.description}
                        </span>
                        <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                          {tx.created_at ? new Date(tx.created_at).toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 900,
                        color: tx.delta < 0 ? '#ef4444' : '#059669',
                        backgroundColor: tx.delta < 0 ? '#fef2f2' : '#ecfdf5',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        whiteSpace: 'nowrap'
                      }}>
                        {tx.delta > 0 ? `+${tx.delta}` : tx.delta} DBG
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ALL-INDIA LEADERBOARD LINK */}
        <div
          onClick={() => router.push('/leaderboard')}
          style={{
            backgroundColor: '#ffffff',
            border: '1.5px solid #cbd5e1',
            borderRadius: '20px',
            padding: '16px 18px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
              🏆
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>
                {lang === 'HI' ? 'अखिल भारतीय लीडरबोर्ड' : 'All-India Leaderboard'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {lang === 'HI' ? 'संसदीय क्षेत्र प्रगति, राज्य रैंकिंग और शीर्ष नागरिक' : 'Constituency Progress, State Ranks & Top Citizens'}
              </div>
            </div>
          </div>
          <span style={{ fontSize: '14px', color: '#0284c7', fontWeight: 900 }}>↗</span>
        </div>

        {/* INVITE CITIZENS */}
        <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>
              {lang === 'EN' ? 'INVITE CITIZENS TO BHUMAT' : 'नागरिकों को आमंत्रित करें'}
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#059669' }}>
              +2 DBG / {lang === 'EN' ? 'Verified Invite' : 'सत्यापित आमंत्रण'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7', letterSpacing: '0.08em' }}>{referralCode}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(referralCode);
                  alert(lang === 'EN' ? 'Referral code copied to clipboard!' : 'रेफरल कोड कॉपी हो गया!');
                }}
                style={{ padding: '7px 14px', backgroundColor: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
              >
                {lang === 'EN' ? 'Copy' : 'कॉपी'}
              </button>
              <button
                onClick={() => {
                  const msg = lang === 'EN'
                    ? `🇮🇳 Join me on BhuMat - Bharat's Spatial Public Opinion Grid! Use my code *${referralCode}* to claim 1 DBG credit:\nhttps://vote.bhumat.com?ref=${referralCode}`
                    : `🇮🇳 भूमत से जुड़ें - भारत का संप्रभु जनमत ग्रिड! 1 DBG क्रेडिट पाने हेतु मेरा कोड *${referralCode}* उपयोग करें:\nhttps://vote.bhumat.com?ref=${referralCode}`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                style={{ padding: '7px 14px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
              >
                {lang === 'EN' ? 'Share' : 'शेयर'}
              </button>
            </div>
          </div>
        </div>

        {/* SECURITY & CITIZEN PASSPORT SETTINGS */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', border: '1.5px solid #e2e8f0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#64748b' }}>{lang === 'EN' ? 'Active Constituency:' : 'सक्रिय संसदीय क्षेत्र:'}</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{selectedSeat?.name || (lang === 'EN' ? 'Unclaimed' : 'अचयनित')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#64748b' }}>{lang === 'EN' ? 'State Jurisdiction:' : 'राज्य क्षेत्राधिकार:'}</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{selectedSeat?.state || 'Bharat'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#64748b' }}>{lang === 'EN' ? 'Voting Since:' : 'मतदान प्रारंभ:'}</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatVotingSince(votingSinceDate, lang)}</span>
          </div>

          {/* Masked Credentials Strip */}
          <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#64748b' }}>📱 {lang === 'HI' ? 'सत्यापित मोबाइल:' : 'Linked Mobile:'}</span>
              <span style={{ fontWeight: 800, color: linkedPhone ? '#0284c7' : '#94a3b8' }}>
                {linkedPhone ? maskPhoneNumber(linkedPhone) : (lang === 'HI' ? 'अतिथि (असत्यापित)' : 'Guest (Unverified)')}
              </span>
            </div>
            {linkedEmail && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#64748b' }}>✉️ {lang === 'HI' ? 'सत्यापित ईमेल:' : 'Linked Email:'}</span>
                <span style={{ fontWeight: 800, color: '#475569' }}>{maskEmailAddress(linkedEmail)}</span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setTentativeSeat(null);
              setSeatSearchInput('');
              setIsChangeSeatModalOpen(true);
            }}
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '12px',
              borderRadius: '12px',
              border: '1.5px solid #0284c7',
              backgroundColor: '#f0f9ff',
              color: '#0369a1',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            🔄 {lang === 'EN' ? `Shift Seat (${SEAT_CHANGE_COST_DBG} DBG)` : `संसदीय सीट बदलें (${SEAT_CHANGE_COST_DBG} DBG)`}
          </button>

          <button
            onClick={() => {
              if (confirm(lang === 'HI' ? 'क्या आप इस डिवाइस का डेटा रीसेट और लॉग आउट करना चाहते हैं?' : 'Reset local ballot cache and log out of this citizen passport?')) {
                safeStorage.removeItem('bhumat_user_phone');
                safeStorage.removeItem('bhumat_user_email');
                safeStorage.removeItem('bhumat_voter_token');
                safeStorage.removeItem('bhumat_username');
                safeStorage.removeItem('bhumat_voted_cycles');
                safeStorage.removeItem('bhumat_voted_polls');
                safeStorage.removeItem('bhumat_vote_timestamps');
                safeStorage.removeItem('bhumat_guest_vote_count');
                safeStorage.removeItem('bhumat_dbg_balance');
                safeStorage.removeItem('bhumat_user_seat');
                safeStorage.removeItem('bhumat_user_state');
                safeStorage.removeItem('bhumat_seen_onboarding_guide');
                safeStorage.removeItem('bhumat_show_lokmat_stances');
                if (typeof document !== 'undefined') {
                  document.cookie = 'bhumat_voter_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                }
                window.location.href = '/';
              }
            }}
            style={{
              alignSelf: 'center',
              marginTop: '4px',
              padding: '6px 14px',
              backgroundColor: 'transparent',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>⏻</span>
            <span>{lang === 'HI' ? 'डेटा रीसेट एवं लॉग आउट' : 'Reset Session & Log Out'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}