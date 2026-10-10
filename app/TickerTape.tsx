'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lleeljlvqltfzlidmsqs.supabase.co';
const supabaseUrl = rawUrl.replace(/[()]/g, '').trim();
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZWVsamx2cWx0ZnpsaWRtc3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODE3NTUsImV4cCI6MjEwNjk1Nzc1NX0.sQdPyFJpjKrt8mZx_xpOh8lgYPxCGrsO7IgDmxiwJfc';
const supabase = createClient(supabaseUrl, rawKey.trim());

interface TickerItem {
  seat: string;
  verdict: string;
}

export default function TickerTape({ activePoll, lang = 'EN' }: { activePoll?: any; lang?: 'EN' | 'HI' }) {
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [animDuration, setAnimDuration] = useState(20);

  useEffect(() => {
    async function fetchLiveTicker() {
      if (!activePoll?.id) return;
      try {
        const { data, error } = await supabase.rpc('get_poll_telemetry', { p_poll_id: activePoll.id });
        if (data && data.length > 0 && !error) {
          const formatted: TickerItem[] = data.slice(0, 20).map((row: any) => {
            const optIndex = Number(row.leading_option || 0);
            const optText = activePoll.options?.[optIndex]
              ? (lang === 'EN' ? activePoll.options[optIndex].text_en : activePoll.options[optIndex].text_hi).split('/')[0].trim()
              : 'Consensus Active';
            return {
              seat: row.constituency_name,
              verdict: optText
            };
          });
          setTickerItems(formatted);
          return;
        }
      } catch (e) {
        console.warn('Ticker telemetry notice:', e);
      }

      setTickerItems([
        { seat: 'Machilipatnam', verdict: 'Advisory Audits' },
        { seat: 'Darbhanga', verdict: 'Strict Mandatory Accountability' },
        { seat: 'Bangalore South', verdict: 'Infrastructure First' },
        { seat: 'Hyderabad', verdict: 'Strict Mandatory Accountability' },
        { seat: 'West Delhi', verdict: 'Excellent & Well Maintained' },
        { seat: 'Araria', verdict: 'Strict Mandatory Accountability' },
        { seat: 'Amalapuram', verdict: 'Infrastructure Priority' }
      ]);
    }

    fetchLiveTicker();
  }, [activePoll?.id, lang]);

  useEffect(() => {
    if (trackRef.current) {
      const scrollW = trackRef.current.scrollWidth;
      const speed = 35; // uniform 35 pixels per second
      setAnimDuration(Math.max(scrollW / 2 / speed, 12));
    }
  }, [tickerItems]);

  const items = tickerItems.length > 0 ? tickerItems : [
    { seat: 'Pan-Bharat', verdict: 'Live Civic Consensus' }
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '34px',
        backgroundColor: '#0f172a',
        borderRadius: '10px',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        boxSizing: 'border-box',
        border: '1px solid #1e293b'
      }}
    >
      <style>{`
        @keyframes steadyLinearScroll {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .ticker-calibrated-track {
          display: flex;
          white-space: nowrap;
          will-change: transform;
        }
        .ticker-calibrated-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div
        ref={trackRef}
        className="ticker-calibrated-track"
        style={{
          animation: `steadyLinearScroll ${animDuration}s linear infinite`
        }}
      >
        {[...items, ...items].map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              padding: '0 16px',
              fontWeight: 600
            }}
          >
            <span style={{ color: '#38bdf8', fontWeight: 800 }}>📍 {item.seat}:</span>
            <span style={{ color: '#ffffff', fontWeight: 600 }}>{item.verdict}</span>
            <span style={{ color: '#475569', marginLeft: '12px' }}>•</span>
          </div>
        ))}
      </div>
    </div>
  );
}