'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './utils/supabaseClient';

interface LeaderboardEntry {
  rank: number;
  username: string;
  constituency_name: string;
  state_name: string;
  civic_xp: number;
  season_ballots_count: number;
  active_streak_days: number;
}

interface LeaderboardViewProps {
  userState?: string;
  userSeat?: string;
  voterToken: string;
  seasonName?: string;
  refreshTrigger?: number;
}

export default function LeaderboardView({
  userState = 'Bihar',
  userSeat = 'Karakat',
  voterToken,
  seasonName = 'Ashwin Season (Oct 2026)',
  refreshTrigger = 0
}: LeaderboardViewProps) {
  const [scope, setScope] = useState<'STATE' | 'BHARAT' | 'SEATS'>('STATE');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [seatRankings, setSeatRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('');

  const loadProfile = useCallback(async () => {
    if (!voterToken) return;
    try {
      const { data, error } = await supabase
        .from('citizen_profiles')
        .select('*')
        .eq('voter_token', voterToken)
        .maybeSingle();

      if (!error && data) {
        setUserProfile(data);
        setNewUsername(data.username);
      }
    } catch (err) {
      console.warn('Profile load error:', err);
    }
  }, [voterToken]);

  const fetchRanks = useCallback(async () => {
    setLoading(true);
    try {
      if (scope === 'SEATS') {
        const { data } = await supabase
          .from('constituency_tallies')
          .select('constituency_name, state_name, total_votes')
          .order('total_votes', { ascending: false })
          .limit(50);
        setSeatRankings(data || []);
      } else {
        const { data, error } = await supabase.rpc('get_seasonal_leaderboard', {
          p_scope: scope,
          p_state_name: userState,
          p_season_id: '2026-10',
          p_limit: 50
        });
        if (!error && data) {
          setLeaderboardData(data);
        }
      }
    } catch (err) {
      console.error('Leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [scope, userState]);

  // Load when token changes or when parent signals a refresh (e.g. Vote cast or Profile tab opened)
  useEffect(() => {
    loadProfile();
    fetchRanks();
  }, [loadProfile, fetchRanks, refreshTrigger]);

  // Realtime subscription on citizen_profiles
  useEffect(() => {
    if (!voterToken) return;
    const channel = supabase
      .channel(`profile_xp_${voterToken}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'citizen_profiles',
          filter: `voter_token=eq.${voterToken}`
        },
        (payload: any) => {
          if (payload.new) {
            setUserProfile(payload.new);
            setNewUsername(payload.new.username);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [voterToken]);

  const handleUpdateUsername = async () => {
    const cleanName = newUsername.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (cleanName.length < 3 || cleanName.length > 18) {
      setUsernameStatus('Username must be 3-18 alphanumeric characters.');
      return;
    }
    setUsernameStatus('Saving alias...');
    const { error } = await supabase
      .from('citizen_profiles')
      .update({ username: cleanName })
      .eq('voter_token', voterToken);

    if (error) {
      setUsernameStatus(error.message.includes('unique') ? 'Alias already taken.' : 'Update failed.');
    } else {
      setUserProfile((prev: any) => ({ ...prev, username: cleanName }));
      setIsEditingUsername(false);
      setUsernameStatus('');
      fetchRanks();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {/* 1. Citizen Sovereign Identity & Milestone Ladder */}
      <div style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '18px', padding: '16px', border: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {seasonName}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              {isEditingUsername ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #38bdf8', backgroundColor: '#1e293b', color: '#fff', fontSize: '13px', fontWeight: 700 }}
                  />
                  <button onClick={handleUpdateUsername} style={{ padding: '4px 8px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setIsEditingUsername(false)} style={{ padding: '4px 8px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '17px', fontWeight: 900 }}>{userProfile?.username || 'Anonymous Citizen'}</span>
                  <button onClick={() => setIsEditingUsername(true)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                </div>
              )}
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              📍 {userSeat} • {userState}
            </span>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#f59e0b' }}>
              {userProfile?.civic_xp || 0} <span style={{ fontSize: '11px', color: '#94a3b8' }}>XP</span>
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 800, marginTop: '2px' }}>
              🔥 {userProfile?.active_streak_days || 1}-Day Streak
            </div>
          </div>
        </div>

        {usernameStatus && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '6px' }}>{usernameStatus}</div>}

        {/* Milestone Progress Bar */}
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
            <span>Season Fortifier Goal</span>
            <span>{userProfile?.season_ballots_count || 0} / 15 Ballots</span>
          </div>
          <div style={{ width: '100%', height: '6px', backgroundColor: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, Math.round(((userProfile?.season_ballots_count || 0) / 15) * 100))}%`,
                height: '100%',
                backgroundColor: '#38bdf8',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. Scope Switcher */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', backgroundColor: '#ffffff', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <button
          onClick={() => setScope('STATE')}
          style={{
            padding: '8px 4px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: scope === 'STATE' ? '#0f172a' : 'transparent',
            color: scope === 'STATE' ? '#ffffff' : '#64748b',
            fontSize: '11.5px',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          📍 {userState.toUpperCase()}
        </button>
        <button
          onClick={() => setScope('BHARAT')}
          style={{
            padding: '8px 4px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: scope === 'BHARAT' ? '#0f172a' : 'transparent',
            color: scope === 'BHARAT' ? '#ffffff' : '#64748b',
            fontSize: '11.5px',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          🇮🇳 BHARAT TOP 50
        </button>
        <button
          onClick={() => setScope('SEATS')}
          style={{
            padding: '8px 4px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: scope === 'SEATS' ? '#0f172a' : 'transparent',
            color: scope === 'SEATS' ? '#ffffff' : '#64748b',
            fontSize: '11.5px',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          🛡️ SEAT QUORUM
        </button>
      </div>

      {/* 3. Leaderboard Listing */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{scope === 'SEATS' ? 'Constituency Fortification Rank' : `Top Citizens • ${scope === 'STATE' ? userState : 'Pan-Bharat'}`}</span>
          <span>{scope === 'SEATS' ? 'Ballots' : 'XP Points'}</span>
        </div>

        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
            Loading sovereign standings...
          </div>
        ) : scope === 'SEATS' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {seatRankings.map((seat, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '10px', backgroundColor: idx < 3 ? '#fffbeb' : '#f8fafc', border: `1px solid ${idx < 3 ? '#fef3c7' : '#f1f5f9'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, width: '22px', color: idx === 0 ? '#d97706' : '#64748b' }}>#{idx + 1}</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{seat.constituency_name}</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>{seat.state_name}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: seat.total_votes >= 50 ? '#059669' : '#0284c7' }}>
                    {seat.total_votes} Ballots
                  </span>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: seat.total_votes >= 50 ? '#059669' : '#94a3b8' }}>
                    {seat.total_votes >= 50 ? '🛡️ Quorum' : '🌱 Progressing'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {leaderboardData.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                No rankings registered for this season yet. Cast your ballot to claim Rank #1!
              </div>
            ) : (
              leaderboardData.map((item) => (
                <div key={item.rank} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '10px', backgroundColor: item.username === userProfile?.username ? '#eff6ff' : '#f8fafc', border: `1px solid ${item.username === userProfile?.username ? '#bfdbfe' : '#f1f5f9'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 900, width: '22px', color: item.rank === 1 ? '#eab308' : item.rank === 2 ? '#94a3b8' : item.rank === 3 ? '#b45309' : '#64748b' }}>
                      #{item.rank}
                    </span>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: item.username === userProfile?.username ? '#0284c7' : '#0f172a' }}>
                        {item.username} {item.username === userProfile?.username && '★ You'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        📍 {item.constituency_name} ({item.state_name})
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#f59e0b' }}>
                      {item.civic_xp} XP
                    </span>
                    <div style={{ fontSize: '9.5px', color: '#64748b' }}>
                      {item.season_ballots_count} ballots • 🔥 {item.active_streak_days}d
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}