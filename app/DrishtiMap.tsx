'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';

interface DrishtiMapProps {
  selectedConstituencyName?: string;
  selectedState?: string;
}

const OPTION_PALETTE = ['#f97316', '#10b981', '#8b5cf6', '#0ea5e9', '#f59e0b'];
const BELOW_QUORUM_COLOR = '#cbd5e1';

export default function DrishtiMap({
  selectedConstituencyName = 'Darbhanga',
  selectedState = 'Bihar'
}: DrishtiMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

    return matches.length > 0 ? matches : geoData.features.slice(0, 28);
  }, [geoData, selectedState]);

  const seatTelemetry = useMemo(() => {
    const map = new Map<string, { leadingOpt: number; isFortified: boolean; name: string }>();
    stateFeatures.forEach((f: any, idx: number) => {
      const p = f.properties || {};
      const name = (p.PC_NAME || p.pc_name || p.NAME || `Seat_${idx}`).trim();
      const seed = name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), idx * 11);
      const isFortified = (Math.abs(seed) % 10) > 2;
      map.set(clean(name), { leadingOpt: Math.abs(seed) % 3, isFortified, name });
    });
    return map;
  }, [stateFeatures]);

  const isTargetMatch = (pcName: string) => {
    const c = clean(pcName);
    if (!c || !activeTarget) return false;
    return c === activeTarget || c.includes(activeTarget) || activeTarget.includes(c);
  };

  const getSeatFill = (name: string) => {
    if (isTargetMatch(name)) return '#10b981';
    const t = seatTelemetry.get(clean(name));
    if (!t || !t.isFortified) return BELOW_QUORUM_COLOR;
    return OPTION_PALETTE[t.leadingOpt % OPTION_PALETTE.length];
  };

  useEffect(() => {
    if (!stateFeatures.length || !svgRef.current) return;

    const width = 360;
    const height = 280;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const projection = d3.geoMercator().fitExtent(
      [[15, 15], [width - 15, height - 15]],
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
        return isTargetMatch(p.PC_NAME || p.pc_name || p.NAME || '') ? '#047857' : '#475569';
      })
      .attr('stroke-width', (d: any) => {
        const p = d.properties || {};
        return isTargetMatch(p.PC_NAME || p.pc_name || p.NAME || '') ? 2.5 : 0.8;
      })
      .style('fill', (d: any) => {
        const p = d.properties || {};
        return getSeatFill(p.PC_NAME || p.pc_name || p.NAME || '');
      });

    // Centroid Beacon Ring on Active Seat
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
          .attr('class', 'state-beacon-ring')
          .attr('pointer-events', 'none');

        g.append('circle')
          .attr('cx', centroid[0])
          .attr('cy', centroid[1])
          .attr('r', 5.5)
          .attr('fill', '#047857')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2)
          .attr('pointer-events', 'none');
      }
    }
  }, [stateFeatures, selectedConstituencyName]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <style>{`
        @keyframes stateBeaconPulse {
          0% { r: 5px; opacity: 1; stroke-width: 3.5px; }
          100% { r: 32px; opacity: 0; stroke-width: 0.5px; }
        }
        .state-beacon-ring {
          animation: stateBeaconPulse 1.8s infinite ease-out;
        }
        @keyframes stateSeatGlow {
          0% { stroke: #047857; stroke-width: 2px; filter: drop-shadow(0 0 2px rgba(16, 185, 129, 0.4)); }
          50% { stroke: #10b981; stroke-width: 4px; filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.9)); }
          100% { stroke: #047857; stroke-width: 2px; filter: drop-shadow(0 0 2px rgba(16, 185, 129, 0.4)); }
        }
        .user-state-glow {
          animation: stateSeatGlow 2s infinite ease-in-out !important;
          stroke: #10b981 !important;
          fill: #10b981 !important;
        }
      `}</style>

      {/* 3-Box Live Scorecard Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
        <div style={{ backgroundColor: '#f8fafc', padding: '8px 4px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>National</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>Option A</div>
          <div style={{ fontSize: '8px', color: '#94a3b8' }}>Live Verdict</div>
        </div>
        <div style={{ backgroundColor: '#f8fafc', padding: '8px 4px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{selectedState || 'State'}</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>Option A</div>
          <div style={{ fontSize: '8px', color: '#94a3b8' }}>Live Verdict</div>
        </div>
        <div style={{ backgroundColor: '#f8fafc', padding: '8px 4px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>{selectedConstituencyName || 'Lok Sabha'}</div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>Option A</div>
          <div style={{ fontSize: '8px', color: '#94a3b8' }}>Live Verdict</div>
        </div>
      </div>

      {loading ? (
        <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
          Rendering State Grid...
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox="0 0 360 280"
          style={{ width: '100%', height: '260px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'block' }}
        />
      )}
    </div>
  );
}