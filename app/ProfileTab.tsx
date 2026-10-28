'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, safeStorage } from './utils/supabaseClient';
import SuggestPollModal from './SuggestPollModal';
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
  voteTimestamps?: Record<string, string>;
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
  triggerInfoPopup?: (title: string, desc: string, e: React.MouseEvent) => void;
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
  voteTimestamps = {},
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
  syncWallet,
  triggerInfoPopup
}: ProfileTabProps) {
  const router = useRouter();
  const handleInfo = (title: string, desc: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (triggerInfoPopup) {
      triggerInfoPopup(title, desc, e);
    } else {
      showPointerToast(`${title}: ${desc}`);
    }
  };
  const now = new Date();
  const activeMonthLabel = now.toLocaleString(lang === 'HI' ? 'hi-IN' : 'en-US', { month: 'long' });
  const seasonNumber = now.getMonth() + 1;
  const storedStreak = safeStorage.getItem('bhumat_daily_streak') || '1';
  const streakDays = Math.max(1, parseInt(storedStreak, 10));
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [localLedger, setLocalLedger] = useState<any[]>([]);

  const loadLedgerDirectly = async () => {
    try {
      const activeToken = safeStorage.getItem('bhumat_voter_token') || safeStorage.getItem('bhumat_device_hash') || deviceHash;
      const email = safeStorage.getItem('bhumat_user_email') || linkedEmail || null;
      const phone = safeStorage.getItem('bhumat_user_phone') || linkedPhone || null;

      const { data, error } = await supabase.rpc('get_citizen_wallet_and_ledger', {
        p_voter_token: activeToken || 'bn_guest_fallback',
        p_email: email,
        p_phone: phone
      });

      if (!error && data?.success) {
        if (data.canonical_token && data.canonical_token !== activeToken) {
          safeStorage.setItem('bhumat_voter_token', data.canonical_token);
        }
        if (typeof data.balance === 'number' && setDbgPoints) {
          setDbgPoints(data.balance);
          safeStorage.setItem('bhumat_dbg_balance', String(data.balance));
        }
        if (Array.isArray(data.ledger)) {
          setLocalLedger(data.ledger);
        }
      }
    } catch (e) {
      console.warn('Unified ledger fetch error:', e);
    }
  };

  React.useEffect(() => {
    loadLedgerDirectly();
  }, [deviceHash, linkedPhone, linkedEmail, isLedgerOpen]);

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

  // Derive counts from actual voted poll records to eliminate arithmetic drift
  const votedPollIds = new Set(
    Object.keys(sessionBallotChoices)
      .map((k) => k.split('___')[0])
      .concat(Object.keys(voteTimestamps).map((k) => k.split('___')[0]))
  );

  const realLokMatVotes = polls.filter(
    (p) => (p.category || '').toLowerCase() === 'lokmat' && votedPollIds.has(p.id)
  ).length;

  const realJanMatVotes = polls.filter(
    (p) => (p.category || '').toLowerCase() === 'janmat' && votedPollIds.has(p.id)
  ).length;

  const effectiveLokMat = Math.max(lokmatPollsCount, realLokMatVotes);
  const effectiveJanMat = Math.max(janmatAuditsCount, realJanMatVotes);
  const effectiveTotal = effectiveLokMat + effectiveJanMat;

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
              onClick={(e) => handleInfo(
                lang === 'HI' ? `मासिक सत्र ${seasonNumber}` : `Monthly Season ${seasonNumber}`,
                lang === 'HI'
                  ? 'भूमत साल में 12 मासिक चक्रों में चलता है। हर महीने के अंत में सभी संसदीय क्षेत्रों के परिणाम सील होते हैं और नए चक्र की शुरुआत होती है।'
                  : 'BhuMat operates in 12 monthly civic seasons per year. Rankings lock at month-end, and a fresh cycle begins on the 1st.',
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
            {/* Clean Streak Badge with Plain-Language Explainer */}
            <div
              onClick={(e) => handleInfo(
                lang === 'HI' ? 'दैनिक स्ट्रीक एवं रिवॉर्ड' : 'Daily Streak & DBG Rewards',
                lang === 'HI'
                  ? '🔥 स्ट्रीक नियम:\n• रोज़ सुबह (8 AM) लोकमत या शाम (8 PM) जनमत में कम से कम एक मत दें।\n• लगातार 7 दिन मतदान करने पर +1 DBG क्रेडिट और +30 XP बोनस प्राप्त होता है।\n• प्रतिदिन भागीदारी से आपके संसदीय क्षेत्र का कोरम सुदृढ़ होता है।'
                  : '🔥 Streak Rules:\n• Vote daily in 08:00 AM LokMat or 08:00 PM JanMat.\n• Complete a 7-day streak to earn +1 DBG credit and +30 XP bonus.\n• Consistent daily votes strengthen your district’s consensus quorum.',
                e
              )}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(251, 191, 36, 0.4)',
                padding: '3px 10px',
                borderRadius: '999px',
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: '12px' }}>🔥</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#fbbf24' }}>
                {streakDays}-Day Streak
              </span>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>ⓘ</span>
            </div>
          </div>

          {/* Username & Avatar Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {isEditingUsername ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                        if (cleanName === username) {
                          setIsEditingUsername(false);
                          return;
                        }

                        // 1 DBG economic fee check
                        if (dbgPoints < 1) {
                          showPointerToast(
                            lang === 'HI'
                              ? 'नाम बदलने के लिए 1 DBG आवश्यक है। आपका शेष: 0 DBG'
                              : '1 DBG required to change username. Insufficient balance.'
                          );
                          return;
                        }

                        // Check uniqueness
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

                        // Atomic deduction and ledger record via PostgreSQL RPC
                        const canonicalToken = safeStorage.getItem('bhumat_voter_token') || safeStorage.getItem('bhumat_device_hash') || deviceHash;

                        const { data: burnRes, error: burnErr } = await supabase.rpc('burn_dbg_credit', {
                          p_voter_token: canonicalToken,
                          p_cost: 1,
                          p_tx_type: 'USERNAME_CHANGE_FEE',
                          p_description: `Username changed to @${cleanName}`
                        });

                        if (burnErr || (burnRes && !burnRes.success)) {
                          showPointerToast(lang === 'HI' ? 'अंक कटौती विफल रही।' : 'Failed to deduct DBG balance.');
                          return;
                        }

                        const nextDbg = burnRes.new_balance;
                        await supabase
                          .from('nagrik_profiles')
                          .update({ username: cleanName, updated_at: new Date().toISOString() })
                          .or(`voter_token.eq.${canonicalToken},device_hash.eq.${canonicalToken}`);

                        setUsername(cleanName);
                        setDbgPoints(nextDbg);
                        safeStorage.setItem('bhumat_username', cleanName);
                        safeStorage.setItem('bhumat_dbg_balance', String(nextDbg));
                        setIsEditingUsername(false);
                        showPointerToast(
                          lang === 'HI' 
                            ? `✓ नाम बदलकर @${cleanName} कर दिया गया (-1 DBG)` 
                            : `✓ Username updated to @${cleanName} (-1 DBG)`
                        );
                        loadLedgerDirectly();
                        if (typeof fetchLedger === 'function') {
                          fetchLedger(canonicalToken);
                        }
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
                  <span style={{ fontSize: '10px', color: '#fde68a', fontWeight: 700 }}>
                    ⚡ {lang === 'HI' ? 'नाम बदलने का शुल्क: 1 DBG' : 'Fee: 1 DBG to save new handle'}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1 }}>
                @{username}
              </h2>
              <span style={{ fontSize: '14px', lineHeight: 1 }}>🛡️</span>
              <button
                type="button"
                onClick={() => {
                  setUsernameInput(username);
                  setIsEditingUsername(true);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  padding: '3px 6px',
                  color: '#ffffff',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1
                }}
                title={lang === 'HI' ? 'नाम बदलें (1 DBG)' : 'Edit Username (1 DBG)'}
              >
                ✏️
              </button>
            </div>
              )}
              </div>

            {/* XP Score Badge (Right Aligned) */}
            <div
              onClick={(e) => handleInfo(
                lang === 'HI' ? 'नागरिक XP प्रणाली' : 'Civic XP System',
                lang === 'HI'
                  ? 'XP गणना:\n• लोकमत मत: +10 XP\n• जनमत ऑडिट: +20 XP\n• 7-दिन की निरंतर स्ट्रीक: +30 XP\nXP बढ़ने से आपका नागरिक पद और क्षेत्र में प्रतिष्ठा बढ़ती है।'
                  : 'XP Rewards:\n• LokMat cultural pulse: +10 XP\n• JanMat governance audit: +20 XP\n• 7-day voting streak: +30 XP\nEarn XP to elevate your civic rank and constituency standing.',
                e
              )}
              style={{ textAlign: 'right', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>
                {displayMonthlyVotes * 30} <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>XP ⓘ</span>
              </div>
            </div>
          </div>

          {/* Sub-Row: Location on Left, Civic Rank Badge on Right */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: '1px dashed rgba(255, 255, 255, 0.12)'
          }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>📍 {selectedSeat?.name || 'Unclaimed'} • {selectedSeat?.state || 'Bharat'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {(() => {
                const pCount = parseInt(safeStorage.getItem('bhumat_pioneer_count') || '0', 10);
                if (pCount <= 0 && safeStorage.getItem('bhumat_is_pioneer_voter') !== 'true') return null;
                const displayCount = Math.max(1, pCount);
                return (
                  <span
                    onClick={(e) => handleInfo(
                      lang === 'HI' ? `प्रथम 10 नागरिक (${displayCount}×)` : `Pratham 10 Nagrik (${displayCount}×)`,
                      lang === 'HI'
                        ? `🏛️ यह सम्मान उन नागरिकों को दिया जाता है जिन्होंने अपने संसदीय क्षेत्र में शुरुआती 10 मतों में सहभागिता की है। आपने ${displayCount} प्रश्नों पर यह उपलब्धि हासिल की है! (+25 XP बोनस प्राप्त)`
                        : `🏛️ Awarded to founding citizens who cast one of the first 10 ballots in their parliamentary constituency. You achieved this across ${displayCount} polls! (+25 XP Bonus each).`,
                      e
                    )}
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 800,
                      color: '#fbbf24',
                      backgroundColor: 'rgba(251, 191, 36, 0.12)',
                      border: '1px solid rgba(251, 191, 36, 0.4)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    🏛️ Pioneer{displayCount > 1 ? ` (${displayCount}×)` : ''}
                  </span>
                );
              })()}
              <span style={{ fontSize: '11px', fontWeight: 800, color: recognitionTier.color }}>
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
            {/* Transparent Gamification Ladder (XP Ranks vs DBG Bonus) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
              <span
                onClick={(e) => handleInfo(
                  lang === 'HI' ? 'जागरूक नागरिक (10 मत)' : 'Jagruk Nagrik (Level 2)',
                  lang === 'HI' 
                    ? '🌱 पदोन्नति (10 मत):\nआप जागरूक नागरिक बनते हैं और नए प्रश्न प्रस्तावित (Suggest Poll) करने का नागरिक अधिकार पाते हैं।' 
                    : '🌱 Level 2 (10 Votes):\nUnlock Jagruk Nagrik standing and the right to suggest questions to the national review queue.',
                  e
                )}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                <span>🌱 10: Jagruk</span>
                <span style={{ fontSize: '8.5px', color: '#38bdf8' }}>ⓘ</span>
              </span>
              <span
                onClick={(e) => handleInfo(
                  lang === 'HI' ? 'लोक प्रहरी (25 मत)' : 'Lok Prahari (Level 3)',
                  lang === 'HI' 
                    ? '🛡️ पदोन्नति (25 मत):\nआप लोक प्रहरी बनते हैं और ऑल-इंडिया लीडरबोर्ड पर आपका सत्यापित बैज (✓) चमकता है।' 
                    : '🛡️ Level 3 (25 Votes):\nAttain Lok Prahari status and display the verified citizen badge (✓) on the national leaderboard.',
                  e
                )}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                <span>🛡️ 25: Prahari</span>
                <span style={{ fontSize: '8.5px', color: '#38bdf8' }}>ⓘ</span>
              </span>
              <span
                onClick={(e) => handleInfo(
                  lang === 'HI' ? 'राष्ट्रीय निर्धारक (45 मत)' : 'Rashtriya Nirdharak (Level 4)',
                  lang === 'HI' 
                    ? '👑 सर्वोच्च पद (45 मत):\nइस मासिक सत्र में 45 मत पूरे करने पर आपको +1 DBG बोनस और विशेष नागरिक सम्मान मिलता है।' 
                    : '👑 Capstone Rank (45 Ballots):\nReach 45 votes in a monthly season to earn an instant +1 DBG bonus and highest civic standing.',
                  e
                )}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', color: '#fbbf24' }}
              >
                <span>👑 45: +1 DBG</span>
                <span style={{ fontSize: '8.5px', color: '#38bdf8' }}>ⓘ</span>
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

          polls.filter((p) => (p.category || '').toLowerCase() === 'lokmat').forEach((lokmatPoll) => {
            // Check if voted in any cycle
            const choiceEntry = Object.entries(sessionBallotChoices).find(([k]) => k.startsWith(`${lokmatPoll.id}___`));
            const userChoice = choiceEntry ? choiceEntry[1] : undefined;

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px' }}>{isUnder5 ? '🔒' : '👑'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                      {lang === 'HI' ? 'लोकमत सांस्कृतिक समानता' : 'LokMat Cultural Alignment'}
                </span>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                  padding: '2px 6px',
                  borderRadius: '5px',
                  lineHeight: 1
                }}>
                  {lang === 'HI' ? 'जनमत पृथक' : 'JanMat Excluded'}
                </span>
              </div>
                  <span
                    onClick={(e) => handleInfo(
                      lang === 'HI' ? 'लोकमत सांस्कृतिक समानता (LCA)' : 'LokMat Cultural Alignment (LCA)',
                      lang === 'HI'
                        ? 'यह मापता है कि आपकी सांस्कृतिक राय आपके संसदीय क्षेत्र और राज्य के बहुसंख्यक नागरिकों से कितनी मेल खाती है।\n(नोट: गोपनीय जनमत ऑडिट इसमें शामिल नहीं होते)।'
                        : 'Measures how often your cultural opinions match the majority consensus in your Lok Sabha seat and state.\n(Note: Secret JanMat audits are strictly excluded).',
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
              📊 {lang === 'HI' ? 'सहभागिता इतिहास' : 'PARTICIPATION HISTORY'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
            {/* Box 1: LokMat */}
            <div style={{ backgroundColor: '#fffbeb', padding: '10px 8px', borderRadius: '12px', border: '1.5px solid #fde68a' }}>
              <div style={{ fontSize: '9.5px', color: '#92400e', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {lang === 'HI' ? '🌅 लोकमत' : '🌅 LokMat'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#d97706', marginTop: '2px' }}>
                {effectiveLokMat}
              </div>
            </div>

            {/* Box 2: JanMat */}
            <div style={{ backgroundColor: '#ecfdf5', padding: '10px 8px', borderRadius: '12px', border: '1.5px solid #a7f3d0' }}>
              <div style={{ fontSize: '9.5px', color: '#065f46', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {lang === 'HI' ? '🌆 जनमत' : '🌆 JanMat'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                {effectiveJanMat}
              </div>
            </div>

            {/* Box 3: Total Ballots */}
            <div style={{ backgroundColor: '#f8fafc', padding: '10px 8px', borderRadius: '12px', border: '1.5px solid #cbd5e1' }}>
              <div style={{ fontSize: '9.5px', color: '#334155', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {lang === 'HI' ? '📊 कुल मत' : '📊 Total'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                {effectiveTotal}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* PERSONAL ACTIVITY LOG: ALL MY VOTED POLLS (PAST & ACTIVE)      */}
        {/* ============================================================== */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1.5px solid #e2e8f0',
          padding: '16px 18px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              🗳️ {lang === 'HI' ? 'मेरे द्वारा दिए गए मत' : 'My Voted Polls & Audits'}
            </span>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
              {lang === 'HI' ? 'निजी संदर्भ हेतु' : 'Private Activity Record'}
            </span>
          </div>

          {(() => {
            // Read all polls that the user has voted on (from session choices or timestamps)
            const votedPollsList = polls.filter((p) => {
              return Object.keys(sessionBallotChoices).some((k) => k.startsWith(`${p.id}___`)) ||
                     Object.keys(voteTimestamps).some((k) => k.startsWith(`${p.id}___`));
            });

            if (votedPollsList.length === 0) {
              return (
                <div style={{
                  padding: '18px',
                  backgroundColor: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '12px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '11.5px',
                  lineHeight: 1.45
                }}>
                  {lang === 'HI'
                    ? 'आपने अभी तक किसी प्रश्न पर मतदान नहीं किया है।'
                    : 'No ballots cast yet. Vote in the feed to build your permanent civic record here.'}
                </div>
              );
            }

            return (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: '360px',
                overflowY: 'auto',
                paddingRight: '4px'
              }}>
                {votedPollsList.map((poll) => {
                  const isJanMat = poll.category === 'JanMat';
                  const choiceEntry = Object.entries(sessionBallotChoices).find(([k]) => k.startsWith(`${poll.id}___`));
                  const choiceIdx = choiceEntry ? choiceEntry[1] : undefined;
                  const chosenOpt = choiceIdx !== undefined ? poll.options[choiceIdx] : null;
                  const chosenText = chosenOpt ? (lang === 'HI' ? chosenOpt.text_hi : chosenOpt.text_en) : '';

                  // Retrieve recorded timestamp
                  const timestampEntry = Object.entries(voteTimestamps).find(([k]) => k.startsWith(`${poll.id}___`));
                  const rawIso = timestampEntry ? timestampEntry[1] : null;
                  const formattedDate = rawIso 
                    ? new Date(rawIso).toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })
                    : new Date().toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      });

                  return (
                    <div
                      key={poll.id}
                      style={{
                        backgroundColor: '#ffffff',
                        border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                        borderRadius: '14px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                      }}
                    >
                      {/* Top Header: Badge + Cadence Mode */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: isJanMat ? '#059669' : '#d97706',
                          backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb',
                          border: `1px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>{isJanMat ? '🌆' : '🌅'}</span>
                          <span>{poll.category}</span>
                        </span>

                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                          {poll.participation_mode === 'one_time' ? 'ONE_TIME' : (poll.recurrence?.toUpperCase() || 'MONTHLY')}
                        </span>
                      </div>

                      {/* Question Title */}
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', lineHeight: 1.35, marginTop: '2px' }}>
                        {lang === 'HI' ? poll.title_hi : poll.title_en}
                      </div>

                      {/* Stance Row */}
                      <div style={{
                        marginTop: '2px',
                        paddingTop: '6px',
                        borderTop: '1px dashed #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '4px'
                      }}>
                        {isJanMat ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11px' }}>🔒</span>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>
                              {lang === 'HI' ? 'संप्रभु गुप्त मत दर्ज ✓' : 'Sovereign Ballot Cast & Tally Sealed ✓'}
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                              {lang === 'HI' ? 'आपका मत:' : 'Your Stance:'}
                            </span>
                            <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#d97706' }}>
                              {chosenText || (lang === 'HI' ? 'दर्ज' : 'Recorded')}
                            </span>
                          </div>
                        )}

                        {/* Date & Anchored Seat */}
                        <div style={{ fontSize: '10.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>📅 {formattedDate}</span>
                          <span>•</span>
                          <span style={{ color: '#0284c7', fontWeight: 700 }}>📍 {selectedSeat?.name || 'Local Seat'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ============================================================== */}
      {/* ZONE 2: PRIVATE ACCOUNT & SETTINGS                             */}
      {/* ============================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 4px' }}>
          ⚙️ {lang === 'HI' ? 'खाता एवं निजी सेटिंग्स' : 'Account & Private Settings'}
        </span>

        {/* Stance Privacy Toggle */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '14px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px'
            }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                  🔒 {lang === 'HI' ? 'सांस्कृतिक विचार सार्वजनिक रखें' : 'Public LokMat Stances'}
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                  {lang === 'HI' 
                    ? 'सार्वजनिक प्रोफ़ाइल पर अपने लोकमत विचार दूसरों को दिखाएं।' 
                    : 'Show your cultural opinions on your public citizen dossier.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const current = safeStorage.getItem('bhumat_profile_private') === 'true';
                  safeStorage.setItem('bhumat_profile_private', (!current).toString());
                  showPointerToast(
                    !current 
                      ? (lang === 'HI' ? '🔒 प्रोफ़ाइल निजी की गई (विचार छिपे हैं)' : '🔒 Stance ledger set to Private') 
                      : (lang === 'HI' ? '🌐 प्रोफ़ाइल सार्वजनिक की गई' : '🌐 Stance ledger set to Public')
                  );
                  syncWallet(deviceHash);
                }}
                style={{
                  backgroundColor: safeStorage.getItem('bhumat_profile_private') === 'true' ? '#f1f5f9' : '#ecfdf5',
                  border: `1.5px solid ${safeStorage.getItem('bhumat_profile_private') === 'true' ? '#cbd5e1' : '#a7f3d0'}`,
                  color: safeStorage.getItem('bhumat_profile_private') === 'true' ? '#64748b' : '#059669',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {safeStorage.getItem('bhumat_profile_private') === 'true' ? 'OFF (Private)' : 'ON (Public)'}
              </button>
            </div>

        {/* CITIZEN DBG REWARDS */}
        <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div
                      onClick={(e) => handleInfo(
                        lang === 'HI' ? 'नागरिक क्रेडिट (DBG) क्या है?' : 'What is DBG Credit?',
                        lang === 'HI'
                          ? '⚡ DBG भूमत का उपयोगी नागरिक क्रेडिट है:\n• कैसे कमाएं: 7-दिन की स्ट्रीक (+1 DBG), 45 मत (+1 DBG), या मित्रों को आमंत्रित करके (+2 DBG)।\n• कहां खर्च करें: सीट बदलना (1 DBG), नाम बदलना (1 DBG), या प्रश्न सुझाना (5 DBG)।'
                          : '⚡ DBG is BhuMat’s civic utility credit:\n• How to earn: 7-day streak (+1 DBG), 45 seasonal votes (+1 DBG), or verified referrals (+2 DBG).\n• Where to spend: Shift constituency seat (1 DBG), edit handle (1 DBG), or suggest topics (5 DBG).',
                        e
                      )}
                      style={{ fontSize: '10.5px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      <span>{lang === 'HI' ? 'नागरिक क्रेडिट शेष' : 'CIVIC DBG CREDITS'}</span>
                      <span style={{ fontSize: '10px' }}>ⓘ</span>
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
                type="button"
                onClick={() => setShowSuggestModal(true)}
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
                <span>{lang === 'HI' ? 'संपादकीय सुझाव (5 DBG)' : 'Suggest Poll (5 DBG)'}</span>
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '14px', paddingTop: '10px' }}>
            <div 
           onClick={() => {
             const nextState = !isLedgerOpen;
             setIsLedgerOpen(nextState);
             if (nextState) {
               loadLedgerDirectly();
               const activeToken = safeStorage.getItem('bhumat_voter_token') || safeStorage.getItem('bhumat_device_hash') || deviceHash;
               if (typeof fetchLedger === 'function') fetchLedger(activeToken);
             }
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
                {(localLedger.length > 0 ? localLedger : ledgerEntries).length === 0 ? (
                  <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                    {lang === 'EN' ? 'No points activity recorded yet.' : 'अभी तक कोई अंक लेन-देन दर्ज नहीं है।'}
                  </div>
                ) : (
                  (localLedger.length > 0 ? localLedger : ledgerEntries).map((tx) => (
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

        {/* INVITE CITIZENS (Gated for Verified Citizens Only) */}
        <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>
              {lang === 'EN' ? 'INVITE CITIZENS TO BHUMAT' : 'नागरिकों को आमंत्रित करें'}
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#059669' }}>
              +2 DBG / {lang === 'EN' ? 'Verified Invite' : 'सत्यापित आमंत्रण'}
            </span>
          </div>

          {isVerified ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <span style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7', letterSpacing: '0.08em' }}>{referralCode || 'BM78491'}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(referralCode || 'BM78491');
                    alert(lang === 'EN' ? 'Referral code copied to clipboard!' : 'रेफरल कोड कॉपी हो गया!');
                  }}
                  style={{ padding: '7px 14px', backgroundColor: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
                >
                  {lang === 'EN' ? 'Copy' : 'कॉपी'}
                </button>
                <button
                  onClick={() => {
                    const code = referralCode || 'BM78491';
                    const msg = lang === 'EN'
                      ? `🇮🇳 Join me on BhuMat - Bharat's Spatial Public Opinion Grid! Use my code *${code}* to claim 1 DBG credit:\nhttps://vote.bhumat.com?ref=${code}`
                      : `🇮🇳 भूमत से जुड़ें - भारत का संप्रभु जनमत ग्रिड! 1 DBG क्रेडिट पाने हेतु मेरा कोड *${code}* उपयोग करें:\nhttps://vote.bhumat.com?ref=${code}`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                  style={{ padding: '7px 14px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
                >
                  {lang === 'EN' ? 'Share' : 'शेयर'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              marginTop: '10px',
              padding: '10px 12px',
              backgroundColor: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                {lang === 'HI'
                  ? '🔒 रेफरल कोड प्राप्त करने और +2 DBG कमाने हेतु मोबाइल सत्यापन पूर्ण करें।'
                  : '🔒 Verify your mobile to claim your unique referral code & earn +2 DBG per peer.'}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#0284c7', whiteSpace: 'nowrap' }}>
                {lang === 'HI' ? 'अतिथि मोड' : 'Guest Mode'}
              </span>
            </div>
          )}
        </div>

        {/* SECURITY & CITIZEN PASSPORT SETTINGS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span
              onClick={(e) => handleInfo(
                lang === 'HI' ? 'सक्रिय संसदीय क्षेत्र' : 'Active Constituency',
                lang === 'HI' 
                  ? 'आपकी लोकसभा सीट। आपके द्वारा दिए गए सभी मत इसी क्षेत्र के स्कोरबोर्ड और नक्शे में गिने जाते हैं।' 
                  : 'Your Lok Sabha constituency. All your votes are tallied into this regional scoreboard.',
                e
              )}
              style={{ color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <span>{lang === 'EN' ? 'Active Constituency:' : 'सक्रिय संसदीय क्षेत्र:'}</span>
              <span style={{ fontSize: '10px', color: '#0284c7' }}>ⓘ</span>
            </span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span
                onClick={(e) => handleInfo(
                  lang === 'HI' ? 'गोपनीयता व नागरिक सत्यापन' : 'Privacy Shield & Verification',
                  lang === 'HI' 
                    ? 'सत्यापन केवल फर्जी बॉट्स रोकने हेतु है। आपकी पहचान कभी भी आपके जनमत गुप्त मतों से नहीं जोड़ी जाती।' 
                    : 'One-time verification eliminates automated bots. Your identity is never linked to your confidential JanMat votes.',
                  e
                )}
                style={{ color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <span>{linkedPhone ? '📱' : (linkedEmail ? '✉️' : '👤')} {lang === 'HI' ? 'सत्यापित अकाउंट:' : 'Linked Account:'}</span>
                <span style={{ fontSize: '10px', color: '#0284c7' }}>ⓘ</span>
              </span>
              <span style={{ fontWeight: 800, color: (linkedPhone || linkedEmail) ? '#0284c7' : '#94a3b8' }}>
                {linkedPhone 
                  ? maskPhoneNumber(linkedPhone) 
                  : (linkedEmail 
                      ? maskEmailAddress(linkedEmail) 
                      : (lang === 'HI' ? 'अतिथि (असत्यापित)' : 'Guest (Unverified)'))}
              </span>
            </div>
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

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            {isVerified ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const confirmMsg = lang === 'HI' 
                      ? 'क्या आप इस फोन से अपना खाता हटाना चाहते हैं? दोबारा जुड़ने के लिए मोबाइल या ईमेल से प्रवेश करना होगा।'
                      : 'Log out from this device? You can log back in anytime with your phone or email.';
                    if (confirm(confirmMsg)) {
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
                    padding: '8px 16px',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #fecaca',
                    borderRadius: '10px',
                    color: '#dc2626',
                    fontSize: '11.5px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 3px rgba(220, 38, 38, 0.05)'
                  }}
                >
                  <span>⏻</span>
                  <span>{lang === 'HI' ? `लॉग आउट करें (@${username})` : `Log Out (@${username})`}</span>
                </button>
                <span style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
                  {lang === 'HI' 
                    ? 'यदि यह साझा या किसी अन्य का फोन है, तो सुरक्षित बाहर निकलें।'
                    : 'Safely clear data on shared or public phones.'}
                </span>
              </>
            ) : (
              <span style={{ fontSize: '10.5px', color: '#64748b', textAlign: 'center', padding: '6px 0' }}>
                {lang === 'HI'
                  ? '🌱 आप वर्तमान में अतिथि मोड में हैं। संपूर्ण नागरिक विशेषाधिकार हेतु सत्यापन करें।'
                  : '🌱 You are browsing in Guest Mode. Verify to claim permanent citizenship & rewards.'}
              </span>
            )}
          </div>
      </div>
      {/* Render the Suggest Poll Modal */}
      {showSuggestModal && (
        <SuggestPollModal
          voterToken={safeStorage.getItem('bhumat_voter_token') || safeStorage.getItem('bhumat_device_hash') || deviceHash}
          username={username}
          userState={selectedSeat?.state || 'Bihar'}
          userSeat={selectedSeat?.name || 'Constituency'}
          userDbgBalance={dbgPoints}
          lang={lang}
          onClose={() => setShowSuggestModal(false)}
          onSuccess={(newBalance) => {
            setDbgPoints(newBalance);
            safeStorage.setItem('bhumat_dbg_balance', String(newBalance));
            setShowSuggestModal(false);
            showPointerToast(
              lang === 'HI'
                ? '✓ आपका प्रश्न संपादकीय समीक्षा हेतु भेज दिया गया है (-5 DBG)'
                : '✓ Topic submitted to editorial review desk (-5 DBG)'
            );
            fetchLedger(deviceHash);
          }}
        />
      )}
    </div>
  );
}