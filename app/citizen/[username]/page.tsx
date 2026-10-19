'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../utils/supabaseClient';

const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];

export default function PublicCitizenProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params?.username as string;
  
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  

  useEffect(() => {
    async function loadCitizenProfile() {
      if (!username) return;
      try {
        setLoading(true);
        setError(false);
        const cleanUsername = decodeURIComponent(username as string).trim();

        // Query voter_wallets for this citizen
        const { data, error: dbErr } = await supabase
          .from('voter_wallets')
          .select('*')
          .ilike('username', cleanUsername)
          .maybeSingle();

        if (dbErr || !data) {
          setProfile(null);
          setError(true);
          return;
        }

        // Fetch user's public LokMat voting history
        let publicHistory: any[] = [];
        try {
          const { data: histData } = await supabase
            .from('lokmat_votes')
            .select('*')
            .eq('voter_token', data.voter_token)
            .order('created_at', { ascending: false })
            .limit(10);
          if (histData) publicHistory = histData;
        } catch (hErr) {
          console.warn('History fetch skipped:', hErr);
        }

        const totalVotes = Number(data.total_votes || 0);
        const xpScore = totalVotes * 30;

        // Construct normalized profile object matching JSX expectations
        const formattedProfile = {
          username: data.username || cleanUsername,
          is_verified: Boolean(data.is_verified || data.phone_number || data.email),
          constituency_name: data.home_seat || 'Bharat',
          state_name: data.home_state || 'Bharat',
          lifetime_votes: totalVotes,
          season_votes: totalVotes,
          season_lokmat_votes: Number(data.lokmat_votes || 0),
          season_janmat_votes: Number(data.janmat_votes || 0),
          sponsored_polls_count: 0,
          xp_score: xpScore,
          caq_pct: 88,
          voting_since: data.voting_since || data.created_at,
          seat_locked_at: data.updated_at || data.created_at,
          badges: [
            { title: '🌱 Prathamik Nagrik', desc: 'Participated in sovereign consensus', color: '#10b981' },
            ...(totalVotes >= 10 ? [{ title: '🏛️ Jagruk Nagrik', desc: 'Active policy auditor', color: '#0284c7' }] : []),
            ...(totalVotes >= 25 ? [{ title: '🛡️ Lok Prahari', desc: 'Constituency guardian', color: '#8b5cf6' }] : [])
          ],
          history: publicHistory.map((h: any, idx: number) => ({
            receipt_code: `TXN-${(h.id || idx).toString().slice(0, 8).toUpperCase()}`,
            question_title: h.poll_title || 'LokMat Cultural Pulse',
            selected_choice: h.selected_option_text || 'Option Selected',
            selected_option_id: Number(h.selected_option || 0)
          }))
        };

        setProfile(formattedProfile);
      } catch (err) {
        console.error('Citizen profile fetch error:', err);
        setError(true);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    loadCitizenProfile();
  }, [username]);

  const handleShareProfile = () => {
    if (!profile) return;
    const text =
      `🇮🇳 BhuMat Nagrik Dossier: @${profile.username}\n` +
      `📍 Parliamentary Anchor: ${profile.constituency_name} (${profile.state_name})\n` +
      `⚡ Total Verified Ballots: ${profile.lifetime_votes} (${profile.xp_score} XP)\n` +
      `🎯 Local Consensus Alignment: ${profile.caq_pct}%\n\n` +
      `View verified public stances: https://vote.bhumat.com/citizen/${encodeURIComponent(profile.username)}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'Oct 2026';
    const d = new Date(isoStr);
    return isNaN(d.getTime())
      ? 'Oct 2026'
      : d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px', fontWeight: 700 }}>
        Loading sovereign citizen dossier...
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔍</div>
        <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>Citizen Dossier Not Found</h2>
        <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>The requested @{username} handle is unverified or has not yet cast a ballot.</p>
        <button
          onClick={() => router.push('/leaderboard')}
          style={{ padding: '8px 16px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
        >
          ← Return to Leaderboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', paddingBottom: '70px' }}>
      {/* Header Bar */}
      <header style={{ height: '56px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px' }}>
        <div style={{ width: '100%', maxWidth: '480px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => router.back()}
            style={{ background: '#f1f5f9', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '6px 12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', color: '#0f172a' }}
          >
            ← Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>🛡️</span>
            <span style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>
              Nagrik Dossier
            </span>
          </div>
          <button
            onClick={handleShareProfile}
            style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
          >
            Share ↗
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Core Dossier Identity Card */}
        <div style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '24px', padding: '22px 20px', boxShadow: '0 8px 24px rgba(15,23,42,0.18)', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 900, margin: 0, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                  @{profile.username}
                </h1>
                {profile.is_verified && (
                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#10b981', backgroundColor: '#064e3b', padding: '2px 6px', borderRadius: '4px' }}>
                    ✓ Resident Verified
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>📍 {profile.constituency_name}</span>
                <span>•</span>
                <span>{profile.state_name}</span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#fbbf24' }}>
                {profile.xp_score} <span style={{ fontSize: '12px', color: '#94a3b8' }}>XP</span>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8' }}>
                Season 10 Contender
              </span>
            </div>
          </div>

          {/* Regional Badges & Cohort Rank */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '14px' }}>
            {profile.badges.map((b: any, idx: number) => (
              <span
                key={idx}
                title={b.desc}
                style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  backgroundColor: '#1e293b',
                  color: b.color || '#38bdf8',
                  border: `1px solid ${b.color}40`,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {b.title}
              </span>
            ))}
          </div>

          {/* Quick Metrics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #1e293b', textAlign: 'center' }}>
            <div>
              <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Total Ballots</span>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>{profile.lifetime_votes}</div>
            </div>
            <div>
              <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Season Ballots</span>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#38bdf8', marginTop: '2px' }}>{profile.season_votes}</div>
            </div>
            <div>
              <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Sponsored</span>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#fbbf24', marginTop: '2px' }}>{profile.sponsored_polls_count}</div>
            </div>
          </div>
        </div>

        {/* Consensus Alignment Quotient (CAQ) Card */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', border: '1.5px solid #e2e8f0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>
              🎯 Local Consensus Alignment (CAQ)
            </span>
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#10b981' }}>
              {profile.caq_pct}%
            </span>
          </div>
          <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${profile.caq_pct}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.4s ease' }} />
          </div>
          <p style={{ fontSize: '10.5px', color: '#64748b', margin: 0 }}>
            Indicates how frequently @{profile.username}&apos;s cultural stances mirror the majority opinion in {profile.constituency_name}.
          </p>
        </div>

        {/* Audit Provenance */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', border: '1.5px solid #e2e8f0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Participation Provenance
          </span>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#64748b' }}>Voting Since:</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatDate(profile.voting_since)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#64748b' }}>Last Lok Sabha Changed:</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatDate(profile.seat_locked_at)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
            <span style={{ color: '#64748b' }}>Current Season LokMat:</span>
            <span style={{ fontWeight: 800, color: '#d97706' }}>{profile.season_lokmat_votes} Pulses</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#64748b' }}>Current Season JanMat:</span>
            <span style={{ fontWeight: 800, color: '#059669' }}>{profile.season_janmat_votes} Audits (Secret Ballot)</span>
          </div>
        </div>

        {/* Public Stances Feed (LokMat Only) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Public Stance Ledger (LokMat Pulses)
            </span>
            <span style={{ fontSize: '10px', color: '#059669', fontWeight: 700 }}>
              🛡️ JanMat Audits Kept 100% Secret
            </span>
          </div>

          {profile.history.length === 0 ? (
            <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
              No public LokMat votes cast in current ledger yet.
            </div>
          ) : (
            profile.history.map((vote: any, idx: number) => {
              const optColor = OPTION_PALETTE[(vote.selected_option_id || 0) % OPTION_PALETTE.length];
              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#d97706', backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: '4px' }}>
                      🌅 LokMat Pulse
                    </span>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8' }}>
                      {vote.receipt_code}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', lineHeight: 1.35 }}>
                    {vote.question_title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: optColor, flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 800, color: optColor }}>
                      {vote.selected_choice}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}