'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { supabase } from './utils/supabaseClient';

interface DrishtiMapProps {
  selectedConstituencyName?: string;
  selectedState?: string;
  pollId?: string;
  options?: Array<{ id: number; text_en: string; text_hi: string }>;
}

const OPTION_PALETTE = ['#f97316', '#10b981', '#8b5cf6', '#0ea5e9'];
const UNPOLLED_SEAT_COLOR = '#e2e8f0';

export default function DrishtiMap({
  selectedConstituencyName = 'Gorakhpur',
  selectedState = 'Uttar Pradesh',
  pollId,
  options = []
}: DrishtiMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dbTelemetry, setDbTelemetry] = useState<Record<string, any>>({});

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

  useEffect(() => {
    async function loadTelemetry() {
      if (!pollId) return;
      try {
        const { data, error } = await supabase.rpc('get_poll_telemetry', { p_poll_id: pollId });
        if (data && !error) {
          const map: Record<string, any> = {};
          data.forEach((row: any) => {
            const key = (row.constituency_name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            map[key] = {
              totalVotes: Number(row.total_votes || 0),
              leadingOpt: Number(row.leading_option || 0),
              isFortified: Boolean(row.is_fortified)
            };
          });
          setDbTelemetry(map);
        }
      } catch (e) {
        console.warn('RPC telemetry notice:', e);
      }
    }
    loadTelemetry();
  }, [pollId]);

  const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const activeTarget = clean(selectedConstituencyName);

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
    if (isTargetMatch(name)) return '#10b981';
    const t = dbTelemetry[clean(name)];
    // Strict truth-in-data: If 0 votes or no quorum, display unpolled neutral slate
    if (!t || !t.isFortified) return UNPOLLED_SEAT_COLOR;
    return OPTION_PALETTE[t.leadingOpt % OPTION_PALETTE.length];
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
        return isTargetMatch(p.PC_NAME || p.pc_name || p.NAME || '') ? '#064e3b' : '#94a3b8';
      })
      .attr('stroke-width', (d: any) => {
        const p = d.properties || {};
        return isTargetMatch(p.PC_NAME || p.pc_name || p.NAME || '') ? 3.5 : 0.75;
      })
      .style('fill', (d: any) => {
        const p = d.properties || {};
        return getSeatFill(p.PC_NAME || p.pc_name || p.NAME || '');
      });

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
          .attr('stroke', '#10b981')
          .attr('stroke-width', 3)
          .attr('class', 'state-calm-radar')
          .attr('pointer-events', 'none');

        g.append('circle')
          .attr('cx', centroid[0])
          .attr('cy', centroid[1])
          .attr('r', 26)
          .attr('fill', 'none')
          .attr('stroke', '#34d399')
          .attr('stroke-width', 1.5)
          .attr('class', 'state-calm-radar-outer')
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
  }, [stateFeatures, selectedConstituencyName, dbTelemetry]);

  const targetTelemetry = dbTelemetry[activeTarget] || { totalVotes: 0, isFortified: false, leadingOpt: 0 };

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <style>{`
        @keyframes calmRadarWave {
          0% { r: 6px; opacity: 0.9; stroke-width: 3px; }
          100% { r: 36px; opacity: 0; stroke-width: 0.2px; }
        }
        @keyframes calmRadarWaveOuter {
          0% { r: 10px; opacity: 0.7; stroke-width: 2px; }
          100% { r: 48px; opacity: 0; stroke-width: 0.1px; }
        }
        .state-calm-radar {
          animation: calmRadarWave 3.2s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        .state-calm-radar-outer {
          animation: calmRadarWaveOuter 3.2s infinite 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes calmSeatBreathing {
          0% {
            stroke: #047857;
            stroke-width: 2.5px;
            filter: drop-shadow(0 0 3px rgba(16, 185, 129, 0.4));
          }
          50% {
            stroke: #10b981;
            stroke-width: 4.5px;
            filter: drop-shadow(0 0 14px rgba(16, 185, 129, 0.9));
          }
          100% {
            stroke: #047857;
            stroke-width: 2.5px;
            filter: drop-shadow(0 0 3px rgba(16, 185, 129, 0.4));
          }
        }
        .user-state-glow {
          animation: calmSeatBreathing 3.2s infinite ease-in-out !important;
          stroke: #10b981 !important;
          fill: #10b981 !important;
        }
      `}</style>

      {/* Honest 3-Box Telemetry Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px' }}>
        <div style={{ backgroundColor: '#f8fafc', padding: '8px 4px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>National</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
            {Object.keys(dbTelemetry).length > 0 ? 'Live Tallies' : '0 Ballots'}
          </div>
          <div style={{ fontSize: '9px', color: '#059669', fontWeight: 700, marginTop: '2px' }}>● Consensus Grid</div>
        </div>
        <div style={{ backgroundColor: '#f8fafc', padding: '8px 4px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{selectedState || 'State'}</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
            {Object.keys(dbTelemetry).length > 0 ? 'Auditing' : 'Pending'}
          </div>
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginTop: '2px' }}>● State Ledger</div>
        </div>
        <div style={{ backgroundColor: '#f8fafc', padding: '8px 4px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{selectedConstituencyName || 'Lok Sabha'}</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
            {targetTelemetry.totalVotes} {targetTelemetry.totalVotes === 1 ? 'Vote' : 'Votes'}
          </div>
          <div style={{ fontSize: '9px', color: targetTelemetry.isFortified ? '#059669' : '#d97706', fontWeight: 800, marginTop: '2px' }}>
            {targetTelemetry.isFortified ? '● Quorum Met' : `⏳ ${targetTelemetry.totalVotes}/50 Ballots`}
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
          <span>No Ballots / Below Quorum</span>
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