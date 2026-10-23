'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, safeStorage } from '../utils/supabaseClient';

interface SeatStanding {
  constituency_name: string;
  state_name: string;
  total_votes: number;
  votes_needed_to_fortify: number;
  captain_name: string;
}

interface StateStanding {
  state_name: string;
  total_votes: number;
  active_seats_count: number;
}

interface CitizenStanding {
  user_id: string;
  username: string;
  constituency_name: string;
  is_verified: boolean;
  xp_score: number;
  daily_streak: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'SEATS' | 'STATES' | 'CITIZENS'>('SEATS');
  const [loading, setLoading] = useState(true);
  const [seatsData, setSeatsData] = useState<SeatStanding[]>([]);
  const [statesData, setStatesData] = useState<StateStanding[]>([]);
  const [citizenList, setCitizenList] = useState<CitizenStanding[]>([]);
  const [userSeat, setUserSeat] = useState<string | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Dynamic Season Date Engine
  const now = new Date();
  const currentMonthName = now.toLocaleString('en-US', { month: 'short' });
  const currentYear = now.getFullYear();
  const seasonNumber = now.getMonth() + 1;
  const prevSeasonNumber = seasonNumber > 1 ? seasonNumber - 1 : 12;
  const prevMonthName = new Date(currentYear, now.getMonth() - 1, 1).toLocaleString('en-US', { month: 'short' });
  const lastDayOfMonth = new Date(currentYear, now.getMonth() + 1, 0).getDate();
  const daysRemainingInSeason = Math.max(1, lastDayOfMonth - now.getDate());

  useEffect(() => {
    const saved = safeStorage.getItem('bhumat_user_seat');
    if (saved) setUserSeat(saved);
    fetchLeaderboard();
  }, []);

