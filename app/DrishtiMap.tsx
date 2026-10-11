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
  optimisticLocalVote?: boolean;
}

const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];
const UNPOLLED_SEAT_COLOR = '#e2e8f0';
const TIE_COLOR = '#475569';
const RADAR_GREEN = '#10b981';

export default function DrishtiMap({
  selectedConstituencyName = 'Banka',
  selectedState = 'Bihar',
  pollId,
  cycleId = '2026-10',
  userVotedOptionIdx = null,
  options = [],
  optimisticLocalVote = false
}: DrishtiMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [tallies, setTallies] = useState<any[]>([]);
  // Live Popping Pulses Queue: { [cleanSeat]: { color: string, expiresAt: number } }
  const [livePulses, setLivePulses] = useState<Record<string, { color: string; expiresAt: number }>>({});

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

    if (!pollId) return;

    const tallyChannel = supabase
      .channel(`state_tally_stream_${pollId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'constituency_tallies', filter: `poll_id=eq.${pollId}` },
        () => {
          loadTallies();
        }
      )
      .subscribe();

    const ballotChannel = supabase
      .channel(`state_ballot_pulse_${pollId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ballot_box', filter: `poll_id=eq.${pollId}` },
        (payload) => {
          const newBallot = payload.new;
          if (newBallot && newBallot.constituency_name) {
            const cleanSeat = clean(newBallot.constituency_name);
            const optColor = OPTION_PALETTE[Number(newBallot.selected_option || 0) % OPTION_PALETTE.length];
            setLivePulses((prev) => ({
              ...prev,
              [cleanSeat]: { color: optColor, expiresAt: Date.now() + 3500 }
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
    }, 1000);

    return () => {
      supabase.removeChannel(tallyChannel);
      supabase.removeChannel(ballotChannel);
      clearInterval(interval);
    };
  }, [pollId]);

  const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const activeTarget = clean(selectedConstituencyName);
  const activeStateKey = clean(selectedState);

  const { nationalTally, stateTally, seatTally, seatMap, resolvedHomeColor } = useMemo(() => {
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
        targetSeatRecord = { ...row };
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
        sMap[activeTarget] = targetSeatRecord;
        if (natTotal === 0) natTotal = 1;
        if (stTotal === 0) stTotal = 1;
        natBreakdown[userVotedOptionIdx] = Math.max(natBreakdown[userVotedOptionIdx], 1);
        stBreakdown[userVotedOptionIdx] = Math.max(stBreakdown[userVotedOptionIdx], 1);
      }
    }

    const resolveWinner = (arr: number[], total: number) => {
      if (total === 0) return { idx: -1, isTie: false, votes: 0 };
      const maxVotes = Math.max(...arr);
      const winners = arr.map((v, i) => (v === maxVotes ? i : -1)).filter((i) => i !== -1);
      return { idx: winners[0], isTie: winners.length > 1, votes: maxVotes };
    };

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

    return {
      nationalTally: { total: natTotal, ...resolveWinner(natBreakdown, natTotal) },
      stateTally: { total: stTotal, ...resolveWinner(stBreakdown, stTotal) },
      seatTally: targetSeatRecord || { total_votes: 0, leading_option: 0, is_tie: false },
      seatMap: sMap,
      resolvedHomeColor: homeColor
    };
  }, [tallies, activeStateKey, activeTarget, userVotedOptionIdx, options, optimisticLocalVote]);

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
    const cleanName = clean(name);
    if (livePulses[cleanName]) {
      return livePulses[cleanName].color;
    }
    if (isTargetMatch(name)) return resolvedHomeColor;

    const row = seatMap[cleanName];
    if (!row || Number(row.total_votes || 0) === 0) return UNPOLLED_SEAT_COLOR;

    if (row.is_tie) return TIE_COLOR;
    return OPTION_PALETTE[Number(row.leading_option || 0) % OPTION_PALETTE.length];
  };

  const getSeatOpacity = (name: string) => {
    const cleanName = clean(name);
    if (livePulses[cleanName]) return 1.0;

    const row = seatMap[cleanName];
    const total = isTargetMatch(name)
      ? Number(seatTally.total_votes || 1)
      : Number(row?.total_votes || 0);

    if (total === 0) return 1;
    if (total < 10) return 0.85;
    if (total < 50) return 0.94;
    return 1.0;
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
        const pName = p.PC_NAME || p.pc_name || p.NAME || '';
        const isPulse = Boolean(livePulses[clean(pName)]);
        if (isPulse) return 'constituency live-pop-shockwave';
        return isTargetMatch(pName) ? 'constituency user-seat-glow' : 'constituency';
      })
      .attr('d', (d: any) => pathGenerator(d))
      .attr('stroke', (d: any) => {
        const p = d.properties || {};
        const pName = p.PC_NAME || p.pc_name || p.NAME || '';
        if (livePulses[clean(pName)]) return livePulses[clean(pName)].color;
        return isTargetMatch(pName) ? resolvedHomeColor : '#94a3b8';
      })
      .attr('stroke-width', (d: any) => {
        const p = d.properties || {};
        const pName = p.PC_NAME || p.pc_name || p.NAME || '';
        if (livePulses[clean(pName)]) return 3.5;
        return isTargetMatch(pName) ? 3.0 : 0.75;
      })
      .attr('fill', (d: any) => {
        const p = d.properties || {};
        return getSeatFill(p.PC_NAME || p.pc_name || p.NAME || '');
      })
      .attr('fill-opacity', (d: any) => {
        const p = d.properties || {};
        return getSeatOpacity(p.PC_NAME || p.pc_name || p.NAME || '');
      });

    // Ripple shockwave circles for live popping votes
    Object.keys(livePulses).forEach((pulsingSeatKey) => {
      const feat = stateFeatures.find((f: any) => {
        const p = f.properties || {};
        return clean(p.PC_NAME || p.pc_name || p.NAME || '') === pulsingSeatKey;
      });
      if (feat) {
        const centroid = pathGenerator.centroid(feat);
        if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
          g.append('circle')
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

    // Continuous Breathing Radar Pulse on Active Home Seat
    const activeFeature = stateFeatures.find((f: any) => {
      const p = f.properties || {};
      return isTargetMatch(p.PC_NAME || p.pc_name || p.NAME || '');
    });

    if (activeFeature) {
      const centroid = pathGenerator.centroid(activeFeature);
      if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
        g.append('circle')
          .attr('cx', centroid[0])
          .attr('cy', centroid[1])
          .attr('r', 16)
          .attr('fill', 'none')
          .attr('stroke', RADAR_GREEN)
          .attr('stroke-width', 2.8)
          .attr('class', 'state-calm-radar')
          .attr('pointer-events', 'none');

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
  }, [stateFeatures, selectedConstituencyName, tallies, resolvedHomeColor, livePulses]);

  const getVerdictDetails = (total: number, idx: number, isTie: boolean) => {
    if (total === 0) return { title: '0 Ballots', color: '#64748b', trend: 'Awaiting Ballots' };
    if (isTie) return { title: '⚖️ Split Mat (Tie)', color: TIE_COLOR, trend: 'Evenly Split' };

    const opt = options[idx];
    const name = opt ? opt.text_en.trim() : `Option ${idx + 1}`;
    const color = OPTION_PALETTE[idx % OPTION_PALETTE.length];
    const trend = total >= 20 ? 'Fortified' : 'Early Trend';

    return { title: name, color, trend };
  };

  const natVerdict = nationalTally.total > 0
    ? getVerdictDetails(nationalTally.total, nationalTally.idx, nationalTally.isTie)
    : { title: '0 Ballots', color: '#64748b', trend: 'Awaiting Ballots' };

  const stVerdict = stateTally.total > 0
    ? getVerdictDetails(stateTally.total, stateTally.idx, stateTally.isTie)
    : { title: '0 Ballots', color: '#64748b', trend: 'Awaiting Ballots' };

  const seatTotal = Number(seatTally.total_votes || 0);
  const seatLeadIdx = Number(seatTally.leading_option || 0);
  const seatVerdict = seatTotal > 0
    ? getVerdictDetails(seatTotal, seatLeadIdx, Boolean(seatTally.is_tie))
    : { title: '0 Ballots', color: '#64748b', trend: 'Awaiting Ballots' };

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <style>{`
        @keyframes calmRadarWave {
          0% { r: 6px; opacity: 0.95; stroke-width: 3px; }
          100% { r: 36px; opacity: 0; stroke-width: 0.2px; }
        }
        .state-calm-radar {
          animation: calmRadarWave 3s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes livePopShockwaveRing {
          0% { r: 6px; opacity: 1; stroke-width: 4px; }
          100% { r: 42px; opacity: 0; stroke-width: 0.5px; }
        }
        .live-pop-shockwave-circle {
          animation: livePopShockwaveRing 1.8s infinite ease-out;
        }
        @keyframes livePopFade {
          0% { filter: brightness(1.6); }
          50% { filter: brightness(1.2); }
          100% { filter: brightness(1); }
        }
        .live-pop-shockwave {
          animation: livePopFade 3.5s ease-out forwards;
        }
        @keyframes calmSeatBreathing {
          0% { stroke-width: 2.2px; filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.35)); opacity: 0.85; }
          50% { stroke-width: 4.2px; filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.95)); opacity: 1; }
          100% { stroke-width: 2.2px; filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.35)); opacity: 0.85; }
        }
        .user-seat-glow {
          animation: calmSeatBreathing 2.6s infinite ease-in-out !important;
        }
      `}</style>

      {/* 3-Box Live Scorecard with No Abrupt Text Truncation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
        <div style={{ backgroundColor: '#f8fafc', padding: '10px 6px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Bharat</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: natVerdict.color, marginTop: '4px', lineHeight: 1.35, wordBreak: 'break-word' }}>
            {natVerdict.title}
          </div>
          <div style={{ fontSize: '9px', color: '#0f172a', fontWeight: 700, marginTop: '4px' }}>
            {nationalTally.total} {nationalTally.total === 1 ? 'Vote' : 'Votes'}
          </div>
        </div>

        <div style={{ backgroundColor: '#f8fafc', padding: '10px 6px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{selectedState || 'State'}</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: stVerdict.color, marginTop: '4px', lineHeight: 1.35, wordBreak: 'break-word' }}>
            {stVerdict.title}
          </div>
          <div style={{ fontSize: '9px', color: '#0f172a', fontWeight: 700, marginTop: '4px' }}>
            {stateTally.total} {stateTally.total === 1 ? 'Vote' : 'Votes'}
          </div>
        </div>

        <div style={{ backgroundColor: '#f8fafc', padding: '10px 6px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{selectedConstituencyName || 'Lok Sabha'}</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: seatVerdict.color, marginTop: '4px', lineHeight: 1.35, wordBreak: 'break-word' }}>
            {seatVerdict.title}
          </div>
          <div style={{ fontSize: '9px', color: '#0f172a', fontWeight: 800, marginTop: '4px' }}>
            {seatTotal} {seatTotal === 1 ? 'Vote' : 'Votes'} • {seatVerdict.trend}
          </div>
        </div>
      </div>

      {/* Palette Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px', padding: '8px 10px', backgroundColor: '#f1f5f9', borderRadius: '8px' }}>
        {options.map((opt, idx) => (
          <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', fontWeight: 700, color: '#334155' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: OPTION_PALETTE[idx % OPTION_PALETTE.length], flexShrink: 0 }} />
            <span>{opt.text_en.length > 22 ? `${opt.text_en.slice(0, 20)}…` : opt.text_en}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', fontWeight: 700, color: TIE_COLOR }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: TIE_COLOR, flexShrink: 0 }} />
          <span>⚖️ Split (Tie)</span>
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