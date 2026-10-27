'use client';
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { supabase } from './utils/supabaseClient';

const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];
const UNPOLLED_SEAT_COLOR = '#f1f5f9';
const TIE_COLOR = '#f59e0b'; // Radiant Gold for Split Mat / Contested Seats
const RADAR_GREEN = '#10b981';

const TIER_HUE_MAP: Record<number, number> = {
  0: 24,
  1: 160,
  2: 199,
  3: 262
};

function getConstituencyTierColor(optIdx: number | null, totalVotes: number, isTie: boolean): string {
  if (totalVotes === 0 || optIdx === null) return UNPOLLED_SEAT_COLOR;
  if (isTie) {
    // Golden gradient for Split Mat (Tie) depending on consensus density
    if (totalVotes >= 50) return '#d97706'; // Rich Golden Bronze
    if (totalVotes >= 25) return '#f59e0b'; // Vibrant Amber Gold
    return '#fcd34d'; // Light Gold Early Contested
  }
  const hue = TIER_HUE_MAP[optIdx % 4] ?? 24;
  if (totalVotes >= 150) return `hsl(${hue}, 100%, 42%)`;
  if (totalVotes >= 50)  return `hsl(${hue}, 95%, 48%)`;
  if (totalVotes >= 25)  return `hsl(${hue}, 75%, 60%)`;
  if (totalVotes >= 10)  return `hsl(${hue}, 55%, 72%)`;
  return `hsl(${hue}, 42%, 84%)`;
}

interface Option {
  id: number;
  text_en: string;
  text_hi: string;
}

interface DrishtiMapProps {
  selectedConstituencyName?: string;
  selectedState?: string;
  pollId: string;
  cycleHorizon?: 'current' | 'all_time';
  cycleId?: string;
  userVotedOptionIdx?: number | null;
  options: Option[];
  optimisticLocalVote?: boolean;
  lang?: 'EN' | 'HI';
  verifiedOnly?: boolean;
  hideHeader?: boolean;
}