  async function fetchLeaderboard() {
    setLoading(true);
    try {
      const { data: spatialStats } = await supabase.rpc('get_leaderboard_spatial_stats');
      if (spatialStats) {
        setSeatsData(spatialStats.seats || []);
        setStatesData(spatialStats.states || []);
      }

      const { data: citizens } = await supabase.rpc('get_leaderboard_citizen_hall_of_fame', {
        p_limit: 50,
      });
      if (citizens) {
        setCitizenList(citizens || []);
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }

  // Home Seat Entry in Standings
  const userSeatEntry = seatsData.find(
    (s) => userSeat && s.constituency_name.toLowerCase() === userSeat.toLowerCase()
  );
  const userSeatRank = userSeatEntry ? seatsData.indexOf(userSeatEntry) + 1 : null;
  const isUserLeading = userSeatRank === 1;

  const handleShareMobilize = (seatName: string, votes: number, rank: number) => {
    const message = `🇮🇳 *${seatName} Civic Alert!*\n\nOur Lok Sabha constituency is currently ranked *#${rank} in Bharat* with ${votes} verified votes on BhuMat!\n\nHelp us climb the national civic table and reach the 50-vote goal:\n👉 https://vote.bhumat.com?seat=${encodeURIComponent(seatName)}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Rules & Logic Modal */}
      {showRulesModal && (
        <div
          onClick={() => setShowRulesModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '20px',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 900, color: '#0f172a' }}>
                🏆 Bharat Civic League Rules
              </span>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                style={{ background: '#f1f5f9', border: 'none', width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer', fontWeight: 800, color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11.5px', color: '#334155', lineHeight: 1.45 }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#0284c7' }}>1. Monthly Seasons:</strong>
                <p style={{ margin: '3px 0 0 0' }}>Rankings run strictly per calendar month. On the 1st of every month, final standings are archived and the league resets for the next season.</p>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#059669' }}>2. District Goal (50 Votes):</strong>
                <p style={{ margin: '3px 0 0 0' }}>When a Lok Sabha constituency crosses 50 verified resident ballots, its community verdict achieves official standing.</p>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#d97706' }}>3. Citizen Hall of Fame:</strong>
                <p style={{ margin: '3px 0 0 0' }}>Earn XP by voting on daily pulses and keeping your streak alive. The top voter in each district earns the <strong>👑 @DistrictCaptain</strong> badge.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              style={{
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
                marginTop: '4px'
              }}
            >
              Got it ✓
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ height: '56px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 40, width: '100%' }}>
        <div style={{ maxWidth: '460px', margin: '0 auto', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => router.push('/')}
              style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: 0 }}
            >
              ←
            </button>
            <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
              🏆 Bharat Civic League
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 750,
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              <span>ⓘ</span>
              <span>Rules</span>
            </button>

            <button
              type="button"
              onClick={fetchLeaderboard}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 14px 90px 14px' }}>
        <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* Tab Selector */}
          <div style={{ display: 'flex', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '4px', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <button
              type="button"
              onClick={() => setActiveTab('SEATS')}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: activeTab === 'SEATS' ? '#0f172a' : 'transparent',
                color: activeTab === 'SEATS' ? '#ffffff' : '#64748b',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              ⚔️ Seats Turf War
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('STATES')}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: activeTab === 'STATES' ? '#0f172a' : 'transparent',
                color: activeTab === 'STATES' ? '#ffffff' : '#64748b',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              🇮🇳 State Cup
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CITIZENS')}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: activeTab === 'CITIZENS' ? '#0f172a' : 'transparent',
                color: activeTab === 'CITIZENS' ? '#ffffff' : '#64748b',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              👑 Hall of Fame
            </button>
          </div>

          {/* Active Season & Defending Champion Contextual Widget */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '16px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px' }}>📅</span>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>
                  Season {seasonNumber} • {currentMonthName} {currentYear}
                </span>
              </div>
              <span style={{ color: '#0284c7', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 800 }}>
                ⏳ {daysRemainingInSeason} days left
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
              <span style={{ color: '#64748b' }}>
                {activeTab === 'SEATS' && (
                  <>🛡️ <strong>Defending Champion:</strong> Darbhanga ({prevMonthName})</>
                )}
                {activeTab === 'STATES' && (
                  <>🛡️ <strong>Defending State:</strong> Bihar (Season {prevSeasonNumber})</>
                )}
                {activeTab === 'CITIZENS' && (
                  <>🛡️ <strong>Season {prevSeasonNumber} MVP:</strong> @CitizenLeader (740 XP)</>
                )}
              </span>
              <span style={{ color: '#059669', fontWeight: 800 }}>
                {activeTab === 'SEATS' && (seatsData[0]?.constituency_name ? `🔥 #1 ${seatsData[0].constituency_name}` : '🔥 Active')}
                {activeTab === 'STATES' && (statesData[0]?.state_name ? `🔥 #1 ${statesData[0].state_name}` : '🔥 Active')}
                {activeTab === 'CITIZENS' && (citizenList[0]?.username ? `🔥 #1 @${citizenList[0].username}` : '🔥 Active')}
              </span>
            </div>
          </div>

          {/* Gamified Pinned Home District Banner (Seats Tab) */}
          {activeTab === 'SEATS' && userSeatEntry && (
            <div style={{
              backgroundColor: isUserLeading ? '#fefce8' : '#ecfdf5',
              border: `1.5px solid ${isUserLeading ? '#fde047' : '#a7f3d0'}`,
              borderRadius: '16px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '15px' }}>{isUserLeading ? '👑' : '🛡️'}</span>
                  <span style={{ fontSize: '12.5px', fontWeight: 900, color: isUserLeading ? '#854d0e' : '#065f46' }}>
                    {isUserLeading 
                      ? `${userSeatEntry.constituency_name} is Leading Bharat! (#1 Rank)`
                      : `Your Seat: ${userSeatEntry.constituency_name} (#${userSeatRank} in Bharat)`}
                  </span>
                </div>
                <span style={{ fontSize: '12.5px', fontWeight: 900, color: isUserLeading ? '#a16207' : '#047857' }}>
                  {userSeatEntry.total_votes} Votes
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: isUserLeading ? '#854d0e' : '#065f46', fontWeight: 600 }}>
                  {userSeatEntry.total_votes >= 50
                    ? '🛡️ Goal Met (Official Standing)'
                    : `🎯 ${50 - userSeatEntry.total_votes} more votes to reach 50 goal`}
                </span>
                <button
                  type="button"
                  onClick={() => handleShareMobilize(userSeatEntry.constituency_name, userSeatEntry.total_votes, userSeatRank || 1)}
                  style={{
                    backgroundColor: isUserLeading ? '#eab308' : '#10b981',
                    color: isUserLeading ? '#0f172a' : '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>📲</span>
                  <span>{isUserLeading ? 'Defend #1 Rank' : 'Mobilize Seat'}</span>
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
              Querying live civic rankings...
            </div>
          ) : (
            <>
              {/* TAB 1: SEATS TURF WAR */}
              {activeTab === 'SEATS' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {seatsData.length === 0 ? (
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px', border: '1px solid #e2e8f0' }}>
                      No active ballots cast yet across the 543 seats.
                    </div>
                  ) : (
                    seatsData.map((seat, idx) => {
                      const isUserHome = userSeat && seat.constituency_name.toLowerCase() === userSeat.toLowerCase();
                      const quorumPct = Math.min(100, Math.round((seat.total_votes / 50) * 100));
                      const isFortified = seat.total_votes >= 50;

                      // Gap calculation against the seat directly above it
                      const prevSeat = idx > 0 ? seatsData[idx - 1] : null;
                      const votesToOvertake = prevSeat ? (prevSeat.total_votes - seat.total_votes + 1) : 0;

                      return (
                        <div
                          key={seat.constituency_name}
                          style={{
                            backgroundColor: isUserHome ? '#f0fdf4' : '#ffffff',
                            border: isUserHome ? '1.5px solid #a7f3d0' : '1px solid #e2e8f0',
                            borderRadius: '16px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12.5px', fontWeight: 900, color: idx < 3 ? '#d97706' : '#64748b' }}>
                                #{idx + 1}
                              </span>
                              <div>
                                <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                                  {seat.constituency_name}
                                </span>
                                <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                                  ({seat.state_name})
                                </span>
                                {isUserHome && (
                                  <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 800, color: '#059669', backgroundColor: '#d1fae5', padding: '1px 6px', borderRadius: '4px' }}>
                                    Your Seat
                                  </span>
                                )}
                              </div>
                            </div>
                            <span style={{ fontSize: '12.5px', fontWeight: 900, color: '#0284c7' }}>
                              {seat.total_votes} {seat.total_votes === 1 ? 'Vote' : 'Votes'}
                            </span>
                          </div>

                          {/* Progress to 50-Vote Goal */}
                          <div style={{ width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(quorumPct, 2)}%`, height: '100%', backgroundColor: isFortified ? '#10b981' : '#0284c7', transition: 'width 0.4s ease' }} />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: '#64748b' }}>
                            <span>
                              {idx === 0 ? (
                                <strong style={{ color: '#059669' }}>👑 Leading Bharat by {seat.total_votes - (seatsData[1]?.total_votes || 0)} votes</strong>
                              ) : (
                                <span style={{ color: '#d97706', fontWeight: 700 }}>
                                  🔥 {votesToOvertake} {votesToOvertake === 1 ? 'vote' : 'votes'} behind #{idx} {prevSeat?.constituency_name}
                                </span>
                              )}
                            </span>
                            <span
                              onClick={() => router.push(`/citizen/${encodeURIComponent(seat.captain_name)}`)}
                              style={{ color: '#0284c7', fontWeight: 700, cursor: 'pointer' }}
                            >
                              👑 @{seat.captain_name} ↗
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 2: STATE CUP */}
              {activeTab === 'STATES' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {statesData.length === 0 ? (
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px', border: '1px solid #e2e8f0' }}>
                      No state telemetry recorded yet.
                    </div>
                  ) : (
                    statesData.map((st, idx) => (
                      <div
                        key={st.state_name}
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '14px',
                          padding: '12px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 900, color: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : '#64748b' }}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{st.state_name}</div>
                            <div style={{ fontSize: '10.5px', color: '#64748b' }}>{st.active_seats_count} Seats Active</div>
                          </div>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 900, color: '#059669' }}>
                          {st.total_votes} Ballots
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: CITIZEN HALL OF FAME (3D OLYMPIC STEP-PODIUM) */}
              {activeTab === 'CITIZENS' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {citizenList.length === 0 ? (
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px', border: '1px solid #e2e8f0' }}>
                      No verified citizens ranked yet.
                    </div>
                  ) : (
                    <>
                      {/* Authentic 3D Olympic Step-Podium */}
                      {citizenList.length >= 3 && (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1.25fr 1fr',
                          gap: '8px',
                          alignItems: 'flex-end',
                          padding: '16px 0 6px 0'
                        }}>
                          {/* Rank 2 (Silver) - 105px Step */}
                          <div
                            onClick={() => router.push(`/citizen/${encodeURIComponent(citizenList[1].username)}`)}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1.5px solid #cbd5e1',
                              borderRadius: '16px 16px 12px 12px',
                              height: '105px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center',
                              padding: '8px 4px',
                              textAlign: 'center',
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                              transition: 'transform 0.15s ease'
                            }}
                          >
                            <div style={{ fontSize: '24px', lineHeight: 1 }}>🥈</div>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', marginTop: '6px', maxWidth: '95%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              @{citizenList[1].username}
                            </div>
                            <div style={{ fontSize: '11.5px', fontWeight: 900, color: '#475569', marginTop: '2px' }}>
                              {citizenList[1].xp_score} XP
                            </div>
                          </div>

                          {/* Rank 1 (Gold - Center & Elevated) - 130px Step */}
                          <div
                            onClick={() => router.push(`/citizen/${encodeURIComponent(citizenList[0].username)}`)}
                            style={{
                              backgroundColor: '#fffdf5',
                              border: '2px solid #f59e0b',
                              borderRadius: '18px 18px 12px 12px',
                              height: '130px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center',
                              padding: '10px 6px',
                              textAlign: 'center',
                              cursor: 'pointer',
                              boxShadow: '0 6px 20px rgba(245, 158, 11, 0.22)',
                              position: 'relative'
                            }}
                          >
                            <div style={{
                              position: 'absolute',
                              top: '-12px',
                              backgroundColor: '#f59e0b',
                              color: '#ffffff',
                              fontSize: '9.5px',
                              fontWeight: 900,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              letterSpacing: '0.04em'
                            }}>
                              RANK 1
                            </div>
                            <div style={{ fontSize: '30px', lineHeight: 1, marginTop: '4px' }}>👑</div>
                            <div style={{ fontSize: '12px', fontWeight: 900, color: '#0284c7', marginTop: '6px', maxWidth: '95%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              @{citizenList[0].username}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 900, color: '#d97706', marginTop: '2px' }}>
                              {citizenList[0].xp_score} XP
                            </div>
                          </div>

                          {/* Rank 3 (Bronze) - 95px Step */}
                          <div
                            onClick={() => router.push(`/citizen/${encodeURIComponent(citizenList[2].username)}`)}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1.5px solid #fed7aa',
                              borderRadius: '16px 16px 12px 12px',
                              height: '95px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center',
                              padding: '8px 4px',
                              textAlign: 'center',
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                            }}
                          >
                            <div style={{ fontSize: '22px', lineHeight: 1 }}>🥉</div>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', marginTop: '6px', maxWidth: '95%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              @{citizenList[2].username}
                            </div>
                            <div style={{ fontSize: '11.5px', fontWeight: 900, color: '#475569', marginTop: '2px' }}>
                              {citizenList[2].xp_score} XP
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Remaining Citizen Rows (#4 onward) */}
                      {citizenList.slice(citizenList.length >= 3 ? 3 : 0).map((citizen, idx) => (
                        <div
                          key={citizen.username + idx}
                          onClick={() => router.push(`/citizen/${encodeURIComponent(citizen.username)}`)}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '14px',
                            padding: '12px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 900, color: '#64748b' }}>
                              #{citizenList.length >= 3 ? idx + 4 : idx + 1}
                            </span>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0284c7' }}>
                                @{citizen.username} {citizen.is_verified && <span style={{ color: '#059669' }}>✓</span>}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>📍 {citizen.constituency_name}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: 900, color: '#f59e0b' }}>
                              {citizen.xp_score} XP
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>🔥 {citizen.daily_streak}d streak</div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </main>

      {/* 5-Tab Navigation Dock */}
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
          boxShadow: '0 -2px 10px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '460px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', boxSizing: 'border-box' }}>
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