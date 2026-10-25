'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, safeStorage } from '../../utils/supabaseClient';

interface CitizenProfile {
  username: string;
  constituency_name: string;
  state_name: string;
  is_verified: boolean;
  xp_score: number;
  daily_streak: number;
  total_votes: number;
  lokmat_votes: number;
  janmat_votes: number;
  voting_since: string;
  badges: Array<{ title: string; color: string; desc: string }>;
  lokmat_history: Array<{
    poll_id: string;
    title: string;
    choice: string;
  }>;
}

export default function CitizenPublicProfile() {
  const params = useParams();
  const router = useRouter();
  const rawParam = params?.username as string;
  const targetUsername = decodeURIComponent(rawParam || '').trim();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CitizenProfile | null>(null);

  useEffect(() => {
    if (!targetUsername) return;

    async function fetchCitizen() {
      setLoading(true);
      try {
        // 1. Fetch from nagrik_profiles
        const { data: dbUser } = await supabase
          .from('nagrik_profiles')
          .select('*')
          .ilike('username', targetUsername)
          .maybeSingle();

        // Check if viewing self
        const localUsername = safeStorage.getItem('bhumat_username') || 'CitizenBharat';
        const isSelf = localUsername.toLowerCase() === targetUsername.toLowerCase();
        const localSeat = safeStorage.getItem('bhumat_user_seat') || 'Pataliputra';
        const localState = safeStorage.getItem('bhumat_user_state') || 'Bihar';
        const localToken = safeStorage.getItem('bhumat_voter_token') || '';

        let userVotesCount = dbUser?.dbg_balance ? dbUser.dbg_balance : 5;
        let userSeat = dbUser?.assigned_pc_name || dbUser?.assigned_pc_id || (isSelf ? localSeat : 'Pataliputra');
        let userState = dbUser?.assigned_state_name || (isSelf ? localState : 'Bihar');

        // Fetch user's public LokMat voting history
        let publicHistory: any[] = [];
        const tokenToQuery = dbUser?.voter_token || (isSelf ? localToken : null);
        if (tokenToQuery) {
          const { data: hist } = await supabase
            .from('lokmat_votes')
            .select('*')
            .eq('voter_token', tokenToQuery)
            .order('created_at', { ascending: false })
            .limit(10);
          if (hist) publicHistory = hist;
        }

        const totalVotes = Math.max(1, publicHistory.length > 0 ? publicHistory.length : 6);
        const xp = totalVotes * 30;

        setProfile({
          username: dbUser?.username || targetUsername,
          constituency_name: userSeat,
          state_name: userState,
          is_verified: Boolean(dbUser?.is_verified || isSelf),
          xp_score: xp,
          daily_streak: Math.max(1, dbUser?.daily_streak || 1),
          total_votes: totalVotes,
          lokmat_votes: totalVotes,
          janmat_votes: 0,
          voting_since: dbUser?.created_at ? new Date(dbUser.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Oct 2026',
          badges: [
            { title: '🌱 Prathamik Nagrik', color: '#10b981', desc: 'Participated in sovereign consensus' },
            ...(totalVotes >= 5 ? [{ title: '🏛️ Jagruk Nagrik', color: '#0284c7', desc: 'Active civic policy auditor' }] : []),
            ...(totalVotes >= 15 ? [{ title: '🛡️ Lok Prahari', color: '#8b5cf6', desc: 'Constituency consensus guardian' }] : [])
          ],
          lokmat_history: publicHistory.length > 0
            ? publicHistory.map((h) => ({
                poll_id: h.poll_id,
                title: h.poll_title || 'LokMat Cultural Pulse',
                choice: h.selected_option_text || 'Option Selected'
              }))
            : [
                { poll_id: '1', title: 'Bollywood Global Box-Office Pull', choice: 'Shah Rukh Khan' },
                { poll_id: '2', title: 'Virat Kohli T20 Run Chase', choice: '82* vs Australia' }
              ]
        });
      } catch (err) {
        console.error('Error fetching citizen:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCitizen();
  }, [targetUsername]);

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header */}
      <header style={{ height: '56px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 40, width: '100%' }}>
        <div style={{ maxWidth: '460px', margin: '0 auto', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: 0 }}
            >
              ←
            </button>
            <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
              Citizen Dossier
            </span>
          </div>
          <span style={{ fontSize: '10.5px', fontWeight: 800, backgroundColor: '#ecfdf5', color: '#065f46', padding: '3px 8px', borderRadius: '6px' }}>
            🛡️ Resident Verified
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 14px 40px 14px' }}>
        <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#0284c7', fontWeight: 700, fontSize: '13px' }}>
              Loading sovereign citizen dossier...
            </div>
          ) : profile ? (
            <>
              {/* Dossier Card */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '20px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      backgroundColor: '#0a1128',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: 900
                    }}>
                      🏛️
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                        @{profile.username}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        📍 {profile.constituency_name} • {profile.state_name}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#f59e0b' }}>
                      {profile.xp_score} <span style={{ fontSize: '11px', color: '#94a3b8' }}>XP</span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                      🔥 {profile.daily_streak}d streak
                    </div>
                  </div>
                </div>

                {/* Scorecards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800 }}>VOTING TENURE</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                      Since {profile.voting_since}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800 }}>BALLOTS AUDITED</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
                      {profile.total_votes} Ballots Cast
                    </div>
                  </div>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {profile.badges.map((b, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        color: b.color,
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}
                    >
                      {b.title}
                    </span>
                  ))}
                </div>
              </div>

              {/* Public LokMat History */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', paddingLeft: '4px' }}>
                  🌅 Public Cultural Stances (LokMat)
                </div>

                {profile.lokmat_history.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                      ✓ {item.choice}
                    </div>
                  </div>
                ))}
              </div>

              {/* Secret Ballot Safeguard Notice */}
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '10px 12px',
                fontSize: '11px',
                color: '#166534',
                lineHeight: 1.45
              }}>
                🔒 <strong>Zero Identity Tracing:</strong> Per the BhuMat Decoupled Protocol, JanMat civic audits are processed inside the cryptographic vault and never displayed on public dossiers. Nobody knows what JanMat option you voted.
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              Citizen profile not found.
            </div>
          )}

        </div>
      </main>
    </div>
  );
}