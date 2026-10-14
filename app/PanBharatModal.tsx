'use client';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';

interface PollOption {
  id: number;
  text_en: string;
  text_hi: string;
}

interface PanBharatModalProps {
  onClose: () => void;
  selectedSeatName?: string;
  pollQuestion?: string;
  pollCategory?: string;
  options?: PollOption[];
  lang?: 'EN' | 'HI';
}

export default function PanBharatModal({
  onClose,
  selectedSeatName = '',
  pollQuestion = 'JanMat Daily Governance Audit',
  pollCategory = 'JanMat',
  options = [
    { id: 0, text_en: 'Option A', text_hi: 'विकल्प क' },
    { id: 1, text_en: 'Option B', text_hi: 'विकल्प ख' },
    { id: 2, text_en: 'Option C', text_hi: 'विकल्प ग' }
  ],
  lang = 'EN'
}: PanBharatModalProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'leading' | 0 | 1 | 2>('leading');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredSeat, setHoveredSeat] = useState<any | null>(null);

  useEffect(() => {
    fetch('/india_pc_2019_simplified.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load national map');
        return res.json();
      })
      .then((data) => {
        setGeoData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('GeoJSON fetch error:', err);
        setLoading(false);
      });
  }, []);

  const seatTelemetry = useMemo(() => {
    if (!geoData) return new Map();
    const map = new Map<string, { leadingOpt: number; pcts: number[]; votes: number; isFortified: boolean }>();
    geoData.features.forEach((f: any, idx: number) => {
      const p = f.properties || {};
      const name = (p.PC_NAME || p.pc_name || p.NAME || `Seat_${idx}`).trim();
      const seed = name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
      const leadingOpt = seed % 3;
      const basePct = 52 + (seed % 34);
      const rem = 100 - basePct;
      const pcts = [0, 0, 0];
      pcts[leadingOpt] = basePct;
      pcts[(leadingOpt + 1) % 3] = Math.floor(rem * 0.62);
      pcts[(leadingOpt + 2) % 3] = rem - pcts[(leadingOpt + 1) % 3];
      const votes = 25 + (seed % 150);
      const isFortified = votes >= 50;
      map.set(name.toLowerCase(), { leadingOpt, pcts, votes, isFortified });
    });
    return map;
  }, [geoData]);

  const getSeatColor = (name: string, isFortified: boolean, leadingOpt: number) => {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTarget = selectedSeatName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanTarget && cleanName === cleanTarget) {
      return '#10b981';
    }
    if (!isFortified) {
      return '#f1f5f9';
    }
    if (filterMode === 'leading') {
      if (leadingOpt === 0) return '#bbf7d0';
      if (leadingOpt === 1) return '#bae6fd';
      return '#fef08a';
    }
    const data = seatTelemetry.get(name.toLowerCase());
    if (data && data.leadingOpt === filterMode) {
      return filterMode === 0 ? '#10b981' : filterMode === 1 ? '#0284c7' : '#f59e0b';
    }
    return '#f8fafc';
  };

  useEffect(() => {
    if (!geoData || !svgRef.current) return;
    const width = 1000;
    const height = 1150;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('class', 'map-viewport');

    const projection = d3.geoConicConformal()
      .parallels([12, 32])
      .rotate([-82.5, 0])
      .fitSize([width - 40, height - 40], geoData);
    const pathGenerator = d3.geoPath().projection(projection);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    g.attr('transform', 'translate(20, 20)');

    const paths = g.selectAll('path.seat')
      .data(geoData.features)
      .enter()
      .append('path')
      .attr('class', 'seat')
      .attr('d', (d: any) => pathGenerator(d))
      .attr('stroke', '#64748b')
      .attr('stroke-width', 0.6)
      .attr('fill', (d: any) => {
        const p = d.properties || {};
        const name = p.PC_NAME || p.pc_name || p.NAME || '';
        const telemetry = seatTelemetry.get(name.toLowerCase()) || { leadingOpt: 0, isFortified: true };
        return getSeatColor(name, telemetry.isFortified, telemetry.leadingOpt);
      })
      .style('cursor', 'pointer')
      .style('transition', 'fill 0.2s ease, stroke 0.2s ease')
      .on('mouseenter', function (event, d: any) {
        const p = d.properties || {};
        const name = p.PC_NAME || p.pc_name || p.NAME || '';
        const st = p.ST_NAME || p.st_name || p.STATE || '';
        const t = seatTelemetry.get(name.toLowerCase());
        d3.select(this)
          .attr('stroke', '#0284c7')
          .attr('stroke-width', 2.5)
          .raise();
        setHoveredSeat({ name, state: st, telemetry: t });
      })
      .on('mouseleave', function () {
        d3.select(this)
          .attr('stroke', '#64748b')
          .attr('stroke-width', 0.6);
      });

    if (searchQuery.trim()) {
      paths.each(function (d: any) {
        const p = d.properties || {};
        const name = (p.PC_NAME || p.pc_name || p.NAME || '').toLowerCase();
        if (name.includes(searchQuery.toLowerCase().trim())) {
          d3.select(this)
            .attr('stroke', '#f43f5e')
            .attr('stroke-width', 3)
            .attr('fill', '#ffe4e6')
            .raise();
        }
      });
    }

    const cleanTarget = selectedSeatName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const activeFeature = geoData.features.find((f: any) => {
      const p = f.properties || {};
      const name = (p.PC_NAME || p.pc_name || p.NAME || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanTarget && name === cleanTarget;
    });

    if (activeFeature) {
      const centroid = pathGenerator.centroid(activeFeature);
      if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
        g.append('circle')
          .attr('cx', centroid[0])
          .attr('cy', centroid[1])
          .attr('r', 18)
          .attr('fill', 'none')
          .attr('stroke', '#10b981')
          .attr('stroke-width', 3)
          .attr('class', 'beacon-pulse-ring')
          .attr('pointer-events', 'none');
        g.append('circle')
          .attr('cx', centroid[0])
          .attr('cy', centroid[1])
          .attr('r', 6)
          .attr('fill', '#059669')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2)
          .attr('pointer-events', 'none');
      }
    }
  }, [geoData, filterMode, searchQuery, selectedSeatName, seatTelemetry]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <style>{`
        @keyframes beaconPulseRing {
          0% { r: 6px; opacity: 1; stroke-width: 3.5px; }
          100% { r: 40px; opacity: 0; stroke-width: 0.5px; }
        }
        .beacon-pulse-ring {
          animation: beaconPulseRing 2s infinite ease-out;
        }
      `}</style>
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '24px',
          maxWidth: '1100px',
          width: '100%',
          height: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)',
          overflow: 'hidden'
        }}
      >
        {/* Top Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#f8fafc'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                color: pollCategory === 'JanMat' ? '#0369a1' : '#b45309',
                backgroundColor: pollCategory === 'JanMat' ? '#e0f2fe' : '#fef3c7',
                padding: '3px 10px',
                borderRadius: '999px',
                textTransform: 'uppercase'
              }}>
                PAN-BHARAT DRISHTI (543 SEATS)
              </span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                Survey of India / ECI Delimitation
              </span>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>
              {pollQuestion}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="text"
              placeholder="Search constituency..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: '#ffffff',
                outline: 'none',
                width: '200px'
              }}
            />
            {/* Show Close button ONLY if a confirmed seat already exists */}
            {selectedSeatName && (
              <button
                onClick={onClose}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '7px 16px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                ✕ Close
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{
          padding: '10px 24px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginRight: '4px' }}>
            Map Layer:
          </span>
          <button
            onClick={() => setFilterMode('leading')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: filterMode === 'leading' ? '#0f172a' : '#f1f5f9',
              color: filterMode === 'leading' ? '#ffffff' : '#475569',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            ● Leading Consensus (All)
          </button>
          {options.map((opt, idx) => {
            const isSelected = filterMode === idx;
            const badgeColor = idx === 0 ? '#10b981' : idx === 1 ? '#0284c7' : '#f59e0b';
            return (
              <button
                key={opt.id}
                onClick={() => setFilterMode(idx as any)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: isSelected ? badgeColor : '#f8fafc',
                  color: isSelected ? '#ffffff' : '#334155',
                  border: isSelected ? 'none' : '1px solid #e2e8f0',
                  cursor: 'pointer'
                }}
              >
                {lang === 'EN' ? opt.text_en : opt.text_hi}
              </button>
            );
          })}
        </div>

        {/* Scaled Full-Canvas SVG Container */}
        <div style={{
          flex: 1,
          position: 'relative',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div style={{ color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
              Synthesizing 543 Parliamentary Boundaries...
            </div>
          ) : (
            <svg
              ref={svgRef}
              viewBox="0 0 1000 1150"
              preserveAspectRatio="xMidYMid meet"
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          )}

          {/* Telemetry HUD */}
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '16px 20px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
            minWidth: '260px',
            pointerEvents: 'none'
          }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.04em' }}>
              CONSTITUENCY TELEMETRY
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
              {hoveredSeat?.name || selectedSeatName || 'Hover over any seat'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
              {hoveredSeat?.state || 'Bharat 543 Electoral Grid'}
            </div>
            {hoveredSeat?.telemetry && (
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Status</span>
                  <span style={{ color: hoveredSeat.telemetry.isFortified ? '#059669' : '#d97706', fontWeight: 800 }}>
                    {hoveredSeat.telemetry.isFortified ? '✓ Quorum Met' : `Pending (${hoveredSeat.telemetry.votes}/50)`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#64748b' }}>Leading</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>
                    {options[hoveredSeat.telemetry.leadingOpt]?.text_en || 'Leading'} ({hoveredSeat.telemetry.pcts[hoveredSeat.telemetry.leadingOpt]}%)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}