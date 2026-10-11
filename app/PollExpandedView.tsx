'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import * as d3 from 'd3';
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
  current_cycle?: string;
  recurrence?: string;
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
  initialTallies?: any[];
}

const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];
const UNPOLLED_SEAT_COLOR = '#cbd5e1';
const TIE_COLOR = '#475569';
const RADAR_GREEN = '#10b981';

let CACHED_PREPROJECTED_SEATS: PreprojectedSeat[] | null = null;

export default function PollExpandedView({
  poll,
  userSeatName = '',
  userState = '',
  userVotedOptionIdx = null,
  lang,
  onBack,
  initialTallies = []
}: PollExpandedViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mapGroupRef = useRef<SVGGElement | null>(null);
  const gridSectionRef = useRef<HTMLDivElement | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [seats, setSeats] = useState<PreprojectedSeat[]>(CACHED_PREPROJECTED_SEATS || []);
  const [loading, setLoading] = useState(!CACHED_PREPROJECTED_SEATS);
  const [viewMode, setViewMode] = useState<'map' | 'grid'>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [userBeaconCoords, setUserBeaconCoords] = useState<{ x: number; y: number } | null>(null);
  const [currentZoomScale, setCurrentZoomScale] = useState(1);

  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredSeat, setHoveredSeat] = useState<{
    name: string;
    state: string;
    totalVotes: number;
    leadingOptText: string;
    leadingOptColor: string;
    leadingVotes: number;
    isTie: boolean;
  } | null>(null);

  const [tallies, setTallies] = useState<any[]>(initialTallies);
  const [livePulses, setLivePulses] = useState<Record<string, { color: string; expiresAt: number }>>({});

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

    const tallyChannel = supabase
      .channel(`expanded_tallies_live_${poll.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'constituency_tallies', filter: `poll_id=eq.${poll.id}` },
        () => loadTallies()
      )
      .subscribe();

    const ballotChannel = supabase
      .channel(`expanded_ballot_pulse_${poll.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ballot_box', filter: `poll_id=eq.${poll.id}` },
        (payload) => {
          const newBallot = payload.new;
          if (newBallot && newBallot.constituency_name) {
            const cleanSeat = clean(newBallot.constituency_name);
            const optColor = OPTION_PALETTE[Number(newBallot.selected_option || 0) % OPTION_PALETTE.length];
            setLivePulses((prev) => ({
              ...prev,
              [cleanSeat]: { color: optColor, expiresAt: Date.now() + 3800 }
            }));
          }
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      const now = Date.now();
      setLivePulses((prev) => {
        let changed = false;
        const next: Record<string, { color: string; expiresAt: number }> = {};
        Object.entries(prev).forEach(([key, val]) => {
          if (val.expiresAt > now) {
            next[key] = val;
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 800);

    return () => {
      supabase.removeChannel(tallyChannel);
      supabase.removeChannel(ballotChannel);
      clearInterval(interval);
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

  const { nationalStats, stateStats, seatStats, seatMap, stateTable, resolvedHomeColor } = useMemo(() => {
    const optCount = Math.max(poll.options.length, 2);
    const natBreakdown = new Array(optCount).fill(0);
    const stBreakdown = new Array(optCount).fill(0);

    let natTotal = 0;
    let stTotal = 0;

    const sMap: Record<string, any> = {};
    const stateMap: Record<string, { total: number; breakdown: number[]; totalSeats: number }> = {};
    let targetSeatRecord: any = null;

    seats.forEach((seat) => {
      const st = seat.state || 'Other';
      if (!stateMap[st]) {
        stateMap[st] = { total: 0, breakdown: new Array(optCount).fill(0), totalSeats: 0 };
      }
      stateMap[st].totalSeats += 1;
    });

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
        targetSeatRecord = { ...row };
      }

      const stName = row.state_name || 'Other';
      if (!stateMap[stName]) {
        stateMap[stName] = { total: 0, breakdown: new Array(optCount).fill(0), totalSeats: 0 };
      }
      stateMap[stName].total += rowTotal;
      for (let i = 0; i < optCount; i++) {
        stateMap[stName].breakdown[i] += Number(row[`opt_${i}_votes`] || 0);
      }
    });

    if (userVotedOptionIdx !== null && userVotedOptionIdx !== undefined) {
      if (!targetSeatRecord || Number(targetSeatRecord.total_votes || 0) === 0) {
        targetSeatRecord = {
          total_votes: 1,
          leading_option: userVotedOptionIdx,
          is_tie: false,
          [`opt_${userVotedOptionIdx}_votes`]: 1
        };
        sMap[cleanUserSeat] = targetSeatRecord;
        if (natTotal === 0) natTotal = 1;
        if (stTotal === 0) stTotal = 1;
        natBreakdown[userVotedOptionIdx] = Math.max(natBreakdown[userVotedOptionIdx], 1);
        stBreakdown[userVotedOptionIdx] = Math.max(stBreakdown[userVotedOptionIdx], 1);
      }
    }

    let homeColor = UNPOLLED_SEAT_COLOR;
    if (targetSeatRecord && Number(targetSeatRecord.total_votes || 0) > 0) {
      if (targetSeatRecord.is_tie) {
        homeColor = TIE_COLOR;
      } else {
        const lead = Number(targetSeatRecord.leading_option || 0);
        homeColor = OPTION_PALETTE[lead % OPTION_PALETTE.length];
      }
    } else if (userVotedOptionIdx !== null && userVotedOptionIdx !== undefined) {
      homeColor = OPTION_PALETTE[userVotedOptionIdx % OPTION_PALETTE.length];
    }

    const resolveBreakdown = (arr: number[], total: number) => {
      if (total === 0) return { title: '0 Ballots', color: '#64748b', pct: 0, isTie: false };
      const maxV = Math.max(...arr);
      const topIndices = arr.map((v, i) => (v === maxV ? i : -1)).filter((i) => i !== -1);
      const isTie = topIndices.length > 1;
      const pct = Math.round((maxV / total) * 100);

      if (isTie) {
        return { title: lang === 'HI' ? '⚖️ खंडित मत (टाई)' : '⚖️ Split Mat (Tie)', color: TIE_COLOR, pct, isTie: true };
      }

      const winIdx = topIndices[0];
      const opt = poll.options[winIdx];
      const title = opt ? opt.text_en.trim() : `Option ${winIdx + 1}`;
      return { title, color: OPTION_PALETTE[winIdx % OPTION_PALETTE.length], pct, isTie: false };
    };

    const natVerdict = resolveBreakdown(natBreakdown, natTotal);
    const stVerdict = resolveBreakdown(stBreakdown, stTotal);

    const localTotal = Number(targetSeatRecord?.total_votes || 0);
    let localVerdict: any;

    if (localTotal === 0) {
      localVerdict = { title: '0 Ballots', color: '#64748b', pct: 0, total: 0 };
    } else if (targetSeatRecord?.is_tie) {
      localVerdict = { title: lang === 'HI' ? '⚖️ खंडित मत (टाई)' : '⚖️ Split Mat (Tie)', color: TIE_COLOR, pct: 50, total: localTotal };
    } else {
      const localLeadIdx = Number(targetSeatRecord?.leading_option || 0);
      const localOpt = poll.options[localLeadIdx];
      localVerdict = {
        title: localOpt ? localOpt.text_en.trim() : `Option ${localLeadIdx + 1}`,
        color: OPTION_PALETTE[localLeadIdx % OPTION_PALETTE.length],
        pct: 100,
        total: localTotal
      };
    }

    const optBars = natBreakdown.map((votes) => {
      const pct = natTotal > 0 ? Math.round((votes / natTotal) * 100) : 0;
      return { pct };
    });

    return {
      nationalStats: { optBars, ...natVerdict, total: natTotal },
      stateStats: { ...stVerdict, total: stTotal },
      seatStats: localVerdict,
      seatMap: sMap,
      stateTable: Object.entries(stateMap).sort((a, b) => b[1].total - a[1].total),
      resolvedHomeColor: homeColor
    };
  }, [tallies, seats, cleanUserState, cleanUserSeat, userVotedOptionIdx, poll.options, lang]);

  const getSeatColor = (seat: PreprojectedSeat) => {
    const cleanSeatName = clean(seat.name);
    if (livePulses[cleanSeatName]) {
      return livePulses[cleanSeatName].color;
    }

    if (isUserSeat(seat)) return resolvedHomeColor;
    const row = seatMap[cleanSeatName];
    if (!row || Number(row.total_votes || 0) === 0) return UNPOLLED_SEAT_COLOR;

    if (row.is_tie) return TIE_COLOR;
    return OPTION_PALETTE[Number(row.leading_option || 0) % OPTION_PALETTE.length];
  };

  const getSeatOpacity = (seat: PreprojectedSeat) => {
    const cleanSeatName = clean(seat.name);
    if (livePulses[cleanSeatName]) return 1.0;

    const row = seatMap[cleanSeatName];
    const total = isUserSeat(seat)
      ? Number(seatStats.total || 1)
      : Number(row?.total_votes || 0);

    if (total === 0) return 1;
    if (total < 10) return 0.85;
    if (total < 50) return 0.94;
    return 1.0;
  };

  useEffect(() => {
    if (!svgRef.current || !mapGroupRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(mapGroupRef.current);

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 6])
      .translateExtent([
        [-100, -100],
        [900, 1050]
      ])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setCurrentZoomScale(event.transform.k);
      });

    svg.call(zoomBehavior);
  }, [loading]);

  const resetZoom = () => {
    if (!svgRef.current || !mapGroupRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.interrupt();
    svg.call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity
    );
    setCurrentZoomScale(1);
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
      }, 50);
    }
  };

  const triggerTooltip = (data: any, clientX: number, clientY: number) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);

    const screenW = typeof window !== 'undefined' ? window.innerWidth : 360;
    const clampedX = Math.max(16, Math.min(clientX + 14, screenW - 230));
    const clampedY = Math.max(70, clientY - 30);

    setCursorPos({ x: clampedX, y: clampedY });
    setHoveredSeat(data);

    tooltipTimeoutRef.current = setTimeout(() => {
      setHoveredSeat(null);
      setCursorPos(null);
    }, 6000);
  };

  const clearTooltip = () => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setHoveredSeat(null);
    setCursorPos(null);
  };

  const filteredSearchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return seats
      .filter((s) => s.name.toLowerCase().includes(q) || s.state.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? -1 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? -1 : 1;
        return aStarts - bStarts;
      })
      .slice(0, 6);
  }, [searchQuery, seats]);

  const handleSelectSearchedSeat = (s: PreprojectedSeat) => {
    (document.activeElement as HTMLElement)?.blur();
    setSearchQuery(s.name);

    const row = seatMap[clean(s.name)];
    const total = Number(row?.total_votes || 0);
    const isTie = Boolean(row?.is_tie);
    const winIdx = Number(row?.leading_option || 0);
    const leadOpt = poll.options[winIdx];

    triggerTooltip({
      name: s.name,
      state: s.state,
      totalVotes: total,
      leadingOptText: isTie
        ? 'Split Mat (Tie)'
        : leadOpt ? leadOpt.text_en.trim() : 'Awaiting Ballots',
      leadingOptColor: isTie
        ? TIE_COLOR
        : total > 0 ? OPTION_PALETTE[winIdx % OPTION_PALETTE.length] : '#64748b',
      leadingVotes: Number(row?.leading_votes || 0),
      isTie
    }, typeof window !== 'undefined' ? window.innerWidth / 2 : 200, 350);
  };

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
          0% { stroke-width: 2.5px; filter: drop-shadow(0 0 3px rgba(16, 185, 129, 0.35)); opacity: 0.85; }
          50% { stroke-width: 4.8px; filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.95)); opacity: 1; }
          100% { stroke-width: 2.5px; filter: drop-shadow(0 0 3px rgba(16, 185, 129, 0.35)); opacity: 0.85; }
        }
        .user-seat-glowing-national {
          animation: nationalSeatGlow 2.6s infinite ease-in-out !important;
        }
        @keyframes liveDotPulseSlow {
          0% { opacity: 0.35; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0.35; transform: scale(0.92); }
        }
        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #ef4444;
          display: inline-block;
          animation: liveDotPulseSlow 2.4s infinite ease-in-out;
        }
        @keyframes nationalLiveFlash {
          0% { filter: brightness(1.75); }
          50% { filter: brightness(1.35); }
          100% { filter: brightness(1); }
        }
        .national-live-pulse-path {
          animation: nationalLiveFlash 3.8s ease-out forwards;
        }
      `}</style>

      {hoveredSeat && cursorPos && (
        <div
          style={{
            position: 'fixed',
            left: `${cursorPos.x}px`,
            top: `${cursorPos.y}px`,
            pointerEvents: 'none',
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: '10px',
            fontSize: '11px',
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxSizing: 'border-box',
            maxWidth: '220px',
            transition: 'opacity 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 800, fontSize: '12px', color: '#ffffff' }}>{hoveredSeat.name}</span>
            <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>{hoveredSeat.state}</span>
          </div>
          
          <div style={{ fontSize: '11px', fontWeight: 800, color: hoveredSeat.leadingOptColor, marginTop: '2px' }}>
            {hoveredSeat.isTie
              ? '⚖️ Split Mat (Tie)'
              : hoveredSeat.totalVotes > 0 ? `Leading: ${hoveredSeat.leadingOptText} (${hoveredSeat.leadingVotes})` : 'Awaiting Ballots'}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px', fontSize: '9.5px' }}>
            <span style={{ color: '#6ee7b7' }}>Total: {hoveredSeat.totalVotes}</span>
            <span style={{ color: hoveredSeat.totalVotes >= 20 ? '#34d399' : '#fcd34d' }}>
              {hoveredSeat.totalVotes >= 20 ? '● Fortified' : '● Early Trend'}
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

      {/* Ticker */}
      <div style={{ width: '100%', maxWidth: '480px', padding: '0 14px', boxSizing: 'border-box', marginTop: '4px' }}>
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

          <h1 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', lineHeight: '1.45', wordBreak: 'break-word' }}>
            {lang === 'EN' ? poll.title_en : poll.title_hi}
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '6px 0 0 0', lineHeight: '1.5', wordBreak: 'break-word' }}>
            {lang === 'EN' ? poll.title_hi : poll.title_en}
          </p>
        </div>

        {/* Option Distribution Bars */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {poll.options.map((opt, idx) => {
              const stat = nationalStats.optBars[idx] || { pct: 0 };
              const color = OPTION_PALETTE[idx % OPTION_PALETTE.length];
              return (
                <div key={opt.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: color, marginTop: '4px', flexShrink: 0 }} />
                      <div style={{ wordBreak: 'break-word' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>
                          {lang === 'EN' ? opt.text_en : opt.text_hi}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>
                          {lang === 'EN' ? opt.text_hi : opt.text_en}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 800, color, flexShrink: 0 }}>
                      {stat.pct}%
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

        {/* 3-Box Scorecard */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px 12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '12px 6px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Bharat</div>
            <div style={{ fontSize: '12px', fontWeight: 900, color: nationalStats.color, marginTop: '6px', lineHeight: 1.35, wordBreak: 'break-word' }}>{nationalStats.title}</div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>{nationalStats.pct}%</div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>{nationalStats.total} {nationalStats.total === 1 ? 'Vote' : 'Votes'}</div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '12px 6px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{userState || 'State'}</div>
            <div style={{ fontSize: '12px', fontWeight: 900, color: stateStats.color, marginTop: '6px', lineHeight: 1.35, wordBreak: 'break-word' }}>{stateStats.title}</div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
              {stateStats.total > 0 ? `${stateStats.pct}%` : '0%'}
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
              {stateStats.total} {stateStats.total === 1 ? 'Vote' : 'Votes'}
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '12px 6px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{userSeatName || 'Lok Sabha'}</div>
            <div style={{ fontSize: '12px', fontWeight: 900, color: seatStats.color, marginTop: '6px', lineHeight: 1.35, wordBreak: 'break-word' }}>{seatStats.title}</div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
              {seatStats.total > 0 ? `${seatStats.pct}%` : '0%'}
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
              {seatStats.total} {seatStats.total === 1 ? 'Vote' : 'Votes'}
            </div>
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
            {/* Search Bar with '✕ Clear' button */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  placeholder={lang === 'HI' ? '🔍 क्षेत्र या 543 सीटें खोजें...' : '🔍 Search region / 543 seats...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 36px 10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    backgroundColor: '#f8fafc',
                    outline: 'none',
                    fontWeight: 600
                  }}
                />

                {searchQuery.trim() && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: 800
                    }}
                  >
                    ✕
                  </button>
                )}

                {filteredSearchMatches.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      backgroundColor: '#ffffff',
                      border: '1.5px solid #0284c7',
                      borderRadius: '10px',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                      zIndex: 999,
                      maxHeight: '180px',
                      overflowY: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      overscrollBehavior: 'contain'
                    }}
                  >
                    {filteredSearchMatches.map((s) => (
                      <div
                        key={s.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSearchedSeat(s);
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          handleSelectSearchedSeat(s);
                        }}
                        style={{
                          padding: '10px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#0f172a',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <span>{s.name}</span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{s.state}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {currentZoomScale > 1.05 && (
                <button
                  onClick={resetZoom}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#0284c7',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🔍 Reset ({Math.round(currentZoomScale * 100)}%)
                </button>
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
                style={{ width: '100%', height: 'auto', display: 'block', backgroundColor: '#ffffff', cursor: 'grab', touchAction: 'none' }}
                onMouseLeave={clearTooltip}
              >
                <g ref={mapGroupRef}>
                  {seats.map((seat, index) => {
                    const row = seatMap[clean(seat.name)];
                    const total = Number(row?.total_votes || 0);
                    const isTie = Boolean(row?.is_tie);
                    const winIdx = Number(row?.leading_option || 0);
                    const leadOpt = poll.options[winIdx];
                    const isSearched = searchQuery.trim() && seat.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
                    const userMatched = isUserSeat(seat);
                    const isPulse = Boolean(livePulses[clean(seat.name)]);

                    return (
                      <g key={`${seat.id}-${index}`}>
                        <path
                          id={`pc-${seat.id}`}
                          d={seat.d}
                          fill={isSearched ? '#fca5a5' : getSeatColor(seat)}
                          fillOpacity={getSeatOpacity(seat)}
                          stroke={isSearched ? '#e11d48' : isPulse ? livePulses[clean(seat.name)].color : userMatched ? resolvedHomeColor : '#94a3b8'}
                          strokeWidth={isSearched ? 2.5 : isPulse ? 3.5 : userMatched ? 3.5 : 0.65}
                          className={userMatched ? 'user-seat-glowing-national' : isPulse ? 'national-live-pulse-path' : ''}
                          style={{ cursor: 'pointer', transition: 'fill 0.25s ease, stroke 0.25s ease' }}
                          onMouseMove={(e) => {
                            triggerTooltip({
                              name: seat.name,
                              state: seat.state,
                              totalVotes: total,
                              leadingOptText: isTie
                                ? 'Split Mat (Tie)'
                                : leadOpt ? leadOpt.text_en.trim() : 'Awaiting Ballots',
                              leadingOptColor: isTie
                                ? TIE_COLOR
                                : total > 0 ? OPTION_PALETTE[winIdx % OPTION_PALETTE.length] : '#64748b',
                              leadingVotes: Number(row?.leading_votes || 0),
                              isTie
                            }, e.clientX, e.clientY);
                          }}
                          onTouchStart={(e) => {
                            const touch = e.touches[0];
                            if (touch) {
                              triggerTooltip({
                                name: seat.name,
                                state: seat.state,
                                totalVotes: total,
                                leadingOptText: isTie
                                  ? 'Split Mat (Tie)'
                                  : leadOpt ? leadOpt.text_en.trim() : 'Awaiting Ballots',
                                leadingOptColor: isTie
                                  ? TIE_COLOR
                                  : total > 0 ? OPTION_PALETTE[winIdx % OPTION_PALETTE.length] : '#64748b',
                                leadingVotes: Number(row?.leading_votes || 0),
                                isTie
                              }, touch.clientX, touch.clientY);
                            }
                          }}
                        />
                      </g>
                    );
                  })}

                  {userBeaconCoords && (
                    <g pointerEvents="none">
                      <circle cx={userBeaconCoords.x} cy={userBeaconCoords.y} r={18} fill="none" stroke={RADAR_GREEN} strokeWidth={3.5} className="national-beacon-ring" />
                      <circle cx={userBeaconCoords.x} cy={userBeaconCoords.y} r={5.5} fill="#065f46" stroke="#ffffff" strokeWidth={2} />
                    </g>
                  )}
                </g>
              </svg>
            )}

            <button
              onClick={() => {
                const targetUrl = `https://vote.bhumat.com/audit/${poll.id}?seat=${encodeURIComponent(userSeatName || 'Bharat')}&state=${encodeURIComponent(userState || 'India')}`;
                const msg = `🇮🇳 *BHUMAT PUBLIC OPINION AUDIT*\n\n"${poll.title_en}"\n\n📍 *${userSeatName || 'Bharat'} Status:* ${seatStats.title} (${seatStats.total} Ballots)\n\nLive National Map:\n${targetUrl}`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              style={{ width: '100%', height: '46px', marginTop: '14px', padding: '12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <span>📲</span> {lang === 'HI' ? 'व्हाट्सएप पर स्कोरकार्ड साझा करें (1-टैप)' : 'Share Scoreboard to WhatsApp (1-Tap)'}
            </button>
          </div>
        ) : (
          <div ref={gridSectionRef} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
            <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
              <div style={{ minWidth: '580px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 1.8fr 1.1fr', gap: '8px', padding: '8px 10px', fontSize: '10px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                  <span>STATE / UT</span>
                  <span>TOTAL VOTES</span>
                  <span>STATE LEADING MAT</span>
                  <span style={{ textAlign: 'right' }}>LEADING VOTES</span>
                </div>

                {stateTable.map(([stName, stData]) => {
                  const totalVotes = Number(stData.total || 0);
                  const maxVotes = Math.max(...stData.breakdown);
                  const winners = stData.breakdown.map((v, i) => (v === maxVotes && maxVotes > 0 ? i : -1)).filter((i) => i !== -1);
                  const isTie = winners.length > 1;

                  let optText = 'Awaiting Ballots';
                  let optColor = '#64748b';

                  if (totalVotes > 0) {
                    if (isTie) {
                      optText = '⚖️ Split Mat (Tie)';
                      optColor = TIE_COLOR;
                    } else {
                      const leadIdx = winners[0];
                      const leadOpt = poll.options[leadIdx];
                      optText = leadOpt ? leadOpt.text_en.trim() : `Option ${leadIdx + 1}`;
                      optColor = OPTION_PALETTE[leadIdx % OPTION_PALETTE.length];
                    }
                  }

                  return (
                    <div key={stName} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 1.8fr 1.1fr', gap: '8px', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 10px', fontSize: '11px', marginTop: '6px' }}>
                      <span style={{ fontWeight: 800, color: '#0f172a' }}>{stName}</span>
                      <span style={{ color: totalVotes > 0 ? '#0284c7' : '#94a3b8', fontWeight: 700 }}>{totalVotes.toLocaleString()}</span>
                      <span style={{ color: optColor, fontWeight: 800 }}>{optText}</span>
                      <span style={{ color: totalVotes > 0 ? optColor : '#94a3b8', fontWeight: 800, textAlign: 'right' }}>
                        {totalVotes > 0 ? maxVotes.toLocaleString() : '-'}
                      </span>
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