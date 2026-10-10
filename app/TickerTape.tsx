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
  const tickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function fetchLiveTicker() {
      if (!activePoll?.id) return;
      try {
        const { data, error } = await supabase.rpc('get_poll_telemetry', { p_poll_id: activePoll.id });
        if (data && data.length > 0 && !error) {
          const formatted: TickerItem[] = data.slice(0, 25).map((row: any) => {
            const optIndex = Number(row.leading_option || 0);
            const optText = activePoll.options?.[optIndex]
              ? (lang === 'EN' ? activePoll.options[optIndex].text_en : activePoll.options[optIndex].text_hi).split('/')[0].trim()
              : 'Active Audit';
            return {
              seat: row.constituency_name,
              verdict: optText
            };
          });
          setTickerItems(formatted);
          return;
        }
      } catch (e) {
        console.warn('Ticker telemetry fallback:', e);
      }

      // Qualitative verdicts ONLY — ZERO percentages
      setTickerItems([
        { seat: 'Machilipatnam', verdict: 'Advisory Audits' },
        { seat: 'Darbhanga', verdict: 'Strict Mandatory Accountability' },
        { seat: 'Bangalore South', verdict: 'Infrastructure First' },
        { seat: 'Hyderabad', verdict: 'Strict Mandatory Accountability' },
        { seat: 'West Delhi', verdict: 'Excellent & Well Maintained' },
        { seat: 'Araria', verdict: 'Strict Mandatory Accountability' },
        { seat: 'Patna Sahib', verdict: 'Infrastructure First' }
      ]);
    }

    fetchLiveTicker();

    const channel = supabase
      .channel(`ticker_${activePoll?.id || 'live'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, () => {
        fetchLiveTicker();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activePoll?.id, lang]);

  const items = tickerItems.length > 0 ? tickerItems : [
    { seat: 'Pan-Bharat', verdict: 'Live Civic Consensus' }
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '32px',
        backgroundColor: '#0f172a',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        boxSizing: 'border-box',
        border: '1px solid #1e293b'
      }}
    >
      <style>{`
        @keyframes tickerSlide {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          display: flex;
          white-space: nowrap;
          animation: tickerSlide 28s linear infinite;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div ref={tickerRef} className="ticker-track">
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