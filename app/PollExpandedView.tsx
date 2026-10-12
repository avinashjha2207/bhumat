'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { supabase, safeStorage } from './utils/supabaseClient';
import TickerTape from './TickerTape';

const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];
const UNPOLLED_SEAT_COLOR = '#e2e8f0';
const TIE_COLOR = '#475569';
const RADAR_GREEN = '#10b981';

interface Poll {
  id: string;
  category: string;
  title_en: string;
  title_hi: string;
  target_region_type?: string;
  starts_at?: string;
  participation_mode?: string;
  recurrence?: string;
  options: { id: number; text_en: string; text_hi: string }[];
}

interface PollExpandedViewProps {
  poll: Poll;
  userSeatName?: string;
  userState?: string;
  userVotedOptionIdx: number | null;
  lang: 'EN' | 'HI';
  onBack: () => void;
  initialTallies?: any[];
}

export default function PollExpandedView({
  poll,
  userSeatName,
  userState,
  userVotedOptionIdx,
  lang,
  onBack,
  initialTallies = []
}: PollExpandedViewProps) {
  const [viewMode, setViewMode] = useState<'MAP' | 'GRID'>('MAP');
  const [tallies, setTallies] = useState<any[]>(initialTallies);
  const [geoData, setGeoData] = useState<any | null>(null);
  const [isLoadingGeo, setIsLoadingGeo] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [hoveredSeat, setHoveredSeat] = useState<any | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [livePulses, setLivePulses] = useState<Record<string, { color: string; expiresAt: number }>>({});
  const [activeInfoPopup, setActiveInfoPopup] = useState<{ title: string; desc: string; x: number; y: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridSectionRef = useRef<HTMLDivElement>(null);
  const zoomBehaviorRef = useRef<any>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const triggerInfoPopup = (title: string, desc: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 360;
    const clampedX = Math.max(16, Math.min(rect.left - 80, screenW - 250));
    const clampedY = Math.max(70, rect.bottom + 8);
    setActiveInfoPopup({ title, desc, x: clampedX, y: clampedY });
  };

  const handleSwitchToGrid = () => {
    setViewMode('GRID');
    setTimeout(() => {
      gridSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // 1. Realtime Subscriptions
  useEffect(() => {
    async function fetchTallies() {
      const { data, error } = await supabase
        .from('constituency_tallies')
        .select('*')
        .eq('poll_id', poll.id);

      if (!error && data) {
        setTallies(data);
      }
    }

    fetchTallies();

    const tallyChannel = supabase
      .channel(`expanded_tallies_${poll.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'constituency_tallies',
          filter: `poll_id=eq.${poll.id}`
        },
        (payload: any) => {
          if (payload.new) {
            setTallies((prev) => {
              const existingIdx = prev.findIndex(
                (t) =>
                  clean(t.constituency_name) === clean(payload.new.constituency_name) &&
                  clean(t.state_name) === clean(payload.new.state_name)
              );
              if (existingIdx >= 0) {
                const next = [...prev];
                next[existingIdx] = payload.new;
                return next;
              }
              return [...prev, payload.new];
            });
          }
        }
      )
      .subscribe();

    const ballotPulseChannel = supabase
      .channel(`expanded_ballot_pulse_${poll.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ballot_box',
          filter: `poll_id=eq.${poll.id}`
        },
        (payload: any) => {
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

    const pulseInterval = setInterval(() => {
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
      supabase.removeChannel(ballotPulseChannel);
      clearInterval(pulseInterval);
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, [poll.id]);

  // 2. Fetch GeoJSON
  useEffect(() => {
    let isMounted = true;
    setIsLoadingGeo(true);

    fetch('/india_pc_2019_simplified.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Primary geojson not found');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setGeoData(data);
          setIsLoadingGeo(false);
        }
      })
      .catch(() => {
        fetch('/india_pc_preprojected.json')
          .then((res) => res.json())
          .then((data) => {
            if (isMounted) {
              setGeoData(data);
              setIsLoadingGeo(false);
            }
          })
          .catch(() => {
            if (isMounted) setIsLoadingGeo(false);
          });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Tally Processing & Color Normalization
  const { tallyMap, bharatStats, stateStats, userSeatStats, formattedGridList } = useMemo(() => {
    const map = new Map<string, any>();
    let totalBharatVotes = 0;
    const bharatCounts: Record<number, number> = {};
    poll.options.forEach((_, idx) => (bharatCounts[idx] = 0));

    let totalStateVotes = 0;
    const stateCounts: Record<number, number> = {};
    poll.options.forEach((_, idx) => (stateCounts[idx] = 0));

    let userFound: any = null;
    const grid: any[] = [];

    tallies.forEach((row: any) => {
      const counts: Record<number, number> = {};
      let seatTotal = 0;

      poll.options.forEach((_, idx) => {
        const c = Number(row[`option_${idx}_votes`] ?? row[`opt_${idx}_votes`]) || 0;
        counts[idx] = c;
        seatTotal += c;

        bharatCounts[idx] = (bharatCounts[idx] || 0) + c;
        totalBharatVotes += c;

        if (userState && clean(row.state_name) === clean(userState)) {
          stateCounts[idx] = (stateCounts[idx] || 0) + c;
          totalStateVotes += c;
        }
      });

      let highestVotes = -1;
      let winningOptIdx: number | null = null;
      let isTie = false;

      Object.entries(counts).forEach(([idxStr, count]) => {
        const optIdx = parseInt(idxStr, 10);
        if (count > highestVotes) {
          highestVotes = count;
          winningOptIdx = optIdx;
          isTie = false;
        } else if (count === highestVotes && count > 0) {
          isTie = true;
        }
      });

      const leadingPct = seatTotal > 0 && highestVotes > 0 ? Math.round((highestVotes / seatTotal) * 100) : 0;
      const leadingText = isTie
        ? 'Split Mat (Tie)'
        : winningOptIdx !== null && highestVotes > 0
        ? (lang === 'HI' ? poll.options[winningOptIdx]?.text_hi : poll.options[winningOptIdx]?.text_en) || 'Awaiting'
        : 'Awaiting Ballots';

      const entry = {
        seatName: row.constituency_name,
        stateName: row.state_name,
        totalVotes: seatTotal,
        leadingOptionIdx: isTie ? null : winningOptIdx,
        leadingOptionText: leadingText,
        leadingPercent: leadingPct,
        isTie,
        trend: seatTotal >= 20 ? (lang === 'HI' ? 'सत्यापित' : 'Fortified') : (lang === 'HI' ? 'रुझान' : 'Early Trend')
      };

      const key = `${clean(row.constituency_name)}___${clean(row.state_name)}`;
      map.set(key, entry);
      grid.push(entry);

      if (
        userSeatName &&
        userState &&
        clean(row.constituency_name) === clean(userSeatName) &&
        clean(row.state_name) === clean(userState)
      ) {
        userFound = entry;
      }
    });

    const evaluateAggregate = (counts: Record<number, number>, total: number) => {
      if (total === 0) return { total: 0, text: 'Awaiting Ballots', percent: 0, color: '#64748b' };
      let highest = -1;
      let winningIdx: number | null = null;
      let tie = false;

      Object.entries(counts).forEach(([idxStr, c]) => {
        const idx = parseInt(idxStr, 10);
        if (c > highest) {
          highest = c;
          winningIdx = idx;
          tie = false;
        } else if (c === highest && c > 0) {
          tie = true;
        }
      });

      const pct = Math.round((highest / total) * 100);
      const text = tie
        ? 'Split Mat (Tie)'
        : winningIdx !== null && highest > 0
        ? (lang === 'HI' ? poll.options[winningIdx]?.text_hi : poll.options[winningIdx]?.text_en) || 'Split Mat'
        : 'Awaiting Ballots';

      const color = tie
        ? TIE_COLOR
        : winningIdx !== null
        ? OPTION_PALETTE[winningIdx % OPTION_PALETTE.length]
        : '#64748b';

      return { total, text, percent: pct, color };
    };

    return {
      tallyMap: map,
      bharatStats: evaluateAggregate(bharatCounts, totalBharatVotes),
      stateStats: evaluateAggregate(stateCounts, totalStateVotes),
      userSeatStats: userFound,
      formattedGridList: grid
    };
  }, [tallies, poll.options, userSeatName, userState, lang]);

  // 4. SVG Renderer with Zoom, Traveling Cursor Tooltip, and Search Highlighting
  useEffect(() => {
    if (viewMode !== 'MAP' || !geoData || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth ? Math.min(containerRef.current.clientWidth - 28, 440) : 380;
    const height = Math.round(width * 1.25);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const projection = d3.geoIdentity()
      .reflectY(true)
      .fitExtent([[12, 12], [width - 12, height - 12]], geoData);

    const pathGenerator = d3.geoPath().projection(projection);

    const zoomGroup = svg.append('g').attr('class', 'zoom-viewport');

    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .translateExtent([[0, 0], [width, height]])
      .on('zoom', (event: any) => {
        zoomGroup.attr('transform', event.transform);
      });

    svg.call(zoom as any);
    zoomBehaviorRef.current = { zoom, svg };

    const searchKeyword = clean(searchFilter);

    // Constituencies
    zoomGroup.selectAll('path.constituency')
      .data(geoData.features || [])
      .enter()
      .append('path')
      .attr('class', 'constituency')
      .attr('d', (d: any) => pathGenerator(d))
      .attr('fill', (d: any) => {
        const props = d.properties || {};
        const seat = clean(props.PC_NAME || props.pc_name || props.name || '');
        if (livePulses[seat]) return livePulses[seat].color;

        const state = clean(props.ST_NAME || props.st_name || props.state || '');
        const match = tallyMap.get(`${seat}___${state}`);

        if (!match || match.totalVotes === 0) return UNPOLLED_SEAT_COLOR;
        if (match.isTie) return TIE_COLOR;
        if (match.leadingOptionIdx !== null) return OPTION_PALETTE[match.leadingOptionIdx % OPTION_PALETTE.length];
        return UNPOLLED_SEAT_COLOR;
      })
      .attr('stroke', (d: any) => {
        const props = d.properties || {};
        const seat = clean(props.PC_NAME || props.pc_name || props.name || '');
        const state = clean(props.ST_NAME || props.st_name || props.state || '');
        if (searchKeyword && (seat.includes(searchKeyword) || state.includes(searchKeyword))) {
          return '#0f172a';
        }
        return '#ffffff';
      })
      .attr('stroke-width', (d: any) => {
        const props = d.properties || {};
        const seat = clean(props.PC_NAME || props.pc_name || props.name || '');
        const state = clean(props.ST_NAME || props.st_name || props.state || '');
        if (searchKeyword && (seat.includes(searchKeyword) || state.includes(searchKeyword))) {
          return 2.0;
        }
        return 0.4;
      })
      .attr('opacity', (d: any) => {
        if (!searchKeyword) return 1;
        const props = d.properties || {};
        const seat = clean(props.PC_NAME || props.pc_name || props.name || '');
        const state = clean(props.ST_NAME || props.st_name || props.state || '');
        return seat.includes(searchKeyword) || state.includes(searchKeyword) ? 1 : 0.35;
      })
      .style('cursor', 'pointer')
      .on('mousemove touchmove', function (event: any, d: any) {
        const props = d.properties || {};
        const seatName = props.PC_NAME || props.pc_name || props.name || 'Unknown';
        const stateName = props.ST_NAME || props.st_name || props.state || 'Bharat';
        const key = `${clean(seatName)}___${clean(stateName)}`;
        const match = tallyMap.get(key);

        setHoveredSeat({
          seatName,
          stateName,
          leadingOptionText: match ? match.leadingOptionText : 'Awaiting Ballots',
          totalVotes: match ? match.totalVotes : 0
        });

        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const clientX = event.clientX || (event.touches?.[0]?.clientX ?? rect.left + width / 2);
          const clientY = event.clientY || (event.touches?.[0]?.clientY ?? rect.top + 100);
          setTooltipPos({
            x: Math.max(16, Math.min(clientX - rect.left - 70, width - 160)),
            y: Math.max(10, clientY - rect.top - 80)
          });
        }

        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = setTimeout(() => {
          setHoveredSeat(null);
          setTooltipPos(null);
        }, 4000);
      })
      .on('mouseleave touchend', function () {
        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = setTimeout(() => {
          setHoveredSeat(null);
          setTooltipPos(null);
        }, 2500);
      });

    // Realtime live shockwave rings
    Object.keys(livePulses).forEach((pulsingSeatKey) => {
      const feat = (geoData.features || []).find((f: any) => {
        const p = f.properties || {};
        const pName = clean(p.PC_NAME || p.pc_name || p.name || '');
        return pName === pulsingSeatKey;
      });
      if (feat) {
        const centroid = pathGenerator.centroid(feat);
        if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
          zoomGroup.append('circle')
            .attr('cx', centroid[0])
            .attr('cy', centroid[1])
            .attr('r', 10)
            .attr('fill', 'none')
            .attr('stroke', livePulses[pulsingSeatKey].color)
            .attr('stroke-width', 3)
            .attr('class', 'live-pop-shockwave-circle')
            .attr('pointer-events', 'none');
        }
      }
    });

    // Centroid radar ping on user's active home seat
    if (userSeatName) {
      const activeClean = clean(userSeatName);
      const homeFeat = (geoData.features || []).find((f: any) => {
        const p = f.properties || {};
        return clean(p.PC_NAME || p.pc_name || p.name || '') === activeClean;
      });
      if (homeFeat) {
        const centroid = pathGenerator.centroid(homeFeat);
        if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
          zoomGroup.append('circle')
            .attr('cx', centroid[0])
            .attr('cy', centroid[1])
            .attr('r', 14)
            .attr('fill', 'none')
            .attr('stroke', RADAR_GREEN)
            .attr('stroke-width', 2.5)
            .attr('class', 'home-seat-radar')
            .attr('pointer-events', 'none');
          zoomGroup.append('circle')
            .attr('cx', centroid[0])
            .attr('cy', centroid[1])
            .attr('r', 4.5)
            .attr('fill', '#065f46')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1.8)
            .attr('pointer-events', 'none');
        }
      }
    }
  }, [viewMode, geoData, tallyMap, livePulses, userSeatName, searchFilter]);

  const handleZoomReset = () => {
    if (zoomBehaviorRef.current && svgRef.current) {
      const { zoom, svg } = zoomBehaviorRef.current;
      svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
    }
  };

  const handleShareScoreboard = () => {
    const shareSeat = userSeatName || 'Bharat';
    const shareRef = safeStorage.getItem('bhumat_voter_token')?.slice(-6) || 'BM01';
    const targetUrl = `https://vote.bhumat.com?ref=${shareRef}`;

    const messageText =
      `🇮🇳 *BhuMat Sovereign Audit — ${shareSeat}*\n\n` +
      `*Question:* ${poll.title_en}\n` +
      `📍 Leading Stance: ${userSeatStats?.leadingOptionText || bharatStats.text}\n\n` +
      `Cast your ballot across all 543 Lok Sabha seats:\n${targetUrl}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`, '_blank');
  };

  const filteredGrid = useMemo(() => {
    if (!searchFilter.trim()) return formattedGridList;
    const q = clean(searchFilter);
    return formattedGridList.filter(
      (s) =>
        clean(s.seatName).includes(q) ||
        clean(s.stateName).includes(q) ||
        clean(s.leadingOptionText).includes(q)
    );
  }, [formattedGridList, searchFilter]);

  const getRecurrenceBadgeText = () => {
    const r = (poll.recurrence || 'monthly').toLowerCase();
    if (r === 'lifetime' || r === 'one_time') return '🔒 Sovereign One-Time';
    if (r.includes('day')) return '⚡ 24h Daily Rerun';
    if (r.includes('week')) return '📅 Weekly Pulse';
    return '📅 Monthly Sovereign Cycle';
  };

  const getNextWindowText = () => {
    const r = (poll.recurrence || 'monthly').toLowerCase();
    if (r === 'lifetime' || r === 'one_time') return 'Ballot active until cycle concludes';
    if (r.includes('day')) return 'Next ballot window unlocks tomorrow at 8:00 AM';
    if (r.includes('week')) return 'Next ballot window unlocks next Monday';
    return 'Next ballot window unlocks in Season 11 (Nov 2026)';
  };

  return (
    <div
      ref={containerRef}
      onClick={() => {
        setActiveInfoPopup(null);
        setHoveredSeat(null);
      }}
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <style>{`
        @keyframes radarExpandWave {
          0% { r: 5px; opacity: 0.95; stroke-width: 2.5px; }
          100% { r: 32px; opacity: 0; stroke-width: 0.3px; }
        }
        .home-seat-radar {
          animation: radarExpandWave 3s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes shockwavePulseRing {
          0% { r: 6px; opacity: 1; stroke-width: 4px; }
          100% { r: 38px; opacity: 0; stroke-width: 0.5px; }
        }
        .live-pop-shockwave-circle {
          animation: shockwavePulseRing 1.8s infinite ease-out;
        }
      `}</style>

      {/* Info Context Popup */}
      {activeInfoPopup && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: `${activeInfoPopup.x}px`,
            top: `${activeInfoPopup.y}px`,
            zIndex: 130,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '12px 14px',
            borderRadius: '12px',
            maxWidth: '240px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
            border: '1px solid #334155'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8', marginBottom: '4px' }}>
            {activeInfoPopup.title}
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.45 }}>
            {activeInfoPopup.desc}
          </div>
        </div>
      )}

      {/* Clean Sticky Header Centered Within App Bounds */}
      <header
        style={{
          height: '56px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 14px'
        }}
      >
        <div style={{ width: '100%', maxWidth: '460px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={onBack}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>

          <span
            onClick={(e) => triggerInfoPopup(
              `${poll.category} Sovereign Audit`,
              poll.category === 'JanMat'
                ? 'Cryptographic Secret Ballot. Decoupled from your identity, zero voter tokens stored on your ballot.'
                : 'Open Civic Pulse. Discloses cultural consensus patterns across all 543 Lok Sabha seats.',
              e
            )}
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: poll.category === 'JanMat' ? '#059669' : '#d97706',
              backgroundColor: poll.category === 'JanMat' ? '#ecfdf5' : '#fffbeb',
              padding: '4px 10px',
              borderRadius: '999px',
              border: `1px solid ${poll.category === 'JanMat' ? '#a7f3d0' : '#fde68a'}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>● {poll.category} AUDIT • 543 SEATS</span>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>ⓘ</span>
          </span>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setViewMode('MAP')}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'MAP' ? '#0f172a' : '#f1f5f9',
                color: viewMode === 'MAP' ? '#ffffff' : '#64748b',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Map
            </button>
            <button
              onClick={handleSwitchToGrid}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'GRID' ? '#0f172a' : '#f1f5f9',
                color: viewMode === 'GRID' ? '#ffffff' : '#64748b',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Grid
            </button>
          </div>
        </div>
      </header>

      {/* Live Ticker Tape */}
      <div style={{ padding: '8px 14px 0 14px', maxWidth: '460px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <TickerTape activePoll={poll} lang={lang} />
      </div>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '12px 14px', maxWidth: '460px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        
        {/* Card 1: Question Header & Recurrence Window */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '18px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '6px' }}>
              {getRecurrenceBadgeText()}
            </span>
            <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>
              {getNextWindowText()}
            </span>
          </div>

          <h2 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 8px 0', lineHeight: 1.45, color: '#0f172a' }}>
            {lang === 'EN' ? poll.title_en : poll.title_hi}
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0', lineHeight: 1.5 }}>
            {lang === 'EN' ? poll.title_hi : poll.title_en}
          </p>
        </div>

        {/* Card 2: Options Breakdown with Generous Spacing & Secret JanMat Handling */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '18px', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.04em' }}>
            National Preference Breakdown
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {poll.options.map((opt, idx) => {
              const optColor = OPTION_PALETTE[idx % OPTION_PALETTE.length];
              const optCount = tallies.reduce((sum, r) => sum + (Number(r[`option_${idx}_votes`] ?? r[`opt_${idx}_votes`]) || 0), 0);
              const optPct = bharatStats.total > 0 ? Math.round((optCount / bharatStats.total) * 100) : 0;
              const isUserChoice = poll.category !== 'JanMat' && userVotedOptionIdx === idx;

              const primaryText = lang === 'EN' ? opt.text_en : opt.text_hi;
              const secondaryText = lang === 'EN' ? opt.text_hi : opt.text_en;

              return (
                <div key={opt.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    
                    {/* Bilingual Options with 6px Spacing */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: optColor, marginTop: '4px', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>
                          {primaryText}
                        </span>
                        {secondaryText && secondaryText !== primaryText && (
                          <span style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.35 }}>
                            {secondaryText}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats and User Choice Tag */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginTop: '2px' }}>
                      {isUserChoice && (
                        <span style={{ fontSize: '10px', color: '#059669', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          ✓ You
                        </span>
                      )}
                      <span style={{ fontWeight: 800, color: optColor, minWidth: '34px', textAlign: 'right', fontSize: '13px' }}>
                        {optPct}%
                      </span>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${optPct}%`, height: '100%', backgroundColor: optColor, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 3: 3-Box Geo-Comparison Ledger */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
          {/* BHARAT */}
          <div
            onClick={(e) => triggerInfoPopup('Bharat Consensus', 'Aggregated tally across all 543 Lok Sabha seats nationwide.', e)}
            style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '10px 6px', textAlign: 'center', cursor: 'pointer' }}
          >
            <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#64748b' }}>BHARAT ⓘ</div>
            <div style={{ fontSize: '11.5px', fontWeight: 900, color: bharatStats.color, marginTop: '5px', lineHeight: 1.35 }}>
              {bharatStats.text}
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, marginTop: '4px' }}>
              {bharatStats.total} {bharatStats.total === 1 ? 'Vote' : 'Votes'}
            </div>
          </div>

          {/* STATE */}
          <div
            onClick={(e) => triggerInfoPopup('State Jurisdiction', 'Consensus aggregated strictly within your registered state boundary.', e)}
            style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '10px 6px', textAlign: 'center', cursor: 'pointer' }}
          >
            <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#64748b' }}>
              {userState ? userState.toUpperCase() : 'STATE'} ⓘ
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 900, color: stateStats.color, marginTop: '5px', lineHeight: 1.35 }}>
              {stateStats.text}
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, marginTop: '4px' }}>
              {stateStats.total} {stateStats.total === 1 ? 'Vote' : 'Votes'}
            </div>
          </div>

          {/* YOUR SEAT */}
          <div
            onClick={(e) => triggerInfoPopup('Constituency Sentiment', 'Direct sovereign tally for your specific parliamentary seat.', e)}
            style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '10px 6px', textAlign: 'center', cursor: 'pointer' }}
          >
            <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#64748b' }}>
              {userSeatName ? userSeatName.toUpperCase() : 'YOUR SEAT'} ⓘ
            </div>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 900,
                color: userSeatStats?.isTie
                  ? TIE_COLOR
                  : userSeatStats?.leadingOptionIdx !== null && userSeatStats?.leadingOptionIdx !== undefined
                  ? OPTION_PALETTE[userSeatStats.leadingOptionIdx % OPTION_PALETTE.length]
                  : '#64748b',
                marginTop: '5px',
                lineHeight: 1.35
              }}
            >
              {userSeatStats?.leadingOptionText || 'Awaiting'}
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, marginTop: '4px' }}>
              {userSeatStats?.totalVotes || 0} {userSeatStats?.totalVotes === 1 ? 'Vote' : 'Votes'}
            </div>
          </div>
        </div>

        {/* View Mode: Map or Grid */}
        {viewMode === 'MAP' ? (
          <div
            style={{
              position: 'relative',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '14px',
              marginBottom: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  placeholder="🔍 Search region (e.g. Darbhanga, Buxar)..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '9px 34px 9px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '12px',
                    backgroundColor: '#f8fafc'
                  }}
                />
                {searchFilter && (
                  <button
                    onClick={() => setSearchFilter('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontWeight: 800
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                onClick={handleZoomReset}
                title="Reset Map Zoom & Pan"
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '8px 10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#475569',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                ⟲ Reset
              </button>
            </div>

            {isLoadingGeo && (
              <div style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '12px' }}>
                Rendering Sovereign Drishti Grid...
              </div>
            )}

            <svg ref={svgRef} style={{ width: '100%', height: 'auto', display: isLoadingGeo ? 'none' : 'block', touchAction: 'none' }} />

            {/* Traveling Cursor Floating Tooltip */}
            {hoveredSeat && tooltipPos && (
              <div
                style={{
                  position: 'absolute',
                  left: `${tooltipPos.x}px`,
                  top: `${tooltipPos.y}px`,
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  pointerEvents: 'none',
                  zIndex: 30,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                  border: '1px solid #334155'
                }}
              >
                <div style={{ fontWeight: 800, color: '#38bdf8' }}>{hoveredSeat.seatName}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>{hoveredSeat.stateName}</div>
                <div style={{ marginTop: '2px', fontWeight: 700 }}>{hoveredSeat.leadingOptionText}</div>
                <div style={{ fontSize: '9.5px', color: '#64748b' }}>Total: {hoveredSeat.totalVotes}</div>
              </div>
            )}
          </div>
        ) : (
          <div ref={gridSectionRef} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '16px', marginBottom: '14px' }}>
            <div style={{ position: 'relative', width: '100%', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="🔍 Filter seat by name or state..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 34px 10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px'
                }}
              />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 800
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* 5-Column Structured Table */}
            <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11.5px' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>
                  <tr style={{ borderBottom: '1.5px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '8px 6px', fontWeight: 800 }}>Constituency</th>
                    <th style={{ padding: '8px 6px', fontWeight: 800 }}>State</th>
                    <th style={{ padding: '8px 6px', fontWeight: 800 }}>Leading Stance</th>
                    <th style={{ padding: '8px 6px', fontWeight: 800 }}>Trend</th>
                    <th style={{ padding: '8px 6px', fontWeight: 800, textAlign: 'right' }}>Ballots</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGrid.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: '24px 0' }}>
                        No constituency records found.
                      </td>
                    </tr>
                  ) : (
                    filteredGrid.map((item) => {
                      const color = item.isTie
                        ? TIE_COLOR
                        : item.leadingOptionIdx !== null && item.leadingOptionIdx !== undefined
                        ? OPTION_PALETTE[item.leadingOptionIdx % OPTION_PALETTE.length]
                        : '#64748b';

                      return (
                        <tr key={`${item.seatName}_${item.stateName}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 6px', fontWeight: 800, color: '#0f172a' }}>{item.seatName}</td>
                          <td style={{ padding: '8px 6px', color: '#64748b' }}>{item.stateName}</td>
                          <td style={{ padding: '8px 6px', fontWeight: 700, color }}>
                            <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: color, marginRight: '5px' }} />
                            {item.leadingOptionText}
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: item.totalVotes >= 20 ? '#ecfdf5' : '#f8fafc', color: item.totalVotes >= 20 ? '#059669' : '#64748b', fontWeight: 700 }}>
                              {item.trend}
                            </span>
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            {item.totalVotes}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WhatsApp Share Button */}
        <button
          onClick={handleShareScoreboard}
          style={{
            width: '100%',
            height: '48px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            borderRadius: '14px',
            border: 'none',
            fontSize: '13.5px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(16,185,129,0.2)'
          }}
        >
          <span>📲</span>
          <span>Share Scoreboard to WhatsApp (1-Tap)</span>
        </button>
      </main>
    </div>
  );
}