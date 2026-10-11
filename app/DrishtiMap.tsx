'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { supabase } from './utils/supabaseClient';

interface DrishtiMapProps {
  selectedConstituencyName?: string;
  selectedState?: string;
  pollId?: string;
  userVotedOptionIdx?: number | null;
  options?: Array<{ id: number; text_en: string; text_hi: string }>;
}

// 1st: Orange, 2nd: Green, 3rd: Sky Blue, 4th: Purple
const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];
const UNPOLLED_SEAT_COLOR = '#e2e8f0';
const RADAR_GREEN = '#10b981';

export default function DrishtiMap({
  selectedConstituencyName = 'Darbhanga',
  selectedState = 'Bihar',
  pollId,
  userVotedOptionIdx = null,
  options = []
}: DrishtiMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Exact option color chosen by the citizen
  const userOptionColor = userVotedOptionIdx !== null && userVotedOptionIdx !== undefined
    ? OPTION_PALETTE[userVotedOptionIdx % OPTION_PALETTE.length]
    : OPTION_PALETTE[0];

  const [telemetry, setTelemetry] = useState<{
    national: any;
    states: Record<string, any>;
    constituencies: Record<string, any>;
  }>({
    national: { total_votes: 0, leading_option: 0, leading_votes: 0, opt_breakdown: [0, 0, 0, 0] },
    states: {},
    constituencies: {}
  });

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

  async function loadHierarchyTelemetry() {
    if (!pollId) return;
    try {
      const { data, error } = await supabase.rpc('get_live_consensus_hierarchy', {
        p_poll_id: pollId
      });
      if (data && !error) {
        setTelemetry(data);
      }
    } catch (e) {
      console.warn('Hierarchy fetch note:', e);
    }
  }

  useEffect(() => {
    loadHierarchyTelemetry();

    const channel = supabase
      .channel(`drishti_sync_${pollId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes', filter: `poll_id=eq.${pollId}` }, () => {
        loadHierarchyTelemetry();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId]);

  const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const activeTarget = clean(selectedConstituencyName);
  const activeStateKey = clean(selectedState);

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
    // Citizen's home constituency takes the color of their chosen option
    if (isTargetMatch(name)) return userOptionColor;
    const seatData = telemetry.constituencies[clean(name)];
    if (!seatData || !seatData.is_fortified) return UNPOLLED_SEAT_COLOR;
    return OPTION_PALETTE[seatData.leading_option % OPTION_PALETTE.length];
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

    // Radar is ALWAYS UNIFORM GREEN across the entire app
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

        // Center Green Beacon Core
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
  }, [stateFeatures, selectedConstituencyName, telemetry, userOptionColor]);

  // Read Live Database Telemetry Values
  const seatRecord = telemetry.constituencies[activeTarget] || { total_votes: 0, is_fortified: false, leading_option: 0 };
  const stateRecord = telemetry.states[activeStateKey] || { total_votes: 0, leading_option: 0 };
  const nationalRecord = telemetry.national || { total_votes: 0, leading_option: 0 };

  const getOptTitle = (idx: number) => {
    return options[idx] ? options[idx].text_en.split('/')[0].slice(0, 14) : `Option ${idx + 1}`;
  };

  const seatTotalVotes = Number(seatRecord.total_votes || (userVotedOptionIdx !== null ? 1 : 0));
  const stateTotalVotes = Number(stateRecord.total_votes || (userVotedOptionIdx !== null ? 1 : 0));
  const nationalTotalVotes = Number(nationalRecord.total_votes || (userVotedOptionIdx !== null ? 1 : 0));

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

      {/* 3-Box Live Consensus Hierarchy Scorecard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px' }}>
        <div style={{ backgroundColor: '#f8fafc', padding: '8px 4px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Bharat</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
            {nationalTotalVotes > 0 ? getOptTitle(nationalRecord.leading_option || 0) : '0 Ballots'}
          </div>
          <div style={{ fontSize: '9px', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
            {nationalTotalVotes.toLocaleString()} {nationalTotalVotes === 1 ? 'Vote' : 'Votes'}
          </div>
        </div>

        <div style={{ backgroundColor: '#f8fafc', padding: '8px 4px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{selectedState || 'State'}</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
            {stateTotalVotes > 0 ? getOptTitle(stateRecord.leading_option || 0) : '0 Ballots'}
          </div>
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginTop: '2px' }}>
            {stateTotalVotes.toLocaleString()} {stateTotalVotes === 1 ? 'Vote' : 'Votes'}
          </div>
        </div>

        <div style={{ backgroundColor: '#f8fafc', padding: '8px 4px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{selectedConstituencyName || 'Lok Sabha'}</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: userOptionColor, marginTop: '2px' }}>
            {seatTotalVotes > 0 ? getOptTitle(userVotedOptionIdx ?? seatRecord.leading_option) : '0 Ballots'}
          </div>
          <div style={{ fontSize: '9px', color: seatRecord.is_fortified ? '#059669' : '#d97706', fontWeight: 800, marginTop: '2px' }}>
            {seatRecord.is_fortified ? '● Quorum Met' : `⏳ ${seatTotalVotes}/50 Ballots`}
          </div>
        </div>
      </div>

      {/* Standardized Legend */}
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