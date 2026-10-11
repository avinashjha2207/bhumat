'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './utils/supabaseClient';

interface TickerItem {
  seat: string;
  verdict: string;
}

export default function TickerTape({ activePoll, lang = 'EN' }: { activePoll?: any; lang?: 'EN' | 'HI' }) {
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [animDuration, setAnimDuration] = useState(24);

  useEffect(() => {
    let isMounted = true;

    async function fetchLiveTicker() {
      if (!activePoll?.id) return;
      try {
        const { data, error } = await supabase.rpc('get_poll_telemetry', { p_poll_id: activePoll.id });
        if (data && data.length > 0 && !error && isMounted) {
          const formatted: TickerItem[] = data.slice(0, 20).map((row: any) => {
            const optIndex = Number(row.leading_option || 0);
            const optText = activePoll.options?.[optIndex]
              ? (lang === 'EN' ? activePoll.options[optIndex].text_en : activePoll.options[optIndex].text_hi).split('/')[0].trim()
              : (lang === 'HI' ? 'सक्रिय जनमत' : 'Consensus Active');
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

      if (isMounted) {
        setTickerItems([
          { seat: 'Gorakhpur', verdict: lang === 'HI' ? 'सख्त कानूनी जवाबदेही' : 'Strict Mandatory Accountability' },
          { seat: 'Bangalore South', verdict: lang === 'HI' ? 'बुनियादी ढांचा पहले' : 'Infrastructure First' },
          { seat: 'Gaya', verdict: lang === 'HI' ? 'सलाहकारी ऑडिट' : 'Advisory Audits' },
          { seat: 'Varanasi', verdict: lang === 'HI' ? 'सख्त कानूनी जवाबदेही' : 'Strict Mandatory Accountability' },
          { seat: 'Darbhanga', verdict: lang === 'HI' ? 'सख्त कानूनी जवाबदेही' : 'Strict Mandatory Accountability' },
          { seat: 'Machilipatnam', verdict: lang === 'HI' ? 'सलाहकारी ऑडिट' : 'Advisory Audits' },
          { seat: 'Amravati', verdict: lang === 'HI' ? 'बुनियादी ढांचा पहले' : 'Infrastructure First' }
        ]);
      }
    }

    fetchLiveTicker();

    return () => {
      isMounted = false;
    };
  }, [activePoll?.id, lang]);

  useEffect(() => {
    if (trackRef.current) {
      const scrollW = trackRef.current.scrollWidth;
      const speed = 32;
      setAnimDuration(Math.max(scrollW / 2 / speed, 14));
    }
  }, [tickerItems]);

  // Buffer items across small lengths so width always exceeds screen bounds
  const rawList = tickerItems.length > 0 ? tickerItems : [
    { seat: 'Pan-Bharat', verdict: lang === 'HI' ? 'सक्रिय जनमत' : 'Live Public Opinion' }
  ];
  const items = rawList.length < 5 ? [...rawList, ...rawList, ...rawList, ...rawList] : [...rawList, ...rawList];

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
        @keyframes steadyScrollLinear {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .ticker-linear-track {
          display: flex;
          white-space: nowrap;
          will-change: transform;
        }
        .ticker-linear-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div
        ref={trackRef}
        className="ticker-linear-track"
        style={{
          animation: `steadyScrollLinear ${animDuration}s linear infinite`
        }}
      >
        {items.map((item, idx) => (
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