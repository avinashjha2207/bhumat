'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, safeStorage } from '../utils/supabaseClient';

export default function DedicatedLeaderboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'SEATS' | 'STATES' | 'CITIZENS'>('SEATS');
  const [seatScope, setSeatScope] = useState<'ALL_INDIA' | 'MY_STATE'>('ALL_INDIA');
  
  const [seatsData, setSeatsData] = useState<any[]>([]);
  const [statesData, setStatesData] = useState<any[]>([]);
  const [citizenList, setCitizenList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [userState, setUserState] = useState<string>('Bihar');
  const [userSeat, setUserSeat] = useState<string>('Karakat');
  const [userRefCode, setUserRefCode] = useState<string>('BM78491');
  const [myRankData, setMyRankData] = useState<{ rank: number; xp: number; streak: number } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const s = safeStorage.getItem('bhumat_user_seat');
      const st = safeStorage.getItem('bhumat_user_state');
      const ref = safeStorage.getItem('bhumat_referral_code');
      if (s) setUserSeat(s);
      if (st) setUserState(st);
      if (ref) setUserRefCode(ref);
    }
  }, []);

  async function loadLeaderboardData() {
    setLoading(true);
    try {
      const { data: stats } = await supabase.rpc('get_leaderboard_spatial_stats');
      if (stats) {
        setSeatsData(stats.seats || []);
        setStatesData(stats.states || []);
      }

      const { data: citizens, error: citErr } = await supabase.rpc('get_leaderboard_citizen_hall_of_fame', {
        p_limit: 50
      });

      if (citizens && !citErr) {
        setCitizenList(citizens);
        const myStoredName = safeStorage.getItem('bhumat_username') || 'CitizenBharat';
        const foundIdx = citizens.findIndex((c: any) => c.username === myStoredName);
        if (foundIdx !== -1) {
          setMyRankData({
            rank: foundIdx + 1,
            xp: citizens[foundIdx].xp_score,
            streak: citizens[foundIdx].daily_streak
          });
        }
      }
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboardData();

    // Subscribe to realtime changes on constituency tallies and wallets
    const channel = supabase
      .channel('leaderboard_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'constituency_tallies' }, () => {
        loadLeaderboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voter_wallets' }, () => {
        loadLeaderboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const displayedSeats = useMemo(() => {
    if (seatScope === 'MY_STATE') {
      return seatsData.filter((s) => s.state_name.toLowerCase() === userState.toLowerCase());
    }
    return seatsData;
  }, [seatsData, seatScope, userState]);

  const handleMobilizeSeat = (seatName: string, rank: number, votesNeeded: number) => {
    const text = `🇮🇳 संसदीय क्षेत्र *${seatName}* भूमत पर #${rank} स्थान पर है!\n\n` +
      (votesNeeded > 0 
        ? `सिर्फ *${votesNeeded} मत* और चाहिए स्थानीय मत की पुष्टि (Consensus Unlock) के लिए।\n\n` 
        : `अपना मत देकर बढ़त बनाए रखें।\n\n`) +
      `यहाँ वोट करें: https://vote.bhumat.com?ref=${userRefCode}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', paddingBottom: '90px' }}>
      
      {/* Top Header */}
      <header style={{ height: '56px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px' }}>
        <div style={{ width: '100%', maxWidth: '480px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => router.push('/')}
            style={{ background: '#f1f5f9', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '6px 12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', color: '#0f172a' }}
          >
            ← Back Home
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px' }}>🏆</span>
            <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
              Bharat Civic League
            </span>
          </div>
          <button
            onClick={loadLeaderboardData}
            style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '16px', cursor: 'pointer' }}
            title="Refresh Live Data"
          >
            ↻
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '16px 14px' }}>
        
        {/* Civic Competition Banner */}
        <div style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '20px', padding: '18px 20px', marginBottom: '16px', boxShadow: '0 8px 20px rgba(15,23,42,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 900, backgroundColor: '#1e293b', color: '#38bdf8', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.04em' }}>
              SEASON 10 • OCTOBER 2026
            </span>
            <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 800 }}>
              🔥 Active Civic Race
            </span>
          </div>
          <h2 style={{ fontSize: '17px', fontWeight: 900, margin: '8px 0 4px 0' }}>
            Constituency Turf War
          </h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.45 }}>
            Every verified ballot pushes your parliamentary constituency up the national ranking.
          </p>
        </div>

        {/* 3-Pillar Switcher */}
        <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '14px', padding: '3px', marginBottom: '16px' }}>
          <button
            onClick={() => setActiveTab('SEATS')}
            style={{ flex: 1, padding: '9px 0', border: 'none', borderRadius: '11px', backgroundColor: activeTab === 'SEATS' ? '#0f172a' : 'transparent', color: activeTab === 'SEATS' ? '#ffffff' : '#475569', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
          >
            🗳️ Seats Turf War
          </button>
          <button
            onClick={() => setActiveTab('STATES')}
            style={{ flex: 1, padding: '9px 0', border: 'none', borderRadius: '11px', backgroundColor: activeTab === 'STATES' ? '#0f172a' : 'transparent', color: activeTab === 'STATES' ? '#ffffff' : '#475569', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
          >
            🏛️ State Cup
          </button>
          <button
            onClick={() => setActiveTab('CITIZENS')}
            style={{ flex: 1, padding: '9px 0', border: 'none', borderRadius: '11px', backgroundColor: activeTab === 'CITIZENS' ? '#0f172a' : 'transparent', color: activeTab === 'CITIZENS' ? '#ffffff' : '#475569', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
          >
            👑 Citizen Hall of Fame
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b', fontSize: '13px', fontWeight: 700 }}>
            Syncing sovereign consensus ledger...
          </div>
        ) : (
          <>
            {/* PILLAR 1: SEATS TURF WAR */}
            {activeTab === 'SEATS' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b' }}>
                    TOP BATTLEGROUNDS
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => setSeatScope('ALL_INDIA')}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: seatScope === 'ALL_INDIA' ? '#0284c7' : '#f1f5f9', color: seatScope === 'ALL_INDIA' ? '#ffffff' : '#475569', fontSize: '10.5px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      🇮🇳 All-Bharat
                    </button>
                    <button
                      onClick={() => setSeatScope('MY_STATE')}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: seatScope === 'MY_STATE' ? '#0284c7' : '#f1f5f9', color: seatScope === 'MY_STATE' ? '#ffffff' : '#475569', fontSize: '10.5px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      📍 {userState} Derby
                    </button>
                  </div>
                </div>

                {displayedSeats.map((item, idx) => {
                  const isFortified = item.total_votes >= 50;
                  const progress = Math.min(100, Math.round((item.total_votes / 50) * 100));
                  const isMySeat = item.constituency_name.toLowerCase() === userSeat.toLowerCase();

                  return (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: '#ffffff',
                        border: isMySeat ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        borderRadius: '16px',
                        padding: '14px 16px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 900, color: idx < 3 ? '#f59e0b' : '#64748b', width: '24px' }}>
                            #{idx + 1}
                          </span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '14.5px', fontWeight: 900, color: '#0f172a' }}>{item.constituency_name}</span>
                              {isMySeat && (
                                <span style={{ fontSize: '9px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px' }}>
                                  Your Home Seat
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {item.state_name}
                              {item.captain_name && item.captain_name !== 'None' && (
  <span
    onClick={() => router.push(`/citizen/${encodeURIComponent(item.captain_name)}`)}
    style={{ marginLeft: '6px', color: '#0284c7', fontWeight: 700, cursor: 'pointer' }}
    title={`View @${item.captain_name}'s Dossier`}
  >
    • 👑 @{item.captain_name} ↗
  </span>
)}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '14.5px', fontWeight: 900, color: '#0284c7' }}>
                            {item.total_votes} <span style={{ fontSize: '11px', color: '#64748b' }}>Ballots</span>
                          </span>
                          <div style={{ fontSize: '10.5px', fontWeight: 800, color: isFortified ? '#059669' : '#d97706', marginTop: '2px' }}>
                            {isFortified ? '🛡️ Consensus Unlocked' : `${progress}% to Unlock`}
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ width: '100%', height: '5px', backgroundColor: '#f1f5f9', borderRadius: '999px', marginTop: '10px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${progress}%`,
                            height: '100%',
                            backgroundColor: isFortified ? '#10b981' : '#f59e0b',
                            transition: 'width 0.5s ease'
                          }}
                        />
                      </div>

                      {/* Mobilize WhatsApp CTA */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                        <button
                          onClick={() => handleMobilizeSeat(item.constituency_name, idx + 1, item.votes_needed_to_fortify)}
                          style={{
                            backgroundColor: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            borderRadius: '8px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 800,
                            color: '#065f46',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>📢</span>
                          <span>Mobilize on WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* PILLAR 2: STATE CUP */}
            {activeTab === 'STATES' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {statesData.map((st, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '14px 16px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: idx < 3 ? '#059669' : '#64748b', width: '24px' }}>
                        #{idx + 1}
                      </span>
                      <div>
                        <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>{st.state_name}</span>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {st.active_seats_count} Active Parliamentary Districts
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '15px', fontWeight: 900, color: '#059669' }}>
                        {st.total_votes}
                      </span>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>Total Ballots</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PILLAR 3: CITIZEN HALL OF FAME */}
            {activeTab === 'CITIZENS' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Podium Top 3 with Direct Profile Navigation */}
                {citizenList.length >= 3 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr 1fr', gap: '8px', marginBottom: '8px', alignItems: 'flex-end' }}>
  {/* Rank 2 */}
  <div
    onClick={() => citizenList[1]?.username && router.push(`/citizen/${encodeURIComponent(citizenList[1].username)}`)}
    style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '12px 6px', textAlign: 'center', cursor: 'pointer' }}
  >
    <div style={{ fontSize: '20px' }}>🥈</div>
    <div style={{ fontSize: '12px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
      @{citizenList[1]?.username} ↗
    </div>
    <div style={{ fontSize: '11px', fontWeight: 900, color: '#64748b' }}>{citizenList[1]?.xp_score} XP</div>
  </div>

  {/* Rank 1 */}
  <div
    onClick={() => citizenList[0]?.username && router.push(`/citizen/${encodeURIComponent(citizenList[0].username)}`)}
    style={{ backgroundColor: '#ffffff', border: '2px solid #f59e0b', borderRadius: '18px', padding: '16px 6px', textAlign: 'center', boxShadow: '0 4px 12px rgba(245,158,11,0.1)', cursor: 'pointer' }}
  >
    <div style={{ fontSize: '24px' }}>👑</div>
    <div style={{ fontSize: '13px', fontWeight: 900, color: '#0284c7', marginTop: '4px' }}>
      @{citizenList[0]?.username} ↗
    </div>
    <div style={{ fontSize: '13px', fontWeight: 900, color: '#d97706' }}>{citizenList[0]?.xp_score} XP</div>
  </div>

  {/* Rank 3 */}
  <div
    onClick={() => citizenList[2]?.username && router.push(`/citizen/${encodeURIComponent(citizenList[2].username)}`)}
    style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '10px 6px', textAlign: 'center', cursor: 'pointer' }}
  >
    <div style={{ fontSize: '20px' }}>🥉</div>
    <div style={{ fontSize: '12px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
      @{citizenList[2]?.username} ↗
    </div>
    <div style={{ fontSize: '11px', fontWeight: 900, color: '#64748b' }}>{citizenList[2]?.xp_score} XP</div>
  </div>
</div>
                )}

                {/* Ranked List */}
                {citizenList.map((citizen, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 900, color: idx < 3 ? '#f59e0b' : '#64748b', width: '22px' }}>
                        #{idx + 1}
                      </span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
  onClick={() => router.push(`/citizen/${encodeURIComponent(citizen.username)}`)}
  style={{ fontSize: '13.5px', fontWeight: 800, color: '#0284c7', cursor: 'pointer' }}
>
  @{citizen.username} ↗
</span>
                          {citizen.is_verified && (
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', padding: '1px 5px', borderRadius: '4px' }}>
                              ✓ Verified
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>📍 {citizen.constituency_name}</span>
                          <span>•</span>
                          <span style={{ color: '#d97706', fontWeight: 700 }}>🔥 {citizen.daily_streak}d streak</span>
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 900, color: '#8b5cf6' }}>
                      {citizen.xp_score} <span style={{ fontSize: '10px', color: '#64748b' }}>XP</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Sticky Bottom Bar for Current User */}
      {myRankData && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 16px', display: 'flex', justifyContent: 'center', zIndex: 30, borderTop: '1px solid #1e293b' }}>
          <div style={{ width: '100%', maxWidth: '480px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🎯</span>
              <div>
                <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700 }}>Your Sovereign Standing</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8' }}>
                  Rank #{myRankData.rank} in Bharat ({userSeat})
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#fbbf24' }}>
                {myRankData.xp} XP
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                🔥 {myRankData.streak}-Day Streak
              </div>
            </div>
          </div>
        </div>
      )}

{/* 5-Tab Standard Navigation Dock */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '62px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          zIndex: 99,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          paddingBottom: 'env(safe-area-inset-bottom, 6px)',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.04)'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 4px',
            boxSizing: 'border-box'
          }}
        >
          <button
            type="button"
            onClick={() => router.push('/?tab=search')}
            style={{ flex: 1, background: 'none', border: 'none', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>🔍</span>
            <span style={{ fontSize: '10.5px', fontWeight: 600, marginTop: '4px' }}>Search</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/?tab=schedule')}
            style={{ flex: 1, background: 'none', border: 'none', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>📅</span>
            <span style={{ fontSize: '10.5px', fontWeight: 600, marginTop: '4px' }}>Schedule</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            style={{ flex: 1, background: 'none', border: 'none', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>🗳️</span>
            <span style={{ fontSize: '10.5px', fontWeight: 600, marginTop: '4px' }}>Vote</span>
          </button>
          <button
            type="button"
            style={{ flex: 1, background: 'none', border: 'none', color: '#0284c7', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1, transform: 'scale(1.08)' }}>🏆</span>
            <span style={{ fontSize: '10.5px', fontWeight: 900, marginTop: '4px' }}>Rankings</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/?tab=profile')}
            style={{ flex: 1, background: 'none', border: 'none', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>👤</span>
            <span style={{ fontSize: '10.5px', fontWeight: 600, marginTop: '4px' }}>Profile</span>
          </button>
        </div>
      </nav>

    </div>
  );
}