export default function DrishtiMap({
  selectedConstituencyName,
  selectedState,
  pollId,
  userVotedOptionIdx,
  options,
  optimisticLocalVote = false,
  lang = 'EN',
  hideHeader = false,
  cycleHorizon = 'current',
  cycleId,
}: DrishtiMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [geoData, setGeoData] = useState<any | null>(null);
  const [tallies, setTallies] = useState<any[]>([]);
  const [livePulses, setLivePulses] = useState<Record<string, { color: string; expiresAt: number }>>({});
  const pendingUpdatesRef = useRef<any[]>([]);
  const renderThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const [hoveredSeat, setHoveredSeat] = useState<any | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedSeatKey, setSelectedSeatKey] = useState<string | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  const dismissTooltip = () => {
    setHoveredSeat(null);
    setTooltipPos(null);
  };
  window.addEventListener('scroll', dismissTooltip, { passive: true });
  return () => {
    window.removeEventListener('scroll', dismissTooltip);
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
  };
}, []);

  const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  useEffect(() => {
    let isMounted = true;
    fetch('/india_pc_2019_simplified.geojson')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) setGeoData(data);
      })
      .catch((err) => console.error('GeoJSON fetch error:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    async function fetchTallies() {
      let query = supabase
        .from('constituency_tallies')
        .select('*')
        .eq('poll_id', pollId);

      // If viewing strictly the Current Cycle for a recurring poll
      if (cycleHorizon === 'current' && cycleId) {
        query = query.eq('cycle_id', cycleId);
      }

      const { data, error } = await query;
      if (!error && data) {
        setTallies(data);
      }
    }
    fetchTallies();

    const tallyChannel = supabase
      .channel(`state_tallies_${pollId}_${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'constituency_tallies',
          filter: `poll_id=eq.${pollId}`,
        },
        (payload: any) => {
          const updated = payload.new;
          if (updated) {
            // Queue update in ref buffer to throttle DOM thrashing
            pendingUpdatesRef.current.push(updated);

            if (!renderThrottleRef.current) {
              renderThrottleRef.current = setTimeout(() => {
                const batch = [...pendingUpdatesRef.current];
                pendingUpdatesRef.current = [];
                renderThrottleRef.current = null;

                setTallies((prev) => {
                  let next = [...prev];
                  batch.forEach((item) => {
                    const cSeat = clean(item.constituency_name);
                    const cState = clean(item.state_name);
                    const idx = next.findIndex(
                      (t) => clean(t.constituency_name) === cSeat && clean(t.state_name) === cState
                    );
                    if (idx >= 0) next[idx] = item;
                    else next.push(item);
                  });
                  return next;
                });
              }, 1200); // 1.2s smooth batching
            }

            // Trigger Realtime Neon Ripple on map
            if (updated.constituency_name) {
              const cleanSeat = clean(updated.constituency_name);
              let maxVotes = -1;
              let leadingIdx = 0;
              options.forEach((_, optIdx) => {
                const c = Number(updated[`opt_${optIdx}_votes`] ?? updated[`option_${optIdx}_votes`] ?? 0);
                if (c > maxVotes) {
                  maxVotes = c;
                  leadingIdx = optIdx;
                }
              });
              const optColor = OPTION_PALETTE[leadingIdx % OPTION_PALETTE.length];
              setLivePulses((prev) => ({
                ...prev,
                [cleanSeat]: { color: optColor, expiresAt: Date.now() + 3800 },
              }));
            }
          }
        }
      )
      .subscribe();

    // Listen to live tally updates to pulse the active seat with its winning color
    const ballotPulseChannel = supabase
      .channel(`state_ballot_pulse_${pollId}_${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'constituency_tallies',
          filter: `poll_id=eq.${pollId}`,
        },
        (payload: any) => {
          const updated = payload.new;
          if (updated && updated.constituency_name) {
            const cleanSeat = clean(updated.constituency_name);
            // Resolve leading color
            let maxVotes = -1;
            let leadingIdx = 0;
            options.forEach((_, idx) => {
              const c = Number(updated[`opt_${idx}_votes`] ?? updated[`option_${idx}_votes`] ?? 0);
              if (c > maxVotes) {
                maxVotes = c;
                leadingIdx = idx;
              }
            });
            const optColor = OPTION_PALETTE[leadingIdx % OPTION_PALETTE.length];
            setLivePulses((prev) => ({
              ...prev,
              [cleanSeat]: { color: optColor, expiresAt: Date.now() + 3800 },
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
  }, [pollId, cycleHorizon, cycleId]);

  useEffect(() => {
    if (!geoData || !selectedState || !svgRef.current || !containerRef.current) return;

    const cleanTargetState = clean(selectedState);
    const stateFeatures = (geoData.features || []).filter((f: any) => {
      const p = f.properties || {};
      const st = clean(p.ST_NAME || p.st_name || p.state || '');
      return st === cleanTargetState;
    });

    if (stateFeatures.length === 0) return;

    const width = 380;
    const height = 230;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.attr('preserveAspectRatio', 'xMidYMid meet');

    const projection = d3.geoMercator().fitExtent(
      [[12, 10], [width - 12, height - 10]],
      { type: 'FeatureCollection', features: stateFeatures } as any
    );
    const pathGenerator = d3.geoPath().projection(projection);

    const mapGroup = svg.append('g').attr('class', 'state-static-viewport');
    // Build fast lookup by normalized constituency name with graceful baseline fallback
  // Build fast lookup by normalized constituency name with graceful baseline fallback
    const tallyLookup = new Map<string, any>();
    const sourceTallies = (tallies && tallies.length > 0) ? tallies : [];
    sourceTallies.forEach((t: any) => {
      const pc = clean(t.pc_name || t.constituency_name || t.pc_id || '');
      if (pc) tallyLookup.set(pc, t);
    });

    const triggerTooltip = (event: any, d: any, persistTimer = 4500) => {
      const props = d.properties || {};
      const sName = props.PC_NAME || props.pc_name || props.name || (lang === 'HI' ? 'संसदीय क्षेत्र' : 'Constituency');
      const row = tallyLookup.get(clean(sName));

      let leadText = lang === 'HI' ? 'अग्रदूत बनें (प्रथम मत प्रतीक्षित)' : 'Be the First Voice (0 Ballots)';
      let stanceColor = '#0284c7';
      let totalVotes = 0;
      let trendBadge = lang === 'HI' ? '🌱 अग्रदूत अवसर' : '🌱 Pioneer Seat';
      let winningOptIdx: number | null = null;
      let isTie = false;

      if (row) {
        let highest = -1;
        options.forEach((_, idx) => {
          const count = Number(row[`opt_${idx}_votes`] ?? row[`option_${idx}_votes`]) || 0;
          totalVotes += count;
          if (count > highest) {
            highest = count;
            winningOptIdx = idx;
            isTie = false;
          } else if (count === highest && count > 0) {
            isTie = true;
          }
        });

        if (isTie) {
          leadText = lang === 'HI' ? 'खंडित मत (टाई)' : 'Split Mat (Tie)';
          stanceColor = TIE_COLOR;
        } else if (winningOptIdx !== null && highest > 0) {
          leadText = (lang === 'HI' ? options[winningOptIdx]?.text_hi : options[winningOptIdx]?.text_en) || (lang === 'HI' ? 'अग्रणी' : 'Leading');
          stanceColor = OPTION_PALETTE[winningOptIdx % OPTION_PALETTE.length];
        }

        if (totalVotes >= 50) trendBadge = lang === 'HI' ? '🛡️ कोरम पूर्ण' : '🛡️ Fortified';
        else if (totalVotes >= 25) trendBadge = lang === 'HI' ? '⚡ प्रगतिशील' : '⚡ Trending';
        else if (totalVotes > 0) trendBadge = lang === 'HI' ? '🌱 प्रारंभिक रुझान' : '🌱 Early Trend';
      }

      setHoveredSeat({
        name: sName,
        leadingStance: leadText,
        stanceColor,
        total: totalVotes,
        trendBadge,
      });

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const clientX = event.clientX || (event.touches?.[0]?.clientX ?? rect.left + width / 2);
        const clientY = event.clientY || (event.touches?.[0]?.clientY ?? rect.top + 80);
        setTooltipPos({
          x: Math.max(12, Math.min(clientX - rect.left - 60, width - 150)),
          y: Math.max(8, clientY - rect.top - 65),
        });
      }

      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      if (persistTimer > 0) {
        tooltipTimeoutRef.current = setTimeout(() => {
          setHoveredSeat(null);
          setTooltipPos(null);
          mapGroup.selectAll('path.constituency')
            .attr('stroke', (dt: any) => {
              const p = dt.properties || {};
              const r = tallyLookup.get(clean(p.PC_NAME || p.pc_name || ''));
              return (Number(r?.total_votes) || 0) >= 50 ? '#ffffff' : '#cbd5e1';
            })
            .attr('stroke-width', (dt: any) => {
              const p = dt.properties || {};
              const r = tallyLookup.get(clean(p.PC_NAME || p.pc_name || ''));
              return (Number(r?.total_votes) || 0) >= 50 ? 1.0 : 0.6;
            });
        }, persistTimer);
      }
    };

    mapGroup.selectAll('path.constituency')
      .data(stateFeatures)
      .enter()
      .append('path')
      .attr('class', 'constituency')
      .attr('d', (d: any) => pathGenerator(d))
      .attr('fill', (d: any) => {
        const p = d.properties || {};
        const seatName = clean(p.PC_NAME || p.pc_name || p.name || '');
        if (livePulses[seatName]) return livePulses[seatName].color;

        const row = tallyLookup.get(seatName);
        if (!row) {
          if (
            optimisticLocalVote &&
            userVotedOptionIdx !== null &&
            userVotedOptionIdx !== undefined &&
            clean(selectedConstituencyName || '') === seatName
          ) {
            return getConstituencyTierColor(userVotedOptionIdx, 1, false);
          }
          return UNPOLLED_SEAT_COLOR;
        }

        const total = Number(row.total_ballots ?? row.total_votes ?? 0);
        let winningOptIdx = row.leading_option_id !== undefined && row.leading_option_id !== null ? Number(row.leading_option_id) : null;
        const isTie = Boolean(row.is_tie);

        // Fallback: Calculate leader from individual option counts if leading_option_id is null
        if (winningOptIdx === null && total > 0) {
          const counts = [
            Number(row.opt_0_count ?? row.opt_0_votes ?? 0),
            Number(row.opt_1_count ?? row.opt_1_votes ?? 0),
            Number(row.opt_2_count ?? row.opt_2_votes ?? 0),
            Number(row.opt_3_count ?? row.opt_3_votes ?? 0)
          ];
          const maxVal = Math.max(...counts);
          if (maxVal > 0) {
            winningOptIdx = counts.indexOf(maxVal);
          }
        }

        if (total === 0 && optimisticLocalVote && clean(selectedConstituencyName || '') === seatName && userVotedOptionIdx !== null) {
          return getConstituencyTierColor(userVotedOptionIdx, 1, false);
        }
        return getConstituencyTierColor(winningOptIdx, total, isTie);
      })
      .attr('stroke', (d: any) => {
        const p = d.properties || {};
        const seatName = clean(p.PC_NAME || p.pc_name || p.name || '');
        if (selectedSeatKey === seatName) return '#0284c7';
        if (selectedConstituencyName && clean(selectedConstituencyName) === seatName) return '#10b981';
        const row = tallyLookup.get(seatName);
        const total = Number(row?.total_votes) || 0;
        return total >= 50 ? '#ffffff' : '#cbd5e1';
      })
      .attr('stroke-width', (d: any) => {
        const p = d.properties || {};
        const seatName = clean(p.PC_NAME || p.pc_name || p.name || '');
        if (selectedSeatKey === seatName) return 2.8;
        if (selectedConstituencyName && clean(selectedConstituencyName) === seatName) return 2.2;
        const row = tallyLookup.get(seatName);
        const total = Number(row?.total_votes) || 0;
        return total >= 50 ? 1.0 : 0.6;
      })
      .style('cursor', 'pointer')
      .on('mousemove', function (event: any, d: any) {
        mapGroup.selectAll('path.constituency')
          .attr('stroke', (dt: any) => {
            const p = dt.properties || {};
            const r = tallyLookup.get(clean(p.PC_NAME || p.pc_name || ''));
            return (Number(r?.total_votes) || 0) >= 50 ? '#ffffff' : '#cbd5e1';
          })
          .attr('stroke-width', (dt: any) => {
            const p = dt.properties || {};
            const r = tallyLookup.get(clean(p.PC_NAME || p.pc_name || ''));
            return (Number(r?.total_votes) || 0) >= 50 ? 1.0 : 0.6;
          });
        d3.select(this).attr('stroke', '#0f172a').attr('stroke-width', 1.8);
        triggerTooltip(event, d, 0);
      })
      .on('mouseleave', function () {
        mapGroup.selectAll('path.constituency')
          .attr('stroke', (dt: any) => {
            const p = dt.properties || {};
            const r = tallyLookup.get(clean(p.PC_NAME || p.pc_name || ''));
            return (Number(r?.total_votes) || 0) >= 50 ? '#ffffff' : '#cbd5e1';
          })
          .attr('stroke-width', (dt: any) => {
            const p = dt.properties || {};
            const r = tallyLookup.get(clean(p.PC_NAME || p.pc_name || ''));
            return (Number(r?.total_votes) || 0) >= 50 ? 1.0 : 0.6;
          });
        setHoveredSeat(null);
        setTooltipPos(null);
      })
      .on('click touchstart', function (event: any, d: any) {
        event.stopPropagation();
        const p = d.properties || {};
        const sKey = clean(p.PC_NAME || p.pc_name || p.name || '');
        setSelectedSeatKey(sKey);

        mapGroup.selectAll('path.constituency')
          .attr('stroke', (dt: any) => {
            const dp = dt.properties || {};
            const itemKey = clean(dp.PC_NAME || dp.pc_name || '');
            if (itemKey === sKey) return '#0284c7';
            if (selectedConstituencyName && clean(selectedConstituencyName) === itemKey) return '#10b981';
            const r = tallyLookup.get(itemKey);
            return (Number(r?.total_votes) || 0) >= 50 ? '#ffffff' : '#cbd5e1';
          })
          .attr('stroke-width', (dt: any) => {
            const dp = dt.properties || {};
            const itemKey = clean(dp.PC_NAME || dp.pc_name || '');
            if (itemKey === sKey) return 3.0;
            if (selectedConstituencyName && clean(selectedConstituencyName) === itemKey) return 2.2;
            const r = tallyLookup.get(itemKey);
            return (Number(r?.total_votes) || 0) >= 50 ? 1.0 : 0.6;
          });

        d3.select(this).raise(); // Bring to top of stack
        triggerTooltip(event, d, 6000);
      });

    Object.keys(livePulses).forEach((pulsingSeatKey) => {
      const feat = stateFeatures.find((f: any) => {
        const p = f.properties || {};
        return clean(p.PC_NAME || p.pc_name || p.name || '') === pulsingSeatKey;
      });
      if (feat) {
        const centroid = pathGenerator.centroid(feat);
        if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
          mapGroup.append('circle')
            .attr('cx', centroid[0])
            .attr('cy', centroid[1])
            .attr('r', 8)
            .attr('fill', 'none')
            .attr('stroke', livePulses[pulsingSeatKey].color)
            .attr('stroke-width', 3)
            .attr('class', 'state-shockwave-pulse')
            .attr('pointer-events', 'none');
        }
      }
    });

    if (selectedConstituencyName) {
      const activeClean = clean(selectedConstituencyName);
      const homeFeat = stateFeatures.find((f: any) => {
        const p = f.properties || {};
        return clean(p.PC_NAME || p.pc_name || p.name || '') === activeClean;
      });
      if (homeFeat) {
        const centroid = pathGenerator.centroid(homeFeat);
        if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
          mapGroup.append('circle')
            .attr('cx', centroid[0])
            .attr('cy', centroid[1])
            .attr('r', 16)
            .attr('fill', 'none')
            .attr('stroke', RADAR_GREEN)
            .attr('stroke-width', 2.5)
            .attr('class', 'state-calm-radar')
            .attr('pointer-events', 'none');
          mapGroup.append('circle')
            .attr('cx', centroid[0])
            .attr('cy', centroid[1])
            .attr('r', 5)
            .attr('fill', '#065f46')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1.8)
            .attr('pointer-events', 'none');
        }
      }
    }
  }, [geoData, selectedState, tallies, livePulses, selectedConstituencyName, selectedSeatKey, userVotedOptionIdx, optimisticLocalVote, options, lang]);

  return (
    <div
      ref={containerRef}
      onClick={() => {
        setHoveredSeat(null);
        setTooltipPos(null);
        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
tooltipTimeoutRef.current = setTimeout(() => {
  setHoveredSeat(null);
  setTooltipPos(null);
}, 3500);
      }}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box'
      }}
    >
      <style>{`
        @keyframes stateRadarWave {
          0% { r: 6px; opacity: 0.95; stroke-width: 2.5px; }
          100% { r: 34px; opacity: 0; stroke-width: 0.3px; }
        }
        .state-calm-radar {
          animation: stateRadarWave 2.8s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes radarPing {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1.15); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes stateShockwavePulseRing {
          0% { r: 6px; opacity: 1; stroke-width: 3.5px; }
          100% { r: 32px; opacity: 0; stroke-width: 0.4px; }
        }
        .state-shockwave-pulse {
          animation: stateShockwavePulseRing 1.8s infinite ease-out;
        }
      `}</style>

      {/* State Badge & Pioneer State Civic Anchor */}
      {selectedState && !hideHeader && (() => {
        // Compute total ballots cast across the current state
        const cleanTargetState = clean(selectedState);
        let stateTotalBallots = 0;
        (tallies || []).forEach((t: any) => {
          const st = clean(t.state_name || t.state_ut || '');
          if (st === cleanTargetState) {
            stateTotalBallots += Number(t.total_ballots ?? t.total_votes ?? 0);
          }
        });

        const seatCount = geoData?.features
          ? geoData.features.filter((f: any) => clean(f.properties?.ST_NAME || f.properties?.st_name || f.properties?.state || '') === cleanTargetState).length
          : 0;

        const isPioneer = stateTotalBallots < 10;

        return (
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '0 4px 6px 4px',
            boxSizing: 'border-box',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontSize: '10.5px',
                fontWeight: 800,
                color: '#334155',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                padding: '2px 8px',
                borderRadius: '6px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                📍 {selectedState.toUpperCase()} {seatCount > 0 ? `(${seatCount} ${lang === 'HI' ? 'सीटें' : 'SEATS'})` : ''}
              </span>
              <div style={{
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  backgroundColor: '#ecfdf5',
  border: '1px solid #a7f3d0',
  padding: '2px 8px',
  borderRadius: '999px',
  fontSize: '10px',
  fontWeight: 800,
  color: '#065f46'
}}>
  <div style={{ position: 'relative', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '1.5px solid #10b981',
                animation: 'radarPing 2.2s infinite cubic-bezier(0.2, 0.8, 0.4, 1)'
              }} />
              <span style={{ fontSize: '10px', lineHeight: 1, zIndex: 2 }}>📡</span>
            </div>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#065f46' }}>
              {lang === 'HI' ? 'लाइव दृष्टि मैप' : 'Live Drishti Map'}
            </span>
</div>
            </div>

            {isPioneer && (
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px dashed #86efac',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: 700,
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                lineHeight: 1.35
              }}>
                <span>🌱</span>
                <span>
                  {lang === 'HI'
                    ? 'अग्रदूत राज्य: अपनी लोकसभा सीट को राज्य के नक्शे पर चमकाने वाले पहले नागरिक बनें।'
                    : 'Pioneer State: Be among the first to cast a ballot and light up your constituency.'}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Strict Normalized Viewport (230px Height) with 16px Touch Gutter */}
      <div style={{ width: '100%', height: '230px', padding: '0 16px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'pan-y' }}>
        <svg
          ref={svgRef}
          style={{ width: '100%', height: '100%', display: 'block', touchAction: 'pan-y' }}
        />
      </div>

      {hoveredSeat && tooltipPos && (
  <div
    onClick={(e) => {
      e.stopPropagation();
      setHoveredSeat(null);
      setTooltipPos(null);
    }}
    style={{
            position: 'absolute',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: '10px',
            fontSize: '11px',
            zIndex: 30,
            boxShadow: '0 8px 22px rgba(0,0,0,0.35)',
            border: '1px solid #334155',
            maxWidth: '190px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 800, color: '#38bdf8', fontSize: '12px' }}>{hoveredSeat.name}</span>
            {hoveredSeat.total > 0 && (
              <span style={{ fontSize: '9px', fontWeight: 700, color: hoveredSeat.total >= 50 ? '#10b981' : '#f59e0b', backgroundColor: '#1e293b', padding: '1px 5px', borderRadius: '4px' }}>
                {hoveredSeat.trendBadge}
              </span>
            )}
          </div>
          <div style={{ marginTop: '4px', fontWeight: 700, color: hoveredSeat.stanceColor, display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', lineHeight: 1.3 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: hoveredSeat.stanceColor, flexShrink: 0 }} />
            <span>{hoveredSeat.leadingStance}</span>
          </div>
          <div style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '3px' }}>
            {hoveredSeat.total} {hoveredSeat.total === 1 ? (lang === 'HI' ? 'मत' : 'Vote') : (lang === 'HI' ? 'मत' : 'Votes')}
          </div>
        </div>
      )}
    </div>
  );
}