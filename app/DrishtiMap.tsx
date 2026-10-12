'use client';
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { supabase } from './utils/supabaseClient';

const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];
const UNPOLLED_SEAT_COLOR = '#e2e8f0';
const TIE_COLOR = '#475569';
const RADAR_GREEN = '#10b981';

// 5-Tier HSL depth map corresponding to option palette indexes [0, 1, 2, 3]
const TIER_HUE_MAP: Record<number, number> = {
  0: 24,  // Orange
  1: 160, // Emerald Green
  2: 199, // Sky Blue
  3: 262  // Purple
};

/**
 * 5-Tier Logarithmic Depth Scaler
 * Tiers:
 * 0: 0 votes -> #e2e8f0
 * 1: 1 - 9 votes -> 42% Saturation, 84% Lightness (Subtle Early Pulse)
 * 2: 10 - 24 votes -> 55% Saturation, 72% Lightness (Emerging Trend)
 * 3: 25 - 49 votes -> 75% Saturation, 60% Lightness (Pre-Quorum)
 * 4: 50 - 149 votes -> 95% Saturation, 48% Lightness (Fortified Quorum)
 * 5: 150+ votes -> 100% Saturation, 42% Lightness (Sovereign Hotspot)
 */
function getConstituencyTierColor(optIdx: number | null, totalVotes: number, isTie: boolean): string {
  if (totalVotes === 0 || optIdx === null) return UNPOLLED_SEAT_COLOR;
  if (isTie) {
    if (totalVotes >= 50) return '#334155';
    if (totalVotes >= 25) return '#475569';
    return '#94a3b8';
  }

  const hue = TIER_HUE_MAP[optIdx % 4] ?? 24;

  if (totalVotes >= 150) {
    return `hsl(${hue}, 100%, 42%)`;
  }
  if (totalVotes >= 50) {
    return `hsl(${hue}, 95%, 48%)`;
  }
  if (totalVotes >= 25) {
    return `hsl(${hue}, 75%, 60%)`;
  }
  if (totalVotes >= 10) {
    return `hsl(${hue}, 55%, 72%)`;
  }
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
  userVotedOptionIdx?: number | null;
  options: Option[];
  optimisticLocalVote?: boolean;
}

