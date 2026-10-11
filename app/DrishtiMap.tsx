'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { supabase } from './utils/supabaseClient';

interface DrishtiMapProps {
  selectedConstituencyName?: string;
  selectedState?: string;
  pollId?: string;
  cycleId?: string;
  userVotedOptionIdx?: number | null;
  options?: Array<{ id: number; text_en: string; text_hi: string }>;
}

// Fixed 4-color palette: 0: Orange, 1: Green, 2: Sky Blue, 3: Purple
const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];
const UNPOLLED_SEAT_COLOR = '#e2e8f0';
const RADAR_GREEN = '#10b981';

export default function DrishtiMap({
  selectedConstituencyName = 'Darbhanga',
  selectedState = 'Bihar',
  pollId,
  cycleId = '2026-10',
  userVotedOptionIdx = null,
  options = []
}: DrishtiMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Live tallies from the pre-aggregated constituency matrix
  const [tallies, setTallies] = useState<any[]>([]);

  // Exact option color chosen by the citizen
  const userOptionColor = userVotedOptionIdx !== null && userVotedOptionIdx !== undefined
    ? OPTION_PALETTE[userVotedOptionIdx % OPTION_PALETTE.length]
    : OPTION_PALETTE[0];

  useEffect(() => {
    fetch('/india_pc_2019_simplified.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Boundary asset unavailable');
        return res.json();
      })
      .then((data) => {
        setGeoData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('GeoJSON load error:', err);
        setLoading(false);
      });
  }, []);

  async function loadTallies() {
    if (!pollId) return;
    try {
      const { data, error } = await supabase
        .from('constituency_tallies')
        .select('*')
        .eq('poll_id', pollId);

      if (data && !error) {
        setTallies(data);
      }
    } catch (e) {
      console.warn('Tally fetch note:', e);
    }
  }

  useEffect(() => {
    loadTallies();

    // Subscribe to live tally updates
    const channel = supabase
      .channel(`drishti_tally_${pollId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'constituency_tallies', filter: `poll_id=eq.${pollId}` },
        () => {
          loadTallies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId]);

  const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const activeTarget = clean(selectedConstituencyName);
  const activeStateKey = clean(selectedState);

  // Real-time calculation from constituency_tallies
  const { nationalTally, stateTally, seatTally, seatMap } = useMemo(() => {
    const optCount = Math.max(options.length, 2);
    const natBreakdown = new Array(optCount).fill(0);
    const stBreakdown = new Array(optCount).fill(0);

    let natTotal = 0;
    let stTotal = 0;

    const sMap: Record<string, any> = {};
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

      if (cState === activeStateKey) {
        stTotal += rowTotal;
        for (let i = 0; i < optCount; i++) {
          stBreakdown[i] += Number(row[`opt_${i}_votes`] || 0);
        }
      }

      if (cSeat === activeTarget) {
        targetSeatRecord = row;
      }
    });

    // If citizen voted locally but network row hasn't populated yet, register at least 1 vote
    if (userVotedOptionIdx !== null && (!targetSeatRecord || Number(targetSeatRecord.total_votes || 0) === 0)) {
      if (natTotal === 0) natTotal = 1;
      if (stTotal === 0) stTotal = 1;
      targetSeatRecord = {
        total_votes: 1,
        leading_option: userVotedOptionIdx,
        is_tie: false,
        is_fortified: false
      };
    }

    const resolveWinner = (arr: number[], total: number) => {
      if (total === 0) return { idx: -1, isTie: false, votes: 0 };
      const maxVotes = Math.max(...arr);
      const winners = arr.map((v, i) => (v === maxVotes ? i : -1)).filter((i) => i !== -1);
      return { idx: winners[0], isTie: winners.length > 1, votes: maxVotes };
    };

    return {
      nationalTally: { total: natTotal, ...resolveWinner(natBreakdown, natTotal) },
      stateTally: { total: stTotal, ...resolveWinner(stBreakdown, stTotal) },
      seatTally: targetSeatRecord || { total_votes: 0, leading_option: 0, is_tie: false, is_fortified: false },
      seatMap: sMap
    };
  }, [tallies, activeStateKey, activeTarget, userVotedOptionIdx, options]);

  const stateFeatures = useMemo(() => {
    if (!geoData) return [];
    let rawState = (selectedState || '').toLowerCase();
    if (rawState.includes('delhi')) rawState = 'delhi';
    const targetState = clean(rawState);

    const matches = geoData.features.filter((f: any) => {
      const p = f.properties || {};
      const st = clean(p.ST_NAME || p.st_name || p.STATE || p.state || '');
      return targetState && (st.includes(targetState) || targetState.includes(st));
    });

    return matches.length > 0 ? matches : geoData.features.slice(0, 25);
  }, [geoData, selectedState]);

  const isTargetMatch = (pcName: string) => {
    const c = clean(pcName);
    if (!c || !activeTarget) return false;
    return c === activeTarget || c.includes(activeTarget) || activeTarget.includes(c);
  };

  const getSeatFill = (name: string) => {
    // The voter's home seat is ALWAYS lit with their chosen option color
    if (isTargetMatch(name)) return userOptionColor;

    // Neighboring seats only light up when quorum is fortified (>= 50 votes)
    const row = seatMap[clean(name)];
    if (!row || Number(row.total_votes || 0) < 50) return UNPOLLED_SEAT_COLOR;
    return OPTION_PALETTE[Number(row.leading_option || 0) % OPTION_PALETTE.length];
  };

  useEffect(() => {
    if (!stateFeatures.length || !svgRef.current) return;

    const width = 360;
    const height = 280;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const projection = d3.geoMercator().fitExtent(
      [[20, 20], [width - 20, height - 20]],
      { type: 'FeatureCollection', features: stateFeatures } as any
    );

    const pathGenerator = d3.geoPath().projection(projection);
    const g = svg.append('g');

    g.selectAll('path.constituency')
      .data(stateFeatures)
      .enter()
      .append('path')
      .attr('class', (d: any) => {
        const p = d.properties || {};
        return isTargetMatch(p.PC_NAME || p.pc_name || p.NAME || '') ? 'constituency user-state-glow' : 'constituency';
      })
      .attr('d', (d: any) => pathGenerator(d))
      .attr('stroke', (d: any) => {
        const p = d.properties || {};
        return isTargetMatch(p.PC_NAME || p.pc_name || p.NAME || '') ? userOptionColor : '#94a3b8';
      })
      .attr('stroke-width', (d: any) => {
        const p = d.properties || {};
        return isTargetMatch(p.PC_NAME || p.pc_name || p.NAME || '') ? 3.5 : 0.75;
      })
      .style('fill', (d: any) => {
        const p = d.properties || {};
        return getSeatFill(p.PC_NAME || p.pc_name || p.NAME || '');
      });

    // Uniform Green Radar Beacons on User Seat
    const activeFeature = stateFeatures.find((f: any) => {
      const p = f.properties || {};
      return isTargetMatch(p.PC_NAME || p.pc_name || p.NAME || '');
    });

    if (activeFeature) {
      const centroid = pathGenerator.centroid(activeFeature);
      if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
        // Inner Green Radar Ring
        g.append('circle')
          .attr('cx', centroid[0])
          .attr('cy', centroid[1])
          .attr('r', 16)
          .attr('fill', 'none')
          .attr('stroke', RADAR_GREEN)
          .attr('stroke-width', 3)
          .attr('class', 'state-calm-radar')
          .attr('pointer-events', 'none');

        // Outer Green Radar Ring
        g.append('circle')
          .attr('cx', centroid[0])
          .attr('cy', centroid[1])
          .attr('r', 28)
          .attr('fill', 'none')
          .attr('stroke', '#34d399')
          .attr('stroke-width', 1.5)
          .attr('class', 'state-calm-radar-outer')
          .attr('pointer-events', 'none');

        // Core Centroid Dot
        g.append('circle')
          .attr('cx', centroid[0])
          .attr('cy', centroid[1])
          .attr('r', 5.5)
          .attr('fill', '#065f46')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2)
          .attr('pointer-events', 'none');
      }
    }
  }, [stateFeatures, selectedConstituencyName, tallies, userOptionColor]);

  // Verdict calculation
  const getVerdictDetails = (total: number, idx: number, isTie: boolean) => {
    if (total === 0) return { title: '0 Ballots', color: '#64748b' };
    if (isTie) return { title: '⚖️ Split (Tie)', color: '#64748b' };
    const opt = options[idx];
    const name = opt ? opt.text_en.split('/')[0].trim() : `Option ${idx + 1}`;
    return { title: name, color: OPTION_PALETTE[idx % OPTION_PALETTE.length] };
  };

  const natVerdict = getVerdictDetails(nationalTally.total, nationalTally.idx, nationalTally.isTie);
  const stVerdict = getVerdictDetails(stateTally.total, stateTally.idx, stateTally.isTie);

  const seatTotal = Number(seatTally.total_votes || 0);
  const seatLeadIdx = userVotedOptionIdx !== null ? userVotedOptionIdx : Number(seatTally.leading_option || 0);
  const seatVerdict = getVerdictDetails(seatTotal, seatLeadIdx, Boolean(seatTally.is_tie));

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <style>{`
        @keyframes calmRadarWave {
          0% { r: 6px; opacity: 0.95; stroke-width: 3px; }
          100% { r: 38px; opacity: 0; stroke-width: 0.2px; }
        }
        @keyframes calmRadarWaveOuter {
          0% { r: 12px; opacity: 0.8; stroke-width: 2px; }
          100% { r: 52px; opacity: 0; stroke-width: 0.1px; }
        }
        .state-calm-radar {
          animation: calmRadarWave 3s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        .state-calm-radar-outer {
          animation: calmRadarWaveOuter 3s infinite 0.75s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes calmSeatBreathing {
          0% {
            stroke-width: 2.5px;
            filter: drop-shadow(0 0 3px ${userOptionColor}66);
          }
          50% {
            stroke-width: 4.5px;
            filter: drop-shadow(0 0 16px ${userOptionColor}cc);
          }
          100% {
            stroke-width: 2.5px;
            filter: drop-shadow(0 0 3px ${userOptionColor}66);
          }
        }
        .user-state-glow {
          animation: calmSeatBreathing 3s infinite ease-in-out !important;
          stroke: ${userOptionColor} !important;
          fill: ${userOptionColor} !important;
        }
      `}</style>

      {/* 3-Box Live Scorecard: Bound to exact option color */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px' }}>
        <div style={{ backgroundColor: '#f8fafc', padding: '8px 4px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Bharat</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: natVerdict.color, marginTop: '2px' }}>
            {natVerdict.title}
          </div>
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginTop: '2px' }}>
            {nationalTally.total} {nationalTally.total === 1 ? 'Vote' : 'Votes'}
          </div>
        </div>

        <div style={{ backgroundColor: '#f8fafc', padding: '8px 4px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{selectedState || 'State'}</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: stVerdict.color, marginTop: '2px' }}>
            {stVerdict.title}
          </div>
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginTop: '2px' }}>
            {stateTally.total} {stateTally.total === 1 ? 'Vote' : 'Votes'}
          </div>
        </div>

        <div style={{ backgroundColor: '#f8fafc', padding: '8px 4px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{selectedConstituencyName || 'Lok Sabha'}</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: seatVerdict.color, marginTop: '2px' }}>
            {seatVerdict.title}
          </div>
          <div style={{ fontSize: '9px', color: seatTotal >= 50 ? '#059669' : '#d97706', fontWeight: 800, marginTop: '2px' }}>
            {seatTotal >= 50 ? '● Quorum Met' : `⏳ ${seatTotal}/50 Ballots`}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px', padding: '6px 8px', backgroundColor: '#f1f5f9', borderRadius: '8px' }}>
        {options.map((opt, idx) => (
          <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', fontWeight: 700, color: '#334155' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: OPTION_PALETTE[idx % OPTION_PALETTE.length], flexShrink: 0 }} />
            <span>{opt.text_en.split('/')[0].slice(0, 16)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', fontWeight: 700, color: '#64748b' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: UNPOLLED_SEAT_COLOR, flexShrink: 0 }} />
          <span>Pending Quorum (0–49)</span>
        </div>
      </div>

      {loading ? (
        <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
          Rendering State Grid...
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox="0 0 360 280"
          style={{ width: '100%', height: '280px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'block' }}
        />
      )}
    </div>
  );
}