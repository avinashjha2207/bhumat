'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from './utils/supabaseClient';
import TickerTape from './TickerTape';

interface PollOption {
  id: number;
  text_en: string;
  text_hi: string;
}

interface Poll {
  id: string;
  category: string;
  title_en: string;
  title_hi: string;
  options: PollOption[];
  is_active?: boolean;
}

interface PreprojectedSeat {
  id: string;
  name: string;
  state: string;
  d: string;
}

interface PollExpandedViewProps {
  poll: Poll;
  userSeatName?: string;
  userState?: string;
  userVotedOptionIdx?: number | null;
  lang: 'EN' | 'HI';
  onBack: () => void;
}

// 1st: Orange, 2nd: Green, 3rd: Sky Blue, 4th: Purple
const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];
const UNPOLLED_SEAT_COLOR = '#cbd5e1';
const RADAR_GREEN = '#10b981';

let CACHED_PREPROJECTED_SEATS: PreprojectedSeat[] | null = null;

export default function PollExpandedView({
  poll,
  userSeatName = '',
  userState = '',
  userVotedOptionIdx = null,
  lang,
  onBack
}: PollExpandedViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gridSectionRef = useRef<HTMLDivElement | null>(null);

  const [seats, setSeats] = useState<PreprojectedSeat[]>(CACHED_PREPROJECTED_SEATS || []);
  const [loading, setLoading] = useState(!CACHED_PREPROJECTED_SEATS);
  const [viewMode, setViewMode] = useState<'map' | 'grid'>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [userBeaconCoords, setUserBeaconCoords] = useState<{ x: number; y: number } | null>(null);

  // Floating Dynamic Tooltip: Hidden by default, tracks pointer
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredSeat, setHoveredSeat] = useState<{
    name: string;
    state: string;
    totalVotes: number;
    leadingOptText: string;
    leadingOptColor: string;
    leadingVotes: number;
    isFortified: boolean;
  } | null>(null);

  // Live tallies from the pre-aggregated constituency matrix
  const [tallies, setTallies] = useState<any[]>([]);

  useEffect(() => {
    if (CACHED_PREPROJECTED_SEATS) {
      setSeats(CACHED_PREPROJECTED_SEATS);
      setLoading(false);
      return;
    }

    fetch('/india_pc_preprojected.json')
      .then((res) => res.json())
      .then((data) => {
        CACHED_PREPROJECTED_SEATS = data;
        setSeats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Vector map fetch error:', err);
        setLoading(false);
      });
  }, []);

  async function loadTallies() {
    try {
      const { data, error } = await supabase
        .from('constituency_tallies')
        .select('*')
        .eq('poll_id', poll.id);

      if (data && !error) {
        setTallies(data);
      }
    } catch (e) {
      console.warn('PollExpanded tally fetch error:', e);
    }
  }

  useEffect(() => {
    loadTallies();

    const channel = supabase
      .channel(`expanded_tallies_${poll.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'constituency_tallies', filter: `poll_id=eq.${poll.id}` },
        () => {
          loadTallies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [poll.id]);

  const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanUserSeat = clean(userSeatName);
  const cleanUserState = clean(userState);

  const isUserSeat = (seat: PreprojectedSeat) => {
    if (!cleanUserSeat) return false;
    const cId = clean(seat.id);
    const cName = clean(seat.name);
    return cId.includes(cleanUserSeat) || cName.includes(cleanUserSeat) || cleanUserSeat.includes(cName);
  };

  const userOptionColor = userVotedOptionIdx !== null && userVotedOptionIdx !== undefined
    ? OPTION_PALETTE[userVotedOptionIdx % OPTION_PALETTE.length]
    : OPTION_PALETTE[0];

  // Mathematical aggregation directly from constituency_tallies
  const { nationalStats, stateStats, seatStats, seatMap, stateTable } = useMemo(() => {
    const optCount = Math.max(poll.options.length, 2);
    const natBreakdown = new Array(optCount).fill(0);
    const stBreakdown = new Array(optCount).fill(0);

    let natTotal = 0;
    let stTotal = 0;

    const sMap: Record<string, any> = {};
    const stateMap: Record<string, { total: number; breakdown: number[]; seatsFortified: number; totalSeats: number }> = {};
    let targetSeatRecord: any = null;

    tallies.forEach((row) => {
      const cSeat = clean(row.constituency_name);
      const cState = clean(row.state_name);
      const rowTotal = Number(row.total_votes || 0);

      sMap[cSeat] = row;

      natTotal += rowTotal;
      for (let i = 0; i < optCount; i++) {
        natBreakdown[i] += Number(row[`opt_${i}_votes`] || 0);
      }

      if (cState === cleanUserState) {
        stTotal += rowTotal;
        for (let i = 0; i < optCount; i++) {
          stBreakdown[i] += Number(row[`opt_${i}_votes`] || 0);
        }
      }

      if (cSeat === cleanUserSeat) {
        targetSeatRecord = row;
      }

      const stName = row.state_name || 'Other';
      if (!stateMap[stName]) {
        stateMap[stName] = { total: 0, breakdown: new Array(optCount).fill(0), seatsFortified: 0, totalSeats: 0 };
      }
      stateMap[stName].total += rowTotal;
      if (Boolean(row.is_fortified) || rowTotal >= 50) {
        stateMap[stName].seatsFortified += 1;
      }
      for (let i = 0; i < optCount; i++) {
        stateMap[stName].breakdown[i] += Number(row[`opt_${i}_votes`] || 0);
      }
    });

    // Fallback if citizen voted locally but network record hasn't landed yet
    if (userVotedOptionIdx !== null && (!targetSeatRecord || Number(targetSeatRecord.total_votes || 0) === 0)) {
      if (natTotal === 0) {
        natTotal = 1;
        natBreakdown[userVotedOptionIdx] = 1;
      }
      if (stTotal === 0) {
        stTotal = 1;
        stBreakdown[userVotedOptionIdx] = 1;
      }
      targetSeatRecord = {
        total_votes: 1,
        leading_option: userVotedOptionIdx,
        is_tie: false,
        is_fortified: false
      };
    }

    const resolveVerdict = (arr: number[], total: number) => {
      if (total === 0) return { title: '0 Ballots', color: '#64748b', pct: 0, votes: 0 };
      const maxVotes = Math.max(...arr);
      const winners = arr.map((v, i) => (v === maxVotes ? i : -1)).filter((i) => i !== -1);
      const pct = Math.round((maxVotes / total) * 100);
      if (winners.length > 1) {
        return { title: '⚖️ Split (Tie)', color: '#64748b', pct, votes: maxVotes };
      }
      const opt = poll.options[winners[0]];
      return {
        title: opt ? opt.text_en.split('/')[0].trim() : `Option ${winners[0] + 1}`,
        color: OPTION_PALETTE[winners[0] % OPTION_PALETTE.length],
        pct,
        votes: maxVotes
      };
    };

    const optBars = natBreakdown.map((votes) => {
      const pct = natTotal > 0 ? Math.round((votes / natTotal) * 100) : 0;
      return { votes, pct };
    });

    const localSeatTotal = Number(targetSeatRecord?.total_votes || 0);
    const localLeadIdx = userVotedOptionIdx !== null ? userVotedOptionIdx : Number(targetSeatRecord?.leading_option || 0);
    const localOpt = poll.options[localLeadIdx];
    const localVerdict = {
      title: localSeatTotal > 0 && localOpt ? localOpt.text_en.split('/')[0].trim() : '0 Ballots',
      color: localSeatTotal > 0 ? OPTION_PALETTE[localLeadIdx % OPTION_PALETTE.length] : '#64748b',
      pct: localSeatTotal > 0 ? 100 : 0,
      total: localSeatTotal
    };

    return {
      nationalStats: { total: natTotal, optBars, ...resolveVerdict(natBreakdown, natTotal) },
      stateStats: { total: stTotal, ...resolveVerdict(stBreakdown, stTotal) },
      seatStats: localVerdict,
      seatMap: sMap,
      stateTable: Object.entries(stateMap).sort((a, b) => b[1].total - a[1].total)
    };
  }, [tallies, cleanUserState, cleanUserSeat, userVotedOptionIdx, poll.options]);

  const getSeatColor = (seat: PreprojectedSeat) => {
    // User seat always glows with chosen option color
    if (isUserSeat(seat)) return userOptionColor;
    const row = seatMap[clean(seat.name)];
    if (!row || Number(row.total_votes || 0) < 50) return UNPOLLED_SEAT_COLOR;
    return OPTION_PALETTE[Number(row.leading_option || 0) % OPTION_PALETTE.length];
  };

  useEffect(() => {
    if (!seats.length || !svgRef.current || !cleanUserSeat) return;
    const matched = seats.find(isUserSeat);
    if (matched) {
      const el = svgRef.current.querySelector(`#pc-${matched.id}`) as SVGGraphicsElement;
      if (el && el.getBBox) {
        try {
          const bbox = el.getBBox();
          setUserBeaconCoords({
            x: Number((bbox.x + bbox.width / 2).toFixed(1)),
            y: Number((bbox.y + bbox.height / 2).toFixed(1))
          });
        } catch (e) {}
      }
    }
  }, [seats, cleanUserSeat]);

  const handleToggleView = (mode: 'map' | 'grid') => {
    setViewMode(mode);
    if (mode === 'grid') {
      setTimeout(() => {
        gridSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  };

  const filteredSearchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return seats.filter((s) => s.name.toLowerCase().includes(q) || s.state.toLowerCase().includes(q)).slice(0, 6);
  }, [searchQuery, seats]);

  return (
    <div
      suppressHydrationWarning
      style={{
        minHeight: '100dvh',
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <style>{`
        @keyframes nationalCalmWave {
          0% { r: 6px; opacity: 0.95; stroke-width: 3.5px; }
          100% { r: 40px; opacity: 0; stroke-width: 0.2px; }
        }
        .national-beacon-ring {
          animation: nationalCalmWave 3s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes nationalSeatGlow {
          0% { stroke-width: 2.5px; filter: drop-shadow(0 0 3px ${userOptionColor}66); }
          50% { stroke-width: 5px; filter: drop-shadow(0 0 16px ${userOptionColor}cc); }
          100% { stroke-width: 2.5px; filter: drop-shadow(0 0 3px ${userOptionColor}66); }
        }
        .user-seat-glowing-national {
          animation: nationalSeatGlow 3s infinite ease-in-out !important;
          stroke: ${userOptionColor} !important;
          fill: ${userOptionColor} !important;
        }
        @keyframes pulseDot {
          0% { transform: scale(0.85); opacity: 0.6; }
          50% { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0.6; }
        }
        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #ef4444;
          display: inline-block;
          animation: pulseDot 1.8s infinite ease-in-out;
        }
      `}</style>

      {/* Floating Dynamic Tooltip that moves with the mouse */}
      {hoveredSeat && cursorPos && (
        <div
          style={{
            position: 'fixed',
            left: `${cursorPos.x + 14}px`,
            top: `${cursorPos.y + 14}px`,
            pointerEvents: 'none',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: '10px',
            fontSize: '11px',
            zIndex: 100,
            boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxSizing: 'border-box',
            maxWidth: '240px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 800, fontSize: '12px', color: '#ffffff' }}>{hoveredSeat.name}</span>
            <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>{hoveredSeat.state}</span>
          </div>
          
          <div style={{ fontSize: '11px', fontWeight: 800, color: hoveredSeat.leadingOptColor, marginTop: '2px' }}>
            {hoveredSeat.totalVotes > 0 ? `Leading: ${hoveredSeat.leadingOptText} (${hoveredSeat.leadingVotes})` : '0 ballots cast'}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px', fontSize: '9.5px' }}>
            <span style={{ color: '#6ee7b7' }}>Total: {hoveredSeat.totalVotes}</span>
            <span style={{ color: hoveredSeat.isFortified ? '#34d399' : '#fcd34d' }}>
              {hoveredSeat.isFortified ? '● Quorum Met' : `Pending (${hoveredSeat.totalVotes}/50)`}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        style={{
          width: '100%',
          maxWidth: '480px',
          height: '56px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxSizing: 'border-box'
        }}
      >
        <button
          onClick={onBack}
          style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
        >
          {lang === 'HI' ? '← वापस' : '← Back'}
        </button>

        <span style={{ fontSize: '10px', fontWeight: 800, color: poll.category === 'JanMat' ? '#059669' : '#d97706', backgroundColor: poll.category === 'JanMat' ? '#ecfdf5' : '#fffbeb', border: `1px solid ${poll.category === 'JanMat' ? '#a7f3d0' : '#fde68a'}`, padding: '3px 10px', borderRadius: '999px', textTransform: 'uppercase' }}>
          {poll.category} AUDIT • 543 SEATS
        </span>

        <div style={{ display: 'flex', gap: '2px', backgroundColor: '#f1f5f9', padding: '2px', borderRadius: '8px' }}>
          <button
            onClick={() => handleToggleView('map')}
            style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: viewMode === 'map' ? (poll.category === 'JanMat' ? '#059669' : '#d97706') : 'transparent', color: viewMode === 'map' ? '#ffffff' : '#64748b', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }}
          >
            {lang === 'HI' ? 'मानचित्र' : 'Map'}
          </button>
          <button
            onClick={() => handleToggleView('grid')}
            style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: viewMode === 'grid' ? (poll.category === 'JanMat' ? '#059669' : '#d97706') : 'transparent', color: viewMode === 'grid' ? '#ffffff' : '#64748b', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }}
          >
            {lang === 'HI' ? 'ग्रिड' : 'Grid'}
          </button>
        </div>
      </header>

      <div style={{ width: '100%', maxWidth: '480px', marginTop: '4px' }}>
        <TickerTape activePoll={poll} lang={lang} />
      </div>

      <div style={{ maxWidth: '480px', width: '100%', padding: '12px 14px 80px 14px', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box' }}>
        
        {/* Question Header */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px 16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <span className="live-dot" />
            <span style={{ fontSize: '11px', fontWeight: 900, color: '#ef4444', letterSpacing: '0.04em' }}>LIVE</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>•</span>
            <span style={{ fontSize: '11px', fontWeight: 800, color: poll.category === 'JanMat' ? '#059669' : '#d97706' }}>{poll.category} {lang === 'HI' ? 'प्रश्न' : 'Question'}</span>
          </div>

          <h1 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', lineHeight: '1.5' }}>
            {lang === 'EN' ? poll.title_en : poll.title_hi}
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '6px 0 0 0', lineHeight: '1.6' }}>
            {lang === 'EN' ? poll.title_hi : poll.title_en}
          </p>
        </div>

        {/* Options Distribution Bars: Standardized Option Palette */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {poll.options.map((opt, idx) => {
              const stat = nationalStats.optBars[idx] || { pct: 0, votes: 0 };
              const color = OPTION_PALETTE[idx % OPTION_PALETTE.length];
              return (
                <div key={opt.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: color, marginTop: '4px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                          {lang === 'EN' ? opt.text_en : opt.text_hi}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                          {lang === 'EN' ? opt.text_hi : opt.text_en}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color, marginLeft: '8px', flexShrink: 0 }}>
                      {stat.pct}% <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>({stat.votes.toLocaleString()})</span>
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${stat.pct}%`, height: '100%', backgroundColor: color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3-Column Scorecard: Live Option-Tied Color Verification */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px 12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '12px 6px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Bharat</div>
            <div style={{ fontSize: '12px', fontWeight: 900, color: nationalStats.color, marginTop: '6px' }}>{nationalStats.title}</div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>{nationalStats.pct}%</div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>{nationalStats.total} {nationalStats.total === 1 ? 'Vote' : 'Votes'}</div>
          </div>
          <div style={{ backgroundColor: '#f8fafc', padding: '12px 6px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{userState || 'State'}</div>
            <div style={{ fontSize: '12px', fontWeight: 900, color: stateStats.color, marginTop: '6px' }}>{stateStats.title}</div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>{stateStats.pct}%</div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>{stateStats.total} {stateStats.total === 1 ? 'Vote' : 'Votes'}</div>
          </div>
          <div style={{ backgroundColor: '#f8fafc', padding: '12px 6px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{userSeatName || 'Lok Sabha'}</div>
            <div style={{ fontSize: '12px', fontWeight: 900, color: seatStats.color, marginTop: '6px' }}>{seatStats.title}</div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>{seatStats.pct}%</div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>{seatStats.total} {seatStats.total === 1 ? 'Vote' : 'Votes'}</div>
          </div>
        </div>

        {/* View Mode: Map or Grid */}
        {viewMode === 'map' ? (
          <div
            ref={containerRef}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '14px',
              position: 'relative',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              boxSizing: 'border-box',
              width: '100%',
              overflow: 'hidden'
            }}
          >
            <div style={{ width: '100%', marginBottom: '12px', position: 'relative', boxSizing: 'border-box' }}>
              <input
                type="text"
                placeholder={lang === 'HI' ? '🔍 क्षेत्र या 543 सीटें खोजें...' : '🔍 Search region / 543 seats...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '12px', backgroundColor: '#f8fafc', outline: 'none', fontWeight: 600 }}
              />

              {filteredSearchMatches.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 60, overflow: 'hidden' }}>
                  {filteredSearchMatches.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSearchQuery(s.name);
                        const row = seatMap[clean(s.name)];
                        const total = Number(row?.total_votes || 0);
                        const winIdx = Number(row?.leading_option || 0);
                        const leadOpt = poll.options[winIdx];
                        setHoveredSeat({
                          name: s.name,
                          state: s.state,
                          totalVotes: total,
                          leadingOptText: total > 0 && leadOpt ? leadOpt.text_en.split('/')[0].trim() : '0 ballots cast',
                          leadingOptColor: total > 0 ? OPTION_PALETTE[winIdx % OPTION_PALETTE.length] : '#64748b',
                          leadingVotes: Number(row?.leading_votes || 0),
                          isFortified: Boolean(row?.is_fortified) || total >= 50
                        });
                        setCursorPos({ x: typeof window !== 'undefined' ? window.innerWidth / 2 : 200, y: 350 });
                      }}
                      style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                    >
                      <span>{s.name}</span>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>{s.state}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {loading ? (
              <div style={{ height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                {lang === 'HI' ? '543 संसदीय सीमाएं लोड हो रही हैं...' : 'Rendering 543 Parliamentary Boundaries...'}
              </div>
            ) : (
              <svg
                ref={svgRef}
                viewBox="0 0 800 950"
                style={{ width: '100%', height: 'auto', display: 'block', backgroundColor: '#ffffff' }}
                onMouseLeave={() => {
                  setHoveredSeat(null);
                  setCursorPos(null);
                }}
              >
                {seats.map((seat, index) => {
                  const row = seatMap[clean(seat.name)];
                  const total = Number(row?.total_votes || 0);
                  const winIdx = Number(row?.leading_option || 0);
                  const leadOpt = poll.options[winIdx];
                  const isSearched = searchQuery.trim() && seat.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
                  const userMatched = isUserSeat(seat);

                  return (
                    <path
                      key={`${seat.id}-${index}`}
                      id={`pc-${seat.id}`}
                      d={seat.d}
                      fill={isSearched ? '#fca5a5' : getSeatColor(seat)}
                      stroke={isSearched ? '#e11d48' : userMatched ? userOptionColor : '#94a3b8'}
                      strokeWidth={isSearched ? 2.5 : userMatched ? 3.5 : 0.65}
                      className={userMatched ? 'user-seat-glowing-national' : ''}
                      style={{ cursor: 'pointer', transition: 'fill 0.2s ease, stroke 0.2s ease' }}
                      onMouseMove={(e) => {
                        setCursorPos({ x: e.clientX, y: e.clientY });
                        setHoveredSeat({
                          name: seat.name,
                          state: seat.state,
                          totalVotes: total,
                          leadingOptText: total > 0 && leadOpt ? leadOpt.text_en.split('/')[0].trim() : '0 ballots cast',
                          leadingOptColor: total > 0 ? OPTION_PALETTE[winIdx % OPTION_PALETTE.length] : '#64748b',
                          leadingVotes: Number(row?.leading_votes || 0),
                          isFortified: Boolean(row?.is_fortified) || total >= 50
                        });
                      }}
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        if (touch) {
                          setCursorPos({ x: touch.clientX, y: touch.clientY });
                        }
                        setHoveredSeat({
                          name: seat.name,
                          state: seat.state,
                          totalVotes: total,
                          leadingOptText: total > 0 && leadOpt ? leadOpt.text_en.split('/')[0].trim() : '0 ballots cast',
                          leadingOptColor: total > 0 ? OPTION_PALETTE[winIdx % OPTION_PALETTE.length] : '#64748b',
                          leadingVotes: Number(row?.leading_votes || 0),
                          isFortified: Boolean(row?.is_fortified) || total >= 50
                        });
                      }}
                    />
                  );
                })}

                {userBeaconCoords && (
                  <g pointerEvents="none">
                    <circle cx={userBeaconCoords.x} cy={userBeaconCoords.y} r={18} fill="none" stroke={RADAR_GREEN} strokeWidth={3.5} className="national-beacon-ring" />
                    <circle cx={userBeaconCoords.x} cy={userBeaconCoords.y} r={5.5} fill="#065f46" stroke="#ffffff" strokeWidth={2} />
                  </g>
                )}
              </svg>
            )}

            <button
              onClick={() => {
                const targetUrl = `https://vote.bhumat.com/audit/${poll.id}?seat=${encodeURIComponent(userSeatName || 'Bharat')}&state=${encodeURIComponent(userState || 'India')}`;
                const msg = `🇮🇳 *BHUMAT PUBLIC OPINION AUDIT*\n\n"${poll.title_en}"\n\n📍 *${userSeatName || 'Bharat'} Leading Opinion:* ${seatStats.title} (${seatStats.pct}%)\n🗳️ *Total Ballots:* ${seatStats.total.toLocaleString()} Votes\n\nLive National Map:\n${targetUrl}`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              style={{ width: '100%', height: '46px', marginTop: '14px', padding: '12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <span>📲</span> {lang === 'HI' ? 'व्हाट्सएप पर स्कोरकार्ड साझा करें (1-टैप)' : 'Share Scoreboard to WhatsApp (1-Tap)'}
            </button>
          </div>
        ) : (
          /* Grid View Section with Smooth Scroll Anchor */
          <div ref={gridSectionRef} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
            <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
              <div style={{ minWidth: '580px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 1.2fr 1.8fr 1.1fr', gap: '8px', padding: '8px 10px', fontSize: '10px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                  <span>STATE / UT</span>
                  <span>TOTAL VOTES</span>
                  <span>QUORUM MET</span>
                  <span>STATE VERDICT</span>
                  <span style={{ textAlign: 'right' }}>VERDICT VOTES</span>
                </div>

                {stateTable.map(([stName, stData]) => {
                  const maxVotes = Math.max(...stData.breakdown);
                  const leadIdx = stData.breakdown.indexOf(maxVotes);
                  const leadOpt = poll.options[leadIdx];
                  const optText = stData.total > 0 && leadOpt ? leadOpt.text_en.split('/')[0].trim() : 'Option';
                  const totalVotes = Number(stData.total || 0);

                  return (
                    <div key={stName} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 1.2fr 1.8fr 1.1fr', gap: '8px', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 10px', fontSize: '11px', marginTop: '6px' }}>
                      <span style={{ fontWeight: 800, color: '#0f172a' }}>{stName}</span>
                      <span style={{ color: poll.category === 'JanMat' ? '#059669' : '#d97706', fontWeight: 700 }}>{totalVotes.toLocaleString()}</span>
                      <span style={{ color: '#059669', fontWeight: 700 }}>{stData.seatsFortified} seats</span>

                      {totalVotes > 0 ? (
                        <>
                          <span style={{ color: '#0f172a', fontWeight: 800 }}>{optText}</span>
                          <span style={{ color: '#059669', fontWeight: 800, textAlign: 'right' }}>{maxVotes.toLocaleString()}</span>
                        </>
                      ) : (
                        <span style={{ gridColumn: 'span 2', fontSize: '9.5px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, textAlign: 'center' }}>
                          0 Ballots Polled
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}