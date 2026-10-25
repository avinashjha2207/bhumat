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

  const CACHE_TTL_MS = 60000;

  useEffect(() => {
    const saved = safeStorage.getItem('bhumat_user_seat');
    if (saved) setUserSeat(saved);

    try {
      const cachedTime = sessionStorage.getItem('bhumat_lb_time');
      const cachedSpatial = sessionStorage.getItem('bhumat_lb_spatial');
      const cachedCitizens = sessionStorage.getItem('bhumat_lb_citizens');

      if (cachedTime && Date.now() - Number(cachedTime) < CACHE_TTL_MS && cachedSpatial && cachedCitizens) {
        const parsedSpatial = JSON.parse(cachedSpatial);
        setSeatsData(parsedSpatial.seats || []);
        setStatesData(parsedSpatial.states || []);
        setCitizenList(JSON.parse(cachedCitizens) || []);
        setLoading(false);
        return;
      }
    } catch (e) {}

    fetchLeaderboard();
  }, []);

  async function fetchLeaderboard(forceRefresh = false) {
    if (!forceRefresh) {
      const cachedSpatial = sessionStorage.getItem('bhumat_lb_spatial');
      if (!cachedSpatial) setLoading(true);
    }
    try {
      const [spatialRes, citizenRes] = await Promise.all([
        supabase.rpc('get_leaderboard_spatial_stats'),
        supabase.rpc('get_leaderboard_citizen_hall_of_fame', { p_limit: 50 })
      ]);

      if (spatialRes.data) {
        setSeatsData(spatialRes.data.seats || []);
        setStatesData(spatialRes.data.states || []);
        sessionStorage.setItem('bhumat_lb_spatial', JSON.stringify(spatialRes.data));
      }
      if (citizenRes.data) {
        setCitizenList(citizenRes.data || []);
        sessionStorage.setItem('bhumat_lb_citizens', JSON.stringify(citizenRes.data));
      }
      sessionStorage.setItem('bhumat_lb_time', String(Date.now()));
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }

  // Active leaders for the top hero card
  const topSeat = seatsData[0];
  const topState = statesData[0];
  const topCitizen = citizenList[0];

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header */}
      <header style={{ height: '56px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 40, width: '100%' }}>
        <div style={{ maxWidth: '460px', margin: '0 auto', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => router.push('/')}
              style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: 0 }}
            >
              ←
            </button>
            <span style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
              🏆 Bharat Civic League
            </span>
          </div>
          <button
            onClick={() => fetchLeaderboard(true)}
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '5px 10px', fontSize: '11px', fontWeight: 800, color: '#0f172a', cursor: 'pointer' }}
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 14px 90px 14px' }}>
        <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* TOP HERO SEASON CARD (CLEAN, UNIFIED, WITH CURRENT LEADER EMBEDDED) */}
          {(() => {
            const now = new Date();
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const daysLeft = Math.max(1, daysInMonth - now.getDate());
            const monthLabel = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
            const seasonNo = now.getMonth() + 1;

            return (
              <div style={{
                backgroundColor: '#0a1128',
                color: '#ffffff',
                borderRadius: '20px',
                padding: '18px 20px',
                border: '1.5px solid #1e293b',
                boxShadow: '0 8px 24px rgba(10, 17, 40, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 900,
                    color: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    letterSpacing: '0.05em'
                  }}>
                    SEASON {seasonNo} • {monthLabel} {now.getFullYear()}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⏳</span>
                    <span>{daysLeft} days left</span>
                  </span>
                </div>

                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                    Bharat Civic League
                  </h2>
                  <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '3px 0 0 0' }}>
                    {activeTab === 'SEATS' && 'Constituency consensus battle across 543 seats'}
                    {activeTab === 'STATES' && 'State Cup: Aggregate verified voter turnout'}
                    {activeTab === 'CITIZENS' && 'Citizen Hall of Fame: Top verified electors'}
                  </p>
                </div>

                {/* BOTTOM ROW: TAB-SPECIFIC LEADING DATA ALIGNED FLUSH WITH ⏳ DAYS LEFT */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  paddingTop: '8px',
                  fontSize: '11px'
                }}>
                  <span style={{ color: '#94a3b8' }}>
                    {activeTab === 'SEATS' && 'Defending: Darbhanga (Sep)'}
                    {activeTab === 'STATES' && 'Defending: Bihar (Season 9)'}
                    {activeTab === 'CITIZENS' && 'Season MVP: @CitizenLeader'}
                  </span>
                  <span style={{ fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>🔥</span>
                    <span>
                      {activeTab === 'SEATS' && (topSeat ? `#1 ${topSeat.constituency_name}` : 'Awaiting Data')}
                      {activeTab === 'STATES' && (topState ? `#1 ${topState.state_name}` : 'Awaiting Data')}
                      {activeTab === 'CITIZENS' && (topCitizen ? `#1 @${topCitizen.username}` : 'Awaiting Data')}
                    </span>
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Tab Selector */}
          <div style={{ display: 'flex', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => setActiveTab('SEATS')}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'SEATS' ? '#0f172a' : 'transparent',
                color: activeTab === 'SEATS' ? '#ffffff' : '#64748b',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              ⚔️ Seats Turf War
            </button>
            <button
              onClick={() => setActiveTab('STATES')}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'STATES' ? '#0f172a' : 'transparent',
                color: activeTab === 'STATES' ? '#ffffff' : '#64748b',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🇮🇳 State Cup
            </button>
            <button
              onClick={() => setActiveTab('CITIZENS')}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'CITIZENS' ? '#0f172a' : 'transparent',
                color: activeTab === 'CITIZENS' ? '#ffffff' : '#64748b',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              👑 Hall of Fame
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#0284c7', fontSize: '13px', fontWeight: 700 }}>
              Querying sovereign consensus rankings...
            </div>
          ) : (
            <>
              {/* TAB 1: SEATS TURF WAR */}
              {activeTab === 'SEATS' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Top 3 Step Podium for Seats */}
                  {seatsData.length >= 3 && (
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '20px',
                      border: '1.5px solid #e2e8f0',
                      padding: '16px 12px 12px 12px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.2fr 1fr',
                      gap: '8px',
                      alignItems: 'end',
                      textAlign: 'center'
                    }}>
                      {/* #2 Silver */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '18px' }}>🥈</span>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{seatsData[1].constituency_name}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{seatsData[1].total_votes}v</div>
                        <div style={{ width: '100%', height: '70px', backgroundColor: '#f1f5f9', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#94a3b8', marginTop: '6px' }}>
                          #2
                        </div>
                      </div>

                      {/* #1 Gold Leader */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '24px' }}>👑</span>
                        <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{seatsData[0].constituency_name}</div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#d97706' }}>{seatsData[0].total_votes} votes</div>
                        <div style={{ width: '100%', height: '95px', backgroundColor: '#fef3c7', border: '1.5px solid #fde68a', borderRadius: '12px 12px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#b45309', marginTop: '6px' }}>
                          <span style={{ fontSize: '14px' }}>#1</span>
                          <span style={{ fontSize: '9px', letterSpacing: '0.04em' }}>LEADER</span>
                        </div>
                      </div>

                      {/* #3 Bronze */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '18px' }}>🥉</span>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{seatsData[2].constituency_name}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{seatsData[2].total_votes}v</div>
                        <div style={{ width: '100%', height: '55px', backgroundColor: '#fff7ed', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#ea580c', marginTop: '6px' }}>
                          #3
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Seats 4 to 50 List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {seatsData.slice(3).map((seat, idx) => {
                      const isUserHome = userSeat && seat.constituency_name.toLowerCase() === userSeat.toLowerCase();
                      const quorumPct = Math.min(100, Math.round((seat.total_votes / 50) * 100));
                      return (
                        <div
                          key={seat.constituency_name}
                          style={{
                            backgroundColor: isUserHome ? '#f0fdf4' : '#ffffff',
                            border: isUserHome ? '1.5px solid #a7f3d0' : '1px solid #e2e8f0',
                            borderRadius: '14px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 900, color: '#64748b' }}>
                                #{idx + 4}
                              </span>
                              <div>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
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
                            <span style={{ fontSize: '12px', fontWeight: 900, color: '#0284c7' }}>
                              {seat.total_votes} {seat.total_votes === 1 ? 'Vote' : 'Votes'}
                            </span>
                          </div>

                          <div style={{ width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(quorumPct, 2)}%`, height: '100%', backgroundColor: isUserHome ? '#10b981' : '#0284c7', transition: 'width 0.4s ease' }} />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748b' }}>
                            <span>Quorum: {quorumPct}%</span>
                            <span
                              onClick={() => router.push(`/citizen/${encodeURIComponent(seat.captain_name)}`)}
                              style={{ color: '#0284c7', fontWeight: 700, cursor: 'pointer' }}
                            >
                              👑 @{seat.captain_name} ↗
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: STATE CUP (MATCHING 3-STEP PODIUM + LIST) */}
              {activeTab === 'STATES' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Top 3 Step Podium for States */}
                  {statesData.length >= 3 && (
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '20px',
                      border: '1.5px solid #e2e8f0',
                      padding: '16px 12px 12px 12px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.2fr 1fr',
                      gap: '8px',
                      alignItems: 'end',
                      textAlign: 'center'
                    }}>
                      {/* #2 Silver */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '18px' }}>🥈</span>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{statesData[1].state_name}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{statesData[1].total_votes}v</div>
                        <div style={{ width: '100%', height: '70px', backgroundColor: '#f1f5f9', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#94a3b8', marginTop: '6px' }}>
                          #2
                        </div>
                      </div>

                      {/* #1 Gold Leader */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '24px' }}>🇮🇳</span>
                        <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{statesData[0].state_name}</div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>{statesData[0].total_votes} ballots</div>
                        <div style={{ width: '100%', height: '95px', backgroundColor: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '12px 12px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#065f46', marginTop: '6px' }}>
                          <span style={{ fontSize: '14px' }}>#1</span>
                          <span style={{ fontSize: '9px', letterSpacing: '0.04em' }}>CHAMPION</span>
                        </div>
                      </div>

                      {/* #3 Bronze */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '18px' }}>🥉</span>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{statesData[2].state_name}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{statesData[2].total_votes}v</div>
                        <div style={{ width: '100%', height: '55px', backgroundColor: '#fff7ed', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#ea580c', marginTop: '6px' }}>
                          #3
                        </div>
                      </div>
                    </div>
                  )}

                  {/* States 4 to 36 List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {statesData.slice(3).map((st, idx) => (
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
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 900, color: '#64748b' }}>
                            #{idx + 4}
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
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: CITIZEN HALL OF FAME */}
              {activeTab === 'CITIZENS' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Top 3 Step Podium for Citizens */}
                  {citizenList.length >= 3 && (
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '20px',
                      border: '1.5px solid #e2e8f0',
                      padding: '16px 12px 12px 12px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.2fr 1fr',
                      gap: '8px',
                      alignItems: 'end',
                      textAlign: 'center'
                    }}>
                      {/* #2 Silver */}
                      <div
                        onClick={() => router.push(`/citizen/${encodeURIComponent(citizenList[1].username)}`)}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <span style={{ fontSize: '18px' }}>🥈</span>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85px', whiteSpace: 'nowrap' }}>
                          @{citizenList[1].username}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{citizenList[1].xp_score} XP</div>
                        <div style={{ width: '100%', height: '70px', backgroundColor: '#f1f5f9', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#94a3b8', marginTop: '6px' }}>
                          #2
                        </div>
                      </div>

                      {/* #1 Gold Leader */}
                      <div
                        onClick={() => router.push(`/citizen/${encodeURIComponent(citizenList[0].username)}`)}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <span style={{ fontSize: '24px' }}>👑</span>
                        <div style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px', whiteSpace: 'nowrap' }}>
                          @{citizenList[0].username}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#d97706' }}>{citizenList[0].xp_score} XP</div>
                        <div style={{ width: '100%', height: '95px', backgroundColor: '#fef3c7', border: '1.5px solid #fde68a', borderRadius: '12px 12px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#b45309', marginTop: '6px' }}>
                          <span style={{ fontSize: '14px' }}>#1</span>
                          <span style={{ fontSize: '9px', letterSpacing: '0.04em' }}>MVP</span>
                        </div>
                      </div>

                      {/* #3 Bronze */}
                      <div
                        onClick={() => router.push(`/citizen/${encodeURIComponent(citizenList[2].username)}`)}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <span style={{ fontSize: '18px' }}>🥉</span>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85px', whiteSpace: 'nowrap' }}>
                          @{citizenList[2].username}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{citizenList[2].xp_score} XP</div>
                        <div style={{ width: '100%', height: '55px', backgroundColor: '#fff7ed', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#ea580c', marginTop: '6px' }}>
                          #3
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Citizens 4 to 50 List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {citizenList.slice(3).map((citizen, idx) => (
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
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 900, color: '#64748b' }}>
                            #{idx + 4}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
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
                  </div>
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