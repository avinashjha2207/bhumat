'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { toBlob } from 'html-to-image';
import { supabase, safeStorage } from './utils/supabaseClient';
import TickerTape from './TickerTape';
import { getCurrentCycleId } from './utils/cycleManager';
import MatParchiModal from './MatParchiModal';

const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];
const UNPOLLED_SEAT_COLOR = '#e2e8f0';
const TIE_COLOR = '#475569';
const RADAR_GREEN = '#10b981';

const TIER_HUE_MAP: Record<number, number> = {
  0: 24,
  1: 160,
  2: 199,
  3: 262
};

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return { h: 24, s: 95, l: 50 };
  const r = (num >> 16) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = Math.round(h * 60);
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function getConstituencyTierColor(optIdx: number | null, totalVotes: number, isTie: boolean, customHex?: string): string {
  if (totalVotes === 0) return UNPOLLED_SEAT_COLOR;
  if (isTie) {
    if (totalVotes >= 50) return '#1e293b';
    if (totalVotes >= 25) return '#334155';
    if (totalVotes >= 10) return '#475569';
    return '#64748b';
  }
  if (optIdx === null) return UNPOLLED_SEAT_COLOR;
  const baseHue = customHex ? hexToHsl(customHex).h : (TIER_HUE_MAP[optIdx % 4] ?? 24);
  if (totalVotes >= 150) return `hsl(${baseHue}, 100%, 42%)`;
  if (totalVotes >= 50)  return `hsl(${baseHue}, 95%, 48%)`;
  if (totalVotes >= 25)  return `hsl(${baseHue}, 75%, 60%)`;
  if (totalVotes >= 10)  return `hsl(${baseHue}, 55%, 72%)`;
  return `hsl(${baseHue}, 42%, 84%)`;
}

