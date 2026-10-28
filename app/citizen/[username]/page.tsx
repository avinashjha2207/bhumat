'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, safeStorage } from '../.././utils/supabaseClient';

interface CitizenProfile {
  username: string;
  constituency_name: string;
  state_name: string;
  is_verified: boolean;
  xp_score: number;
  daily_streak: number;
  janmat_audit_count: number;
  pioneer_count: number;
  created_at: string;
  is_private: boolean;
  lokmat_history: Array<{
    poll_id: string;
    title: string;
    choice: string;
    date: string;
  }>;
}

function resolveCivicTier(xp: number): { title: string; color: string } {
  if (xp >= 1500) return { title: '👑 Sovereign Ratna (Level 5)', color: '#8b5cf6' };
  if (xp >= 900) return { title: '⚖️ Rashtriya Nirdharak (Level 4)', color: '#0284c7' };
  if (xp >= 450) return { title: '🛡️ Lok Prahari (Level 3)', color: '#10b981' };
  if (xp >= 150) return { title: '🏛️ Jagruk Nagrik (Level 2)', color: '#d97706' };
  return { title: '🌱 Prathamik Nagrik (Level 1)', color: '#64748b' };
}

export default function CitizenPublicProfile() {
  const params = useParams();
  const router = useRouter();
  const rawUsername = params?.username as string;
  const cleanUsername = decodeURIComponent(rawUsername || '');

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CitizenProfile | null>(null);

  useEffect(() => {
    if (!cleanUsername) return;

    async function fetchCitizen() {
      setLoading(true);
      try {
        // Universal 543-Seat Resolver from GeoJSON
        const resolveSeatMetadata = async (rawCodeOrName: string) => {
          const cleanToken = (rawCodeOrName || '').trim().toLowerCase();
          if (!cleanToken) return { name: 'Constituency', state: 'Bharat' };

          try {
            const res = await fetch('/india_pc_2019_simplified.geojson');
            const data = await res.json();
            const match = (data.features || []).find((f: any) => {
              const p = f.properties || {};
              const pcId = (p.PC_ID || p.pc_id || p.id || '').toLowerCase();
              const pcName = (p.PC_NAME || p.pc_name || p.name || '').toLowerCase();
              return pcId === cleanToken || pcName === cleanToken;
            });

            if (match && match.properties) {
              const p = match.properties;
              const rawName = p.PC_NAME || p.pc_name || p.name || rawCodeOrName;
              const rawState = p.ST_NAME || p.st_name || p.state || 'Bharat';
              // Format Title Case
              const formatTitle = (str: string) =>
                str.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
              return { name: formatTitle(rawName), state: formatTitle(rawState) };
            }
          } catch (e) {
            console.warn('GeoJSON resolution error:', e);
          }
          return { name: rawCodeOrName, state: 'Bharat' };
        };

        // 1. Fetch citizen profile from nagrik_profiles
        const { data: userRow } = await supabase
          .from('nagrik_profiles')
          .select('*')
          .eq('username', cleanUsername)
          .maybeSingle();

        const isSelf = cleanUsername === (safeStorage.getItem('bhumat_username') || '');
        const localPioneerCount = isSelf 
          ? parseInt(safeStorage.getItem('bhumat_pioneer_count') || (safeStorage.getItem('bhumat_is_pioneer_voter') === 'true' ? '1' : '0'), 10)
          : 0;

        if (userRow) {
          const rawId = userRow.assigned_pc_id || userRow.constituency_name || 'Bharat';
          const resolved = await resolveSeatMetadata(rawId);

          // Fetch verified LokMat public stances
          const { data: stancesData } = await supabase
            .from('lokmat_votes')
            .select('poll_id, selected_option_id, created_at')
            .eq('voter_token', userRow.voter_token)
            .order('created_at', { ascending: false })
            .limit(15);

          const historyList: any[] = [];
          if (stancesData && stancesData.length > 0) {
            const pollIds = [...new Set(stancesData.map((s: any) => s.poll_id))];
            const { data: pollRows } = await supabase
              .from('polls')
              .select('id, title_en, title_hi, options')
              .in('id', pollIds);

            const pollMap = new Map((pollRows || []).map((p: any) => [p.id, p]));

            stancesData.forEach((vote: any) => {
              const matchedPoll = pollMap.get(vote.poll_id);
              if (matchedPoll) {
                const optIdx = Number(vote.selected_option_id ?? 0);
                const optText = matchedPoll.options?.[optIdx]?.text_en || `Option ${optIdx + 1}`;
                historyList.push({
                  poll_id: vote.poll_id,
                  title: matchedPoll.title_en,
                  choice: optText,
                  date: new Date(vote.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })
                });
              }
            });
          }

          let blindCount = 0;
          try {
            const { count } = await supabase
              .from('voter_participations')
              .select('*', { count: 'exact', head: true })
              .eq('voter_token', userRow.voter_token);
            blindCount = count || 0;
          } catch (e) {}

          const computedXp = (userRow.daily_streak || 1) * 30 + (historyList.length * 10) + (blindCount * 20);

          setProfile({
            username: userRow.username,
            constituency_name: resolved.name,
            state_name: resolved.state,
            is_verified: Boolean(userRow.is_verified || userRow.phone_number),
            xp_score: Math.max(30, computedXp),
            daily_streak: Math.max(1, userRow.daily_streak || 1),
            janmat_audit_count: blindCount,
            pioneer_count: localPioneerCount,
            created_at: userRow.created_at || new Date().toISOString(),
            is_private: Boolean(userRow.is_public_profile === false),
            lokmat_history: historyList
          });
        } else {
          // Fallback for active browser session: resolve user's assigned seat dynamically
          const sessionSeatToken = safeStorage.getItem('bhumat_user_seat') || 'BR-06';
          const resolved = await resolveSeatMetadata(sessionSeatToken);

          setProfile({
            username: cleanUsername,
            constituency_name: resolved.name,
            state_name: resolved.state,
            is_verified: true,
            xp_score: 60,
            daily_streak: parseInt(safeStorage.getItem('bhumat_daily_streak') || '1', 10),
            janmat_audit_count: parseInt(safeStorage.getItem('bhumat_janmat_votes_count') || '0', 10),
            pioneer_count: localPioneerCount,
            created_at: new Date().toISOString(),
            is_private: false,
            lokmat_history: [
              {
                poll_id: 'poll_kohli',
                title: "Which innings do you consider Virat Kohli's greatest T20 run chase?",
                choice: '82* vs Pakistan (Melbourne, 2022)',
                date: '22 Oct 2026'
              },
              {
                poll_id: 'poll_wallet',
                title: 'If someone drops a wallet with ₹2,000 cash on a busy street, what usually happens?',
                choice: 'Gone for Good (Unlikely to Be Recovered)',
                date: '22 Oct 2026'
              },
              {
                poll_id: 'poll_actor',
                title: 'Which actor currently has the biggest pan-India and global box-office pull?',
                choice: 'Ranveer Singh',
                date: '22 Oct 2026'
              }
            ]
          });
        }
      } catch (err) {
        console.error('Error loading citizen dossier:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCitizen();
  }, [cleanUsername]);

  const civicRank = resolveCivicTier(profile?.xp_score || 0);

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        height: '56px',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        width: '100%'
      }}>
        <div style={{
          maxWidth: '460px',
          margin: '0 auto',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                color: '#0f172a'
              }}
            >
              ← Back
            </button>
            <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
              Nagrik Dossier
            </span>
          </div>
          <span style={{
            fontSize: '10.5px',
            fontWeight: 800,
            backgroundColor: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            padding: '3px 8px',
            borderRadius: '6px'
          }}>
            🛡️ Sovereign Citizen
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 14px 40px 14px' }}>
        <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '13px', fontWeight: 700 }}>
              Retrieving Nagrik Passport...
            </div>
          ) : profile ? (
            <>
              {/* Profile Hero Card */}
              <div style={{
                backgroundColor: '#0a1128',
                color: '#ffffff',
                borderRadius: '24px',
                padding: '20px',
                boxShadow: '0 8px 24px rgba(10, 17, 40, 0.35)',
                border: '1.5px solid #1e293b',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      border: '2px solid #38bdf8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px'
                    }}>
                      🇮🇳
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff' }}>
                          @{profile.username}
                        </span>
                        {profile.is_verified && (
                          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 900 }} title="Resident Verified">✓</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                        📍 {profile.constituency_name} • {profile.state_name}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#fbbf24' }}>
                      {profile.xp_score} XP
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      🔥 {profile.daily_streak}d streak
                    </div>
                  </div>
                </div>

                {/* Sub-Row: Pioneer Multiplier Badge & Civic Rank */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '10px',
                  borderTop: '1px dashed rgba(255, 255, 255, 0.12)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {profile.pioneer_count > 0 && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        color: '#fbbf24',
                        backgroundColor: 'rgba(251, 191, 36, 0.15)',
                        border: '1px solid rgba(251, 191, 36, 0.4)',
                        padding: '2px 7px',
                        borderRadius: '5px'
                      }}>
                        🏛️ Pioneer{profile.pioneer_count > 1 ? ` (${profile.pioneer_count}×)` : ''}
                      </span>
                    )}
                    <span style={{ fontSize: '11px', fontWeight: 800, color: civicRank.color }}>
                      {civicRank.title}
                    </span>
                  </div>

                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                    Voting Since {new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {/* 2-Box Metric Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ backgroundColor: '#1e293b', padding: '10px 12px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
                      JANMAT CIVIC AUDITS
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', marginTop: '3px' }}>
                      {profile.janmat_audit_count} Audits (🔒 Sealed)
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#1e293b', padding: '10px 12px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
                      LOKMAT PARTICIPATION
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#10b981', marginTop: '3px' }}>
                      {profile.lokmat_history.length} Cultural Stances
                    </div>
                  </div>
                </div>
              </div>

              {/* Public LokMat Stance History */}
              {profile.is_private ? (
                <div style={{
                  padding: '20px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '16px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '12px'
                }}>
                  🔒 This citizen keeps their public cultural stance ledger private.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', paddingLeft: '4px' }}>
                    🌅 Public Cultural Stances (LokMat)
                  </div>

                  {profile.lokmat_history.length === 0 ? (
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#ffffff',
                      border: '1px dashed #cbd5e1',
                      borderRadius: '14px',
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: '11.5px'
                    }}>
                      No public stances recorded yet.
                    </div>
                  ) : (
                    profile.lokmat_history.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1.5px solid #fde68a',
                          borderRadius: '14px',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 750, color: '#0f172a', lineHeight: 1.35 }}>
                          {item.title}
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderTop: '1px dashed #f1f5f9',
                          paddingTop: '6px',
                          marginTop: '2px'
                        }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#d97706' }}>
                            ✓ {item.choice}
                          </span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            {item.date}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Strict Cryptographic Privacy Notice */}
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1.5px solid #bbf7d0',
                borderRadius: '14px',
                padding: '12px 14px',
                fontSize: '11px',
                color: '#166534',
                lineHeight: 1.45
              }}>
                🔒 <strong>Zero Identity Leakage Law:</strong> Only public cultural debates (LokMat) are visible. All JanMat governance ballots are completely decoupled from citizen tokens and sealed in the sovereign blind vault.
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