export default function DrishtiMap({
  selectedConstituencyName,
  selectedState,
  pollId,
  userVotedOptionIdx,
  options,
  optimisticLocalVote = false,
}: DrishtiMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [geoData, setGeoData] = useState<any | null>(null);
  const [tallies, setTallies] = useState<any[]>([]);
  const [livePulses, setLivePulses] = useState<Record<string, { color: string; expiresAt: number }>>({});
  const [hoveredSeat, setHoveredSeat] = useState<any | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      const { data, error } = await supabase
        .from('constituency_tallies')
        .select('*')
        .eq('poll_id', pollId);
      if (!error && data) {
        setTallies(data);
      }
    }
    fetchTallies();

    const tallyChannel = supabase
      .channel(`state_tallies_${pollId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'constituency_tallies',
          filter: `poll_id=eq.${pollId}`,
        },
        (payload: any) => {
          if (payload.new) {
            setTallies((prev) => {
              const idx = prev.findIndex(
                (t) =>
                  clean(t.constituency_name) === clean(payload.new.constituency_name) &&
                  clean(t.state_name) === clean(payload.new.state_name)
              );
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = payload.new;
                return updated;
              }
              return [...prev, payload.new];
            });
          }
        }
      )
      .subscribe();

    const ballotPulseChannel = supabase
      .channel(`state_ballot_pulse_${pollId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ballot_box',
          filter: `poll_id=eq.${pollId}`,
        },
        (payload: any) => {
          const newBallot = payload.new;
          if (newBallot && newBallot.constituency_name) {
            const cleanSeat = clean(newBallot.constituency_name);
            const optColor = OPTION_PALETTE[Number(newBallot.selected_option || 0) % OPTION_PALETTE.length];
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
  }, [pollId]);

  useEffect(() => {
    if (!geoData || !selectedState || !svgRef.current || !containerRef.current) return;
    const cleanTargetState = clean(selectedState);
    const stateFeatures = (geoData.features || []).filter((f: any) => {
      const p = f.properties || {};
      const st = clean(p.ST_NAME || p.st_name || p.state || '');
      return st === cleanTargetState;
    });
    if (stateFeatures.length === 0) return;

    const width = containerRef.current.clientWidth ? Math.min(containerRef.current.clientWidth - 20, 420) : 360;
    const height = Math.round(width * 0.95);
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const projection = d3.geoMercator().fitExtent(
      [[16, 16], [width - 16, height - 16]],
      { type: 'FeatureCollection', features: stateFeatures } as any
    );
    const pathGenerator = d3.geoPath().projection(projection);

    // Static clean container (NO d3.zoom applied to preserve mobile scrolling)
    const mapGroup = svg.append('g').attr('class', 'state-static-viewport');

    const tallyLookup = new Map<string, any>();
    tallies.forEach((t) => {
      const seatKey = clean(t.constituency_name);
      tallyLookup.set(seatKey, t);
    });

    const triggerTooltip = (event: any, d: any, persistTimer = 4500) => {
      const props = d.properties || {};
      const sName = props.PC_NAME || props.pc_name || props.name || 'Constituency';
      const row = tallyLookup.get(clean(sName));
      let leadText = 'Awaiting Ballots';
      let stanceColor = '#94a3b8';
      let totalVotes = 0;
      let trendBadge = 'Awaiting';
      let winningOptIdx: number | null = null;
      let isTie = false;

      if (row) {
        let highest = -1;
        options.forEach((_, idx) => {
          const count = Number(row[`option_${idx}_votes`] ?? row[`opt_${idx}_votes`]) || 0;
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
          leadText = 'Split Mat (Tie)';
          stanceColor = TIE_COLOR;
        } else if (winningOptIdx !== null && highest > 0) {
          leadText = options[winningOptIdx]?.text_en || 'Leading';
          stanceColor = OPTION_PALETTE[winningOptIdx % OPTION_PALETTE.length];
        }
        if (totalVotes >= 50) trendBadge = '🛡️ Fortified';
        else if (totalVotes >= 25) trendBadge = '⚡ Trending';
        else if (totalVotes > 0) trendBadge = '🌱 Early Trend';
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
        }, persistTimer);
      }
    };

    // 1. Render Seat Polygons with 5-Tier Logarithmic Intensity
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
        let highestVotes = -1;
        let winningOptIdx: number | null = null;
        let isTie = false;
        let total = 0;
        options.forEach((_, idx) => {
          const c = Number(row[`option_${idx}_votes`] ?? row[`opt_${idx}_votes`]) || 0;
          total += c;
          if (c > highestVotes) {
            highestVotes = c;
            winningOptIdx = idx;
            isTie = false;
          } else if (c === highestVotes && c > 0) {
            isTie = true;
          }
        });
        return getConstituencyTierColor(winningOptIdx, total, isTie);
      })
      .attr('stroke', (d: any) => {
        const p = d.properties || {};
        const seatName = clean(p.PC_NAME || p.pc_name || p.name || '');
        const row = tallyLookup.get(seatName);
        let total = 0;
        if (row) {
          options.forEach((_, idx) => {
            total += Number(row[`option_${idx}_votes`] ?? row[`opt_${idx}_votes`]) || 0;
          });
        }
        return total >= 50 ? '#ffffff' : '#cbd5e1';
      })
      .attr('stroke-width', (d: any) => {
        const p = d.properties || {};
        const seatName = clean(p.PC_NAME || p.pc_name || p.name || '');
        const row = tallyLookup.get(seatName);
        let total = 0;
        if (row) {
          options.forEach((_, idx) => {
            total += Number(row[`option_${idx}_votes`] ?? row[`opt_${idx}_votes`]) || 0;
          });
        }
        return total >= 50 ? 1.0 : 0.6;
      })
      .style('cursor', 'pointer')
      // Dual listener: Desktop mousemove + Mobile click/touchstart
      .on('mousemove', function (event: any, d: any) {
        d3.select(this).attr('stroke', '#0f172a').attr('stroke-width', 1.4);
        triggerTooltip(event, d, 0); // Active tracking while mouse is over
      })
      .on('mouseleave', function () {
        d3.select(this).attr('stroke', '#cbd5e1').attr('stroke-width', 0.6);
        setHoveredSeat(null);
        setTooltipPos(null);
      })
      .on('click touchstart', function (event: any, d: any) {
        event.stopPropagation();
        d3.select(this).attr('stroke', '#0f172a').attr('stroke-width', 1.5);
        triggerTooltip(event, d, 4500); // 4.5s sticky persistence on tap
      });

    // 2. Realtime Incoming Vote Shockwave Rings
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

    // 3. User's Home Seat Glowing Radar Ring
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
  }, [geoData, selectedState, tallies, livePulses, selectedConstituencyName, userVotedOptionIdx, optimisticLocalVote, options]);

  return (
    <div
      ref={containerRef}
      onClick={() => {
        setHoveredSeat(null);
        setTooltipPos(null);
      }}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '4px 0',
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
        @keyframes stateShockwavePulseRing {
          0% { r: 6px; opacity: 1; stroke-width: 3.5px; }
          100% { r: 32px; opacity: 0; stroke-width: 0.4px; }
        }
        .state-shockwave-pulse {
          animation: stateShockwavePulseRing 1.8s infinite ease-out;
        }
      `}</style>

      {/* Dynamic State View Label on Top-Left */}
      {selectedState && (
        <div style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'flex-start',
          padding: '0 8px 4px 8px',
          boxSizing: 'border-box'
        }}>
          <span style={{
            fontSize: '10.5px',
            fontWeight: 800,
            color: '#475569',
            backgroundColor: '#f1f5f9',
            border: '1px solid #cbd5e1',
            padding: '2px 8px',
            borderRadius: '6px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
          }}>
            📍 {selectedState.toUpperCase()} {geoData?.features ? `(${geoData.features.filter((f: any) => clean(f.properties?.ST_NAME || f.properties?.st_name || f.properties?.state || '') === clean(selectedState)).length} SEATS)` : ''}
          </span>
        </div>
      )}

      <svg ref={svgRef} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'pan-y' }} />

      {hoveredSeat && tooltipPos && (
        <div
          onClick={(e) => e.stopPropagation()}
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
            {hoveredSeat.total} {hoveredSeat.total === 1 ? 'Vote' : 'Votes'}
          </div>
        </div>
      )}
    </div>
  );
}