interface Poll {
  id: string;
  category: string;
  title_en: string;
  title_hi: string;
  target_region_type?: string;
  starts_at?: string;
  participation_mode?: string;
  recurrence?: string;
  current_cycle?: string;
  next_starts_at?: string;
  options: { id: number; text_en: string; text_hi: string; color?: string }[];
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
  const [selectedOptionFilter, setSelectedOptionFilter] = useState<number | null>(null);
  const [hoveredSeat, setHoveredSeat] = useState<any | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [livePulses, setLivePulses] = useState<Record<string, { color: string; expiresAt: number }>>({});
  const [activeInfoPopup, setActiveInfoPopup] = useState<{ title: string; desc: string; x: number; y: number } | null>(null);
  const infoPopupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mapTooltip, setMapTooltip] = useState<{
    seatName: string;
    stateName: string;
    totalVotes: number;
    leadingText: string;
    leadingColor: string;
    x: number;
    y: number;
  } | null>(null);
  

  const [consensusSummary, setConsensusSummary] = useState<{
    bharat: { total: number; lead_id: number; pct: number };
    state: { name: string; total: number; lead_id: number; pct: number };
    seat: { name: string; total: number; lead_id: number; pct: number; is_tie: boolean };
  } | null>(null);

  useEffect(() => {
  async function loadConsensus() {
    if (!poll?.id) return;
    try {
      const dynamicCycle = poll.participation_mode === 'recurring' 
        ? getCurrentCycleId(poll.recurrence, poll.starts_at) 
        : (poll.current_cycle || 'lifetime');

      const { data, error } = await supabase.rpc('get_poll_consensus_summary', {
        p_poll_id: poll.id,
        p_seat_name: userSeatName || 'Bharat',
        p_cycle_id: dynamicCycle
      });
      if (!error && data) {
        setConsensusSummary(data);
      }
    } catch (err) {
      console.error('Consensus summary fetch error:', err);
    }
  }
  loadConsensus();
}, [poll?.id, userSeatName, tallies]);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridSectionRef = useRef<HTMLDivElement>(null);
  const zoomBehaviorRef = useRef<any>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showParchi, setShowParchi] = useState(false);

  const PC_ALIASES: Record<string, string> = {
    'ahmadabad': 'ahmedabad',
    'ahmedabadeast': 'ahmedabadeast',
    'ahmedabadwest': 'ahmedabadwest',
    'ahmadabadeast': 'ahmedabadeast',
    'ahmadabadwest': 'ahmedabadwest',
    'bengaluru': 'bangalore',
    'bengalurusouth': 'bangaloresouth',
    'bengalurunorth': 'bangalorenorth',
    'bengalurucentral': 'bangalorecentral',
    'bengalururural': 'bangalorerural',
    'bangaloresouth': 'bangaloresouth',
    'bangalorenorth': 'bangalorenorth',
    'bangalorecentral': 'bangalorecentral',
    'bangalorerural': 'bangalorerural',
    'buldana': 'buldhana',
    'ferozepur': 'firozpur',
    'chhotaudepur': 'chhotaudaipur',
    'mumbai': 'mumbai',
    'bardhaman': 'bardhaman',
    'bardhamandurgapur': 'bardhamandurgapur',
    'bardhamanpurba': 'bardhamanpurba'
  };

  const clean = (s: string) => {
    const raw = (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return PC_ALIASES[raw] || raw;
  };

  const triggerInfoPopup = (title: string, desc: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (infoPopupTimeoutRef.current) clearTimeout(infoPopupTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 360;
    const clampedX = Math.max(14, Math.min(rect.left - 70, screenW - 215));
    const clampedY = Math.max(65, rect.bottom + 8);
    setActiveInfoPopup({ title, desc, x: clampedX, y: clampedY });
    infoPopupTimeoutRef.current = setTimeout(() => {
      setActiveInfoPopup(null);
    }, 3500);
  };

  const handleSwitchToGrid = () => {
    setViewMode('GRID');
    setTimeout(() => {
      gridSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

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

    const targetTable = poll.category === 'JanMat' ? 'janmat_anonymous_ballots' : 'lokmat_votes';
    const ballotPulseChannel = supabase
      .channel(`expanded_ballot_pulse_${poll.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: targetTable,
          filter: `poll_id=eq.${poll.id}`
        },
        (payload: any) => {
          const newBallot = payload.new;
          if (newBallot) {
            const rawSeat = newBallot.pc_id || newBallot.constituency_name || '';
            const cleanSeat = clean(rawSeat);
            const optIdx = Number(newBallot.selected_option_id ?? newBallot.selected_option ?? 0);
            const optColor = poll.options[optIdx]?.color || OPTION_PALETTE[optIdx % OPTION_PALETTE.length];
            if (cleanSeat) {
              setLivePulses((prev) => ({
                ...prev,
                [cleanSeat]: { color: optColor, expiresAt: Date.now() + 3800 }
              }));
            }
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

useEffect(() => {
    const handleDismissOnScroll = () => {
      setMapTooltip(null);
    };
    window.addEventListener('scroll', handleDismissOnScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleDismissOnScroll);
  }, []);

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

    const targetUserSeatClean = clean(userSeatName || '');
    const targetUserStateClean = clean(userState || '');

    tallies.forEach((row: any) => {
      const counts: Record<number, number> = {};
      const rowTotal = Number(row.total_votes || 0);
      let calculatedSum = 0;

      poll.options.forEach((_, idx) => {
        const c = Number(row[`opt_${idx}_votes`] ?? row[`option_${idx}_votes`]) || 0;
        counts[idx] = c;
        calculatedSum += c;
        bharatCounts[idx] = (bharatCounts[idx] || 0) + c;
      });

      const seatTotal = Math.max(rowTotal, calculatedSum);
      totalBharatVotes += seatTotal;

      const isCurrentState = targetUserStateClean && clean(row.state_name) === targetUserStateClean;
      if (isCurrentState) {
        poll.options.forEach((_, idx) => {
          stateCounts[idx] = (stateCounts[idx] || 0) + counts[idx];
        });
        totalStateVotes += seatTotal;
      }

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
        ? (lang === 'HI' ? 'खंडित मत (टाई)' : 'Split Mat (Tie)')
        : winningOptIdx !== null && highestVotes > 0
        ? (lang === 'HI' ? poll.options[winningOptIdx]?.text_hi : poll.options[winningOptIdx]?.text_en) || (lang === 'HI' ? 'प्रतीक्षारत' : 'Awaiting')
        : (lang === 'HI' ? 'मतदान की प्रतीक्षा' : 'Awaiting Ballots');

      let trendLabel = lang === 'HI' ? 'प्रारंभिक' : 'Early Trend';
      if (seatTotal >= 50) trendLabel = lang === 'HI' ? 'सत्यापित' : 'Fortified Quorum';
      else if (seatTotal >= 25) trendLabel = lang === 'HI' ? 'प्रगतिशील' : 'Trending Up';

      const entry = {
        seatName: row.constituency_name,
        stateName: row.state_name,
        totalVotes: seatTotal,
        leadingOptionIdx: isTie ? null : winningOptIdx,
        leadingOptionText: leadingText,
        leadingPercent: leadingPct,
        isTie,
        trend: trendLabel
      };

      const key = `${clean(row.constituency_name)}___${clean(row.state_name)}`;
      map.set(key, entry);
      grid.push(entry);

      if (
        targetUserSeatClean &&
        clean(row.constituency_name) === targetUserSeatClean &&
        (!targetUserStateClean || clean(row.state_name) === targetUserStateClean)
      ) {
        userFound = entry;
      }
    });

    const evaluateAggregate = (counts: Record<number, number>, total: number) => {
      if (total === 0) return { total: 0, text: lang === 'HI' ? 'मतदान की प्रतीक्षा' : 'Awaiting Ballots', percent: 0, color: '#64748b' };
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
        ? (lang === 'HI' ? 'खंडित मत (टाई)' : 'Split Mat (Tie)')
        : winningIdx !== null && highest > 0
        ? (lang === 'HI' ? poll.options[winningIdx]?.text_hi : poll.options[winningIdx]?.text_en) || (lang === 'HI' ? 'खंडित मत' : 'Split Mat')
        : (lang === 'HI' ? 'मतदान की प्रतीक्षा' : 'Awaiting Ballots');

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

        const customHex = match.leadingOptionIdx !== null ? poll.options[match.leadingOptionIdx]?.color : undefined;
return getConstituencyTierColor(match.leadingOptionIdx, match.totalVotes, match.isTie, customHex);
      })
      .attr('stroke', (d: any) => {
        const props = d.properties || {};
        const seat = clean(props.PC_NAME || props.pc_name || props.name || '');
        const state = clean(props.ST_NAME || props.st_name || props.state || '');
        if (userSeatName && clean(userSeatName) === seat) {
          return '#0284c7';
        }
        if (searchKeyword && (seat.includes(searchKeyword) || state.includes(searchKeyword))) {
          return '#0ea5e9';
        }
        const match = tallyMap.get(`${seat}___${state}`);
        if (match && match.totalVotes >= 50) return '#ffffff';
        return '#cbd5e1';
      })
      .attr('stroke-width', (d: any) => {
        const props = d.properties || {};
        const seat = clean(props.PC_NAME || props.pc_name || props.name || '');
        const state = clean(props.ST_NAME || props.st_name || props.state || '');
        if (userSeatName && clean(userSeatName) === seat) {
          return 2.8;
        }
        if (searchKeyword && (seat.includes(searchKeyword) || state.includes(searchKeyword))) {
          return 2.4;
        }
        const match = tallyMap.get(`${seat}___${state}`);
        if (match && match.totalVotes >= 50) return 0.9;
        return 0.35;
      })
      .attr('opacity', (d: any) => {
        const props = d.properties || {};
        const seat = clean(props.PC_NAME || props.pc_name || props.name || '');
        const state = clean(props.ST_NAME || props.st_name || props.state || '');
        const match = tallyMap.get(`${seat}___${state}`);

        if (selectedOptionFilter !== null) {
          if (!match || match.leadingOptionIdx !== selectedOptionFilter) {
            return 0.15;
          }
          return 1;
        }

        if (!searchKeyword) return 1;
        return seat.includes(searchKeyword) || state.includes(searchKeyword) ? 1 : 0.25;
      })
      .style('cursor', 'pointer')
      .on('click touchstart', function (event: any, d: any) {
        event.stopPropagation();
        const props = d.properties || {};
        const rawSeat = props.PC_NAME || props.pc_name || props.name || '';
        const rawState = props.ST_NAME || props.st_name || props.state || '';
        const seatName = rawSeat.trim() || (lang === 'HI' ? 'संसदीय क्षेत्र' : 'Constituency');
        const stateName = rawState.trim() || (lang === 'HI' ? 'भारत' : 'Bharat');

        // Resolve tally for this seat
        const tally = initialTallies.find(
          (t: any) => (t.constituency_name && t.constituency_name.toLowerCase() === seatName.toLowerCase()) ||
                      (t.pc_id && t.pc_id.toLowerCase() === seatName.toLowerCase())
        );

        const totalV = tally?.total_votes || 0;
        let leadingIdx = 0;
        if (tally && totalV > 0) {
          const v0 = tally.opt_0_votes || 0;
          const v1 = tally.opt_1_votes || 0;
          const v2 = tally.opt_2_votes || 0;
          const v3 = tally.opt_3_votes || 0;
          const maxV = Math.max(v0, v1, v2, v3);
          if (maxV === v1) leadingIdx = 1;
          else if (maxV === v2) leadingIdx = 2;
          else if (maxV === v3) leadingIdx = 3;
        }

        const opt = poll.options[leadingIdx] || poll.options[0];
        const optColor = OPTION_PALETTE[leadingIdx % OPTION_PALETTE.length];
        const optText = lang === 'HI' ? opt.text_hi : opt.text_en;

        const clientX = event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : window.innerWidth / 2);
        const clientY = event.clientY || (event.touches && event.touches[0] ? event.touches[0].clientY : 300);

        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);

        setMapTooltip({
          seatName,
          stateName,
          totalVotes: totalV,
          leadingText: totalV > 0 ? optText : (lang === 'HI' ? 'मतदान प्रतीक्षित' : 'Awaiting Ballots'),
          leadingColor: totalV > 0 ? optColor : '#64748b',
          x: Math.max(16, Math.min(clientX - 90, window.innerWidth - 200)),
          y: Math.max(80, clientY - 85)
        });

        tooltipTimeoutRef.current = setTimeout(() => {
          setMapTooltip(null);
        }, 5000);
      });

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
  }, [viewMode, geoData, tallyMap, livePulses, userSeatName, searchFilter, selectedOptionFilter, lang]);

  const handleZoomIn = () => {
    if (zoomBehaviorRef.current && svgRef.current) {
      const { zoom, svg } = zoomBehaviorRef.current;
      svg.transition().duration(300).call(zoom.scaleBy, 1.4);
    }
  };

  const handleZoomOut = () => {
    if (zoomBehaviorRef.current && svgRef.current) {
      const { zoom, svg } = zoomBehaviorRef.current;
      svg.transition().duration(300).call(zoom.scaleBy, 0.7);
    }
  };

  const handleZoomReset = () => {
    if (zoomBehaviorRef.current && svgRef.current) {
      const { zoom, svg } = zoomBehaviorRef.current;
      svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
    }
  };

  const handleShareScoreboard = () => {
    const shareSeat = userSeatName || (lang === 'HI' ? 'भारत' : 'Bharat');
    const shareRef = safeStorage.getItem('bhumat_voter_token')?.slice(-6) || 'BM01';
    const shareUrl = `https://vote.bhumat.com/poll/${poll.id}?seat=${encodeURIComponent(shareSeat)}&ref=${shareRef}&lang=${lang}`;
    const questionText = lang === 'HI' ? poll.title_hi : poll.title_en;
    const leadingStance = userSeatStats?.leadingOptionText || bharatStats.text;
    const leadingPct = userSeatStats?.leadingPercent || bharatStats.percent;

    const messageText = lang === 'HI'
      ? `🇮🇳 *भूमत संप्रभु जनमत — ${shareSeat}*\n\n` +
        `*प्रश्न:* ${questionText}\n` +
        `📍 *अग्रणी मत:* ${leadingStance} (${leadingPct}%)\n\n` +
        `अपने संसदीय क्षेत्र के आंकड़े देखें और अपना मत दर्ज करें:\n${shareUrl}`
      : `🇮🇳 *BhuMat Sovereign Audit — ${shareSeat}*\n\n` +
        `*Question:* ${questionText}\n` +
        `📍 *Leading Stance:* ${leadingStance} (${leadingPct}%)\n\n` +
        `See how your seat stands & cast your sovereign ballot:\n${shareUrl}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`, '_blank');
  };

  const handleShareMapImage = async () => {
    const targetElement = (svgRef.current as unknown as HTMLElement) || containerRef.current;
    if (!targetElement) return;
    try {
      const blob = await toBlob(targetElement, { backgroundColor: '#0f172a' });
      if (!blob) return;

      const file = new File([blob], `BhuMat_${userSeatName || 'Bharat'}_Drishti.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${userSeatName || 'Bharat'} Sovereign Drishti Map`,
          text: `Consensus map for ${poll.title_en} on BhuMat. Cast your vote: https://vote.bhumat.com/poll/${poll.id}?seat=${encodeURIComponent(userSeatName || 'Bharat')}`,
        });
      } else {
        const link = document.createElement('a');
        link.download = `BhuMat_${userSeatName || 'Bharat'}_Drishti.png`;
        link.href = URL.createObjectURL(blob);
        link.click();
      }
    } catch (err) {
      console.error('Snapshot capture error:', err);
    }
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
    if (r === 'lifetime' || r === 'one_time') return lang === 'HI' ? '🔒 एकमुश्त संप्रभु मत' : '🔒 Sovereign One-Time';
    if (r.includes('day')) return lang === 'HI' ? '⚡ 24 घंटे में पुनर्मत' : '⚡ 24h Daily Rerun';
    if (r.includes('week')) return lang === 'HI' ? '📅 साप्ताहिक पल्स' : '📅 Weekly Pulse';
    return lang === 'HI' ? '📅 मासिक संप्रभु चक्र' : '📅 Monthly Sovereign Cycle';
  };

  const getNextWindowText = () => {
    if (poll.next_starts_at) {
      const d = new Date(poll.next_starts_at);
      const formatted = d.toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' });
      return lang === 'HI' ? `अगला मतदान ${formatted} को खुलेगा` : `Next vote unlocks on ${formatted}`;
    }
    const r = (poll.recurrence || 'monthly').toLowerCase();
    if (r === 'lifetime' || r === 'one_time') {
      const d = poll.next_starts_at 
        ? new Date(poll.next_starts_at) 
        : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
      const dateFormatted = d.toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      return lang === 'HI' ? `मतदान चक्र समाप्ति: ${dateFormatted}` : `Ballot active until ${dateFormatted}`;
    }
    return lang === 'HI' ? 'अगला मतदान आगामी सत्र में खुलेगा' : 'Next ballot window unlocks next cycle';
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

      {activeInfoPopup && (
        <div
          onClick={() => setActiveInfoPopup(null)}
          style={{
            position: 'fixed',
            left: `${activeInfoPopup.x}px`,
            top: `${activeInfoPopup.y}px`,
            zIndex: 140,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '10px 12px',
            borderRadius: '10px',
            maxWidth: '220px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            border: '1px solid #334155',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#38bdf8', marginBottom: '3px' }}>
            {activeInfoPopup.title}
          </div>
          <div style={{ fontSize: '10.5px', color: '#cbd5e1', lineHeight: 1.4 }}>
            {activeInfoPopup.desc}
          </div>
        </div>
      )}

      {/* Header */}
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
              cursor: 'pointer',
              color: '#0f172a'
            }}
          >
            ← {lang === 'HI' ? 'वापस' : 'Back'}
          </button>

          <span
            onClick={(e) => triggerInfoPopup(
              `${poll.category} ${lang === 'HI' ? 'संप्रभु ऑडिट' : 'Sovereign Audit'}`,
              poll.category === 'JanMat'
                ? (lang === 'HI' ? 'गोपनीय मतपेटी। पहचान विहीन, शून्य टोकन संकलित।' : 'Cryptographic Secret Ballot. Decoupled from your identity, zero voter tokens stored on your ballot.')
                : (lang === 'HI' ? 'खुला सांस्कृतिक मत। 543 संसदीय क्षेत्रों में सांस्कृतिक रुझानों को दर्शाता है।' : 'Open Civic Pulse. Discloses cultural consensus patterns across all 543 Lok Sabha seats.'),
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
            <span>● {poll.category} AUDIT • 543 {lang === 'HI' ? 'सीटें' : 'SEATS'}</span>
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
              {lang === 'HI' ? 'नक्शा' : 'Map'}
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
              {lang === 'HI' ? 'तालिका' : 'Grid'}
            </button>
          </div>
        </div>
      </header>

      {/* Ticker Tape */}
      <div style={{ padding: '8px 14px 0 14px', maxWidth: '460px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <TickerTape key={`expanded_ticker_${poll.id}`} activePoll={poll} lang={lang} />
      </div>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '12px 14px', maxWidth: '460px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        
        {/* Card 1: Question Header & Cadence Window */}
        <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '18px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '6px' }}>
              {getRecurrenceBadgeText()}
            </span>
            <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>
              {getNextWindowText()}
            </span>
          </div>
          <h2 style={{ fontSize: '17.5px', fontWeight: 850, margin: '0 0 8px 0', lineHeight: 1.4, color: '#0f172a' }}>
            {lang === 'EN' ? poll.title_en : poll.title_hi}
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0', lineHeight: 1.5, fontWeight: 500 }}>
            {lang === 'EN' ? poll.title_hi : poll.title_en}
          </p>

          {poll.category === 'JanMat' && (
            <div style={{
              backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px',
              padding: '10px 14px', marginTop: '12px', fontSize: '11px', color: '#166534', lineHeight: 1.45
            }}>
              <strong>🔒 {lang === 'HI' ? '100% गोपनीय मतपेटी' : '100% Secret Ballot'}:</strong>{' '}
              {lang === 'HI'
                ? 'ईवीएम स्याही की तरह, भूमत यह सत्यापित करता है कि आपने मत दिया है (ताकि दोहरे मत रोके जा सकें), लेकिन आपने किस विकल्प को चुना, यह कोई नहीं जान सकता।'
                : 'Just like voting ink on your finger, BhuMat verifies that you voted to block duplicate ballots, but nobody—not even our engineers—can see which option you chose.'}
            </div>
          )}
        </div>

        {/* Card 2: National Preference Breakdown with Clean Baseline Grid */}
        <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '18px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{lang === 'HI' ? 'राष्ट्रीय प्राथमिकता विश्लेषण' : 'National Preference Breakdown'}</span>
            <span style={{ color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>🌱</span>
              <span>{lang === 'HI' ? 'कुल मत' : 'ALL BALLOTS'}</span>
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {poll.options.map((opt, idx) => {
              const optColor = OPTION_PALETTE[idx % OPTION_PALETTE.length];
              const optCount = tallies.reduce((sum, r) => {
                const c = Number(r[`opt_${idx}_votes`] ?? r[`option_${idx}_votes`]) || 0;
                return sum + c;
              }, 0);

              const optPct = bharatStats.total > 0 ? Math.round((optCount / bharatStats.total) * 100) : 0;
              const isUserChoice = poll.category !== 'JanMat' && userVotedOptionIdx === idx;
              const primaryText = lang === 'EN' ? opt.text_en : opt.text_hi;
              const secondaryText = lang === 'EN' ? opt.text_hi : opt.text_en;

              return (
                <div key={opt.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: optColor, marginTop: '4px', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
                          {primaryText}
                        </span>
                        {secondaryText && secondaryText !== primaryText && (
                          <span style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.3 }}>
                            {secondaryText}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isUserChoice && (
                        <span style={{ fontSize: '10px', color: '#059669', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          ✓ {lang === 'HI' ? 'आप' : 'You'}
                        </span>
                      )}
                      <span style={{ fontWeight: 900, color: optColor, minWidth: '38px', textAlign: 'right', fontSize: '13.5px' }}>
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

        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => setShowParchi(true)}
            style={{
              padding: '10px 16px',
              backgroundColor: '#ffffff',
              border: '1.5px solid #cbd5e1',
              borderRadius: '12px',
              color: '#0f172a',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}
          >
            <span>📜</span>
            <span>{lang === 'HI' ? 'मत पर्ची (डिजिटल स्लिप)' : 'Mat Parchi'}</span>
          </button>
        </div>

        {/* Card 3: 3-Box Comparison Ledger (Dynamic Admin Color Binding) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '14px' }}>
          
          {/* Box 1: BHARAT */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '10px 8px', borderRadius: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '94px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b' }}>
                  {lang === 'HI' ? 'भारत' : 'BHARAT'}
                </span>
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    alert(lang === 'HI' ? 'अखिल भारतीय स्तर पर इस प्रश्न का वर्तमान सबसे प्रमुख विकल्प।' : 'National consensus: The leading option chosen across all 543 parliamentary seats.');
                  }}
                  style={{ fontSize: '10px', color: '#0284c7', cursor: 'pointer', opacity: 0.8 }}
                >
                  ⓘ
                </span>
              </div>
            <div style={{
              fontSize: '11px',
              fontWeight: 800,
              color: (consensusSummary?.bharat?.total || 0) > 0 
                ? (poll.options[consensusSummary.bharat.lead_id]?.color || OPTION_PALETTE[consensusSummary.bharat.lead_id % OPTION_PALETTE.length]) 
                : '#94a3b8',
              margin: '4px 0',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {(consensusSummary?.bharat?.total || 0) > 0
                ? (poll.options[consensusSummary.bharat.lead_id]?.text_en || 'Leading')
                : (lang === 'HI' ? 'मतदान की प्रतीक्षा' : 'Awaiting Ballots')}
            </div>
            <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 600 }}>
              {consensusSummary?.bharat?.total || 0} Votes
            </div>
          </div>

          {/* Box 2: STATE */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '10px 8px', borderRadius: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '94px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b' }}>
                  {userState?.toUpperCase() || 'STATE'}
                </span>
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    alert(lang === 'HI' ? `राज्य स्तर (${userState}) पर सबसे प्रमुख विकल्प।` : `State consensus: The leading option chosen across ${userState}.`);
                  }}
                  style={{ fontSize: '10px', color: '#0284c7', cursor: 'pointer', opacity: 0.8 }}
                >
                  ⓘ
                </span>
              </div>
            <div style={{
              fontSize: '11px',
              fontWeight: 800,
              color: (consensusSummary?.state?.total || 0) > 0 
                ? (poll.options[consensusSummary.state.lead_id]?.color || OPTION_PALETTE[consensusSummary.state.lead_id % OPTION_PALETTE.length]) 
                : '#94a3b8',
              margin: '4px 0',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {(consensusSummary?.state?.total || 0) > 0
                ? (poll.options[consensusSummary.state.lead_id]?.text_en || 'Leading')
                : (lang === 'HI' ? 'मतदान की प्रतीक्षा' : 'Awaiting Ballots')}
            </div>
            <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 600 }}>
              {consensusSummary?.state?.total || 0} Votes
            </div>
          </div>

          {/* Box 3: CONSTITUENCY (SEAT) */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '10px 8px', borderRadius: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '94px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b' }}>
                  {userSeatName?.toUpperCase() || 'SEAT'}
                </span>
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    alert(lang === 'HI' ? `आपके संसदीय क्षेत्र (${userSeatName}) का स्थानीय जनमत परिणाम।` : `Constituency consensus: The verified local result for ${userSeatName}.`);
                  }}
                  style={{ fontSize: '10px', color: '#0284c7', cursor: 'pointer', opacity: 0.8 }}
                >
                  ⓘ
                </span>
              </div>
            <div style={{
              fontSize: '11px',
              fontWeight: 800,
              color: (consensusSummary?.seat?.total || 0) > 0 
                ? (consensusSummary.seat.is_tie 
                    ? '#475569' 
                    : (poll.options[consensusSummary.seat.lead_id]?.color || OPTION_PALETTE[consensusSummary.seat.lead_id % OPTION_PALETTE.length]))
                : '#94a3b8',
              margin: '4px 0',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {(consensusSummary?.seat?.total || 0) > 0
                ? (consensusSummary.seat.is_tie ? 'Split Mat (Tie)' : poll.options[consensusSummary.seat.lead_id]?.text_en || 'Leading')
                : (lang === 'HI' ? 'प्रतीक्षारत' : 'Awaiting')}
            </div>
            <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 600 }}>
              {consensusSummary?.seat?.total || 0} Votes
            </div>
          </div>
        </div>

{/* Citizen Pulse: Contextual Regional Shifts */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: '20px',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>⚡</span>
              <span style={{ fontSize: '12px', fontWeight: 850, color: '#0f172a', letterSpacing: '-0.01em' }}>
                {lang === 'HI' ? 'संसदीय पल्स एवं हालिया रुझान' : 'Constituency Pulse & Recent Shifts'}
              </span>
            </div>
            <span style={{ fontSize: '10px', color: '#059669', fontWeight: 800, backgroundColor: '#ecfdf5', padding: '2px 8px', borderRadius: '6px' }}>
              ● {lang === 'HI' ? 'सक्रिय विमर्श' : 'Live Dialogue'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Local Seat Pulse */}
            <div style={{ fontSize: '11.5px', color: '#1e293b', backgroundColor: '#f0fdf4', padding: '10px 12px', borderRadius: '12px', border: '1px solid #bbf7d0', lineHeight: 1.45 }}>
              <div style={{ fontWeight: 800, color: '#166534', marginBottom: '2px' }}>
                📍 {userSeatName || 'Your Seat'}: {userSeatStats?.leadingOptionText || (lang === 'HI' ? 'प्रारंभिक चरण' : 'Early Trend')}
              </div>
              <span style={{ color: '#15803d', fontSize: '11px' }}>
                {userSeatStats && userSeatStats.totalVotes > 0
                  ? (lang === 'HI'
                      ? `आपके क्षेत्र के ${userSeatStats.leadingPercent}% नागरिकों ने इस विकल्प का समर्थन किया है।`
                      : `${userSeatStats.leadingPercent}% of participating local voters favor this stance.`)
                  : (lang === 'HI'
                      ? 'आपके क्षेत्र का मत अभी संकलित हो रहा है। अपना मत देकर स्थानीय दिशा तय करें।'
                      : 'Initial ballots forming the consensus baseline for this constituency.')}
              </span>
            </div>

            {/* State Consensus Stance */}
            <div style={{ fontSize: '11.5px', color: '#1e293b', backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', lineHeight: 1.45 }}>
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>
                🏛️ {userState || 'State'} {lang === 'HI' ? 'सहमति' : 'Consensus'}: {consensusSummary?.state?.lead_id !== undefined ? (poll.options[consensusSummary.state.lead_id]?.text_en || 'Active') : 'Balanced'}
              </div>
              <span style={{ color: '#64748b', fontSize: '11px' }}>
                {consensusSummary?.state?.total && consensusSummary.state.total > 0
                  ? (lang === 'HI'
                      ? `राज्य भर के विभिन्न क्षेत्रों में विमर्श तीव्र हो रहा है।`
                      : `State-wide civic participation actively shaping the regional majority.`)
                  : (lang === 'HI'
                      ? 'राज्य के विभिन्न क्षेत्रों से रुझान आने शुरू हो रहे हैं।'
                      : 'Regional trends are crystallizing as citizens participate across the state.')}
              </span>
            </div>
          </div>
        </div>
        
        {/* Map / Grid Container */}
        {viewMode === 'MAP' ? (
          <div
            style={{
              position: 'relative',
              backgroundColor: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '20px',
              padding: '14px',
              marginBottom: '14px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}
          >
            {/* Search Bar + Zoom Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  placeholder={lang === 'HI' ? "🔍 क्षेत्र खोजें (उदा. चित्तूर, एलुरु)..." : "🔍 Search region (e.g. Eluru, Nagpur)..."}
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '9px 34px 9px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '12px',
                    backgroundColor: '#f8fafc',
                    color: '#0f172a'
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
                onClick={handleZoomIn}
                title="Zoom In"
                style={{ padding: '8px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 900, cursor: 'pointer' }}
              >
                ＋
              </button>
              <button
                onClick={handleZoomOut}
                title="Zoom Out"
                style={{ padding: '8px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 900, cursor: 'pointer' }}
              >
                －
              </button>
              <button
                onClick={handleZoomReset}
                title={lang === 'HI' ? "ज़ूम रीसेट करें" : "Reset Map"}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#475569',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                ⟲ {lang === 'HI' ? 'रीसेट' : 'Reset'}
              </button>
            </div>

            {isLoadingGeo && (
              <div style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '12px' }}>
                {lang === 'HI' ? 'संप्रभु दृष्टि ग्रिड तैयार हो रहा है...' : 'Rendering Sovereign Drishti Grid...'}
              </div>
            )}

            <svg ref={svgRef} style={{ width: '100%', height: 'auto', display: isLoadingGeo ? 'none' : 'block', touchAction: 'pan-y' }} />

            {/* Structured Option Legend */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px',
              padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {lang === 'HI' ? 'अग्रणी विकल्प फ़िल्टर:' : 'Filter Leading Stance:'}
                </span>
                {selectedOptionFilter !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedOptionFilter(null)}
                    style={{ padding: '2px 6px', border: 'none', background: 'none', color: '#dc2626', fontSize: '10.5px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    ✕ {lang === 'HI' ? 'रीसेट फ़िल्टर' : 'Clear Filter'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {poll.options.map((opt, idx) => {
                  const isSelected = selectedOptionFilter === idx;
                  const optColor = OPTION_PALETTE[idx % OPTION_PALETTE.length];
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOptionFilter(isSelected ? null : idx)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '5px 10px', borderRadius: '8px',
                        border: `1.5px solid ${isSelected ? optColor : '#cbd5e1'}`,
                        backgroundColor: isSelected ? `${optColor}15` : '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: optColor, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: isSelected ? optColor : '#334155' }}>
                        {lang === 'HI' ? opt.text_hi : opt.text_en}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

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
                <div style={{ fontSize: '9.5px', color: '#64748b' }}>
                  {lang === 'HI' ? 'कुल मत' : 'Total'}: {hoveredSeat.totalVotes} ({hoveredSeat.trend})
                </div>
              </div>
            )}
          </div>
        ) : (
          <div ref={gridSectionRef} style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '16px', marginBottom: '14px' }}>
            <div style={{ position: 'relative', width: '100%', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder={lang === 'HI' ? "🔍 सीट या राज्य से खोजें..." : "🔍 Filter seat by name or state..."}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 34px 10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a'
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

            <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11.5px' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>
                  <tr style={{ borderBottom: '1.5px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '8px 6px', fontWeight: 800 }}>{lang === 'HI' ? 'संसदीय क्षेत्र' : 'Constituency'}</th>
                    <th style={{ padding: '8px 6px', fontWeight: 800 }}>{lang === 'HI' ? 'राज्य' : 'State'}</th>
                    <th style={{ padding: '8px 6px', fontWeight: 800 }}>{lang === 'HI' ? 'अग्रणी रुख' : 'Leading Stance'}</th>
                    <th style={{ padding: '8px 6px', fontWeight: 800 }}>{lang === 'HI' ? 'स्थिति' : 'Trend'}</th>
                    <th style={{ padding: '8px 6px', fontWeight: 800, textAlign: 'right' }}>{lang === 'HI' ? 'मत' : 'Ballots'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGrid.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: '24px 0' }}>
                        {lang === 'HI' ? 'कोई सीट नहीं मिली।' : 'No constituency records found.'}
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
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: item.totalVotes >= 50 ? '#ecfdf5' : '#f8fafc', color: item.totalVotes >= 50 ? '#059669' : '#64748b', fontWeight: 700 }}>
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

        {/* Floating Map Touch Popup (Dismisses on tap, 5s timeout, or scroll) */}
        {mapTooltip && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setMapTooltip(null);
            }}
            style={{
              position: 'fixed',
              left: `${mapTooltip.x}px`,
              top: `${mapTooltip.y}px`,
              zIndex: 160,
              backgroundColor: '#0f172a',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '8px 12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              border: '1.5px solid #334155',
              maxWidth: '190px',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 900, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {mapTooltip.seatName}
              </span>
              <span style={{ fontSize: '9px', color: '#94a3b8', flexShrink: 0 }}>
                {mapTooltip.totalVotes} {mapTooltip.totalVotes === 1 ? 'vote' : 'votes'}
              </span>
            </div>
            <div style={{ fontSize: '9.5px', color: '#94a3b8', marginBottom: '4px' }}>
              {mapTooltip.stateName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: mapTooltip.leadingColor, flexShrink: 0 }} />
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: mapTooltip.leadingColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {mapTooltip.leadingText}
              </span>
            </div>
          </div>
        )}

        {/* Dual Share Controls */}
        <div style={{ display: 'flex', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
          <button
            onClick={handleShareScoreboard}
            style={{
              flex: 1,
              height: '48px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              borderRadius: '14px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(16,185,129,0.2)'
            }}
          >
            <span>📲</span>
            <span>{lang === 'HI' ? 'व्हाट्सएप लिंक' : 'WhatsApp Link'}</span>
          </button>
          
          <button
            onClick={handleShareMapImage}
            style={{
              flex: 1,
              height: '48px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              borderRadius: '14px',
              border: '1.5px solid #334155',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
            }}
          >
            <span>📸</span>
            <span>{lang === 'HI' ? 'नक्शा फोटो शेयर करें' : 'Share Map Photo'}</span>
          </button>
        </div>

<MatParchiModal
  isOpen={showParchi}
  onClose={() => setShowParchi(false)}
  pollTitle={lang === 'HI' ? poll.title_hi : poll.title_en}
  selectedOptionText={
    userVotedOptionIdx !== null && poll.options[userVotedOptionIdx]
      ? (lang === 'HI' ? poll.options[userVotedOptionIdx].text_hi : poll.options[userVotedOptionIdx].text_en)
      : 'Voted'
  }
  seatName={userSeatName || 'Bharat'}
  stateName={userState || 'Bharat'}
  username="CitizenBharat"
  lang={lang}
/>

      </main>
    </div>
  );
}