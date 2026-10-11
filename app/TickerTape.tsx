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

  const isJanMat = activePoll?.category === 'JanMat';

  useEffect(() => {
    let isMounted = true;

    async function fetchLiveTicker() {
      if (!activePoll?.id) return;
      try {
        const { data, error } = await supabase.rpc('get_live_consensus_hierarchy', {
          p_poll_id: activePoll.id
        });
        if (data && data.constituencies && !error && isMounted) {
          const list: TickerItem[] = Object.values(data.constituencies).map((row: any) => {
            const optIndex = Number(row.leading_option || 0);
            const optText = activePoll.options?.[optIndex]
              ? (lang === 'EN' ? activePoll.options[optIndex].text_en : activePoll.options[optIndex].text_hi).split('/')[0].trim()
              : (lang === 'HI' ? 'सक्रिय जनमत' : 'Consensus Active');
            return {
              seat: row.constituency_name,
              verdict: `${optText} (${Number(row.total_votes).toLocaleString()} ${lang === 'HI' ? 'मत' : 'votes'})`
            };
          });
          if (list.length > 0) {
            setTickerItems(list);
            return;
          }
        }
      } catch (e) {
        console.warn('Ticker telemetry notice:', e);
      }

      if (isMounted) {
        setTickerItems([]);
      }
    }

    fetchLiveTicker();

    return () => {
      isMounted = false;
    };
  }, [activePoll?.id, activePoll?.options, lang]);

  useEffect(() => {
    if (trackRef.current) {
      const scrollW = trackRef.current.scrollWidth;
      const speed = 32;
      setAnimDuration(Math.max(scrollW / 2 / speed, 14));
    }
  }, [tickerItems]);

  const hasLiveVotes = tickerItems.length > 0;

  // Bifurcated Ticker Lenses
  const fallbackItems = isJanMat
    ? [
        {
          seat: '543 Seats',
          verdict: lang === 'HI' ? 'प्रत्येक संसदीय सीट पर 50 मतों से कोरम पूर्ण • संप्रभु नागरिक ऑडिट' : '50 Ballots to Fortify Constituency Quorum • Sovereign Civic Audit'
        },
        {
          seat: 'Pan-Bharat',
          verdict: lang === 'HI' ? 'गोपनीय मतपेटी • सत्यापित सहमति ग्रिड' : 'Anonymous Secret Ballot • Verified Consensus Grid'
        }
      ]
    : [
        {
          seat: 'Pan-Bharat',
          verdict: lang === 'HI' ? 'जनता की आवाज • महान सांस्कृतिक पल्स' : 'Voice of the People • The Great Cultural Pulse'
        },
        {
          seat: '543 Seats',
          verdict: lang === 'HI' ? 'अपने संसदीय क्षेत्र से जुड़ें • रियल-टाइम मत' : 'Share your take with your constituency • Real-time Mat'
        }
      ];

  const rawList = hasLiveVotes ? tickerItems : fallbackItems;
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
            <span style={{ color: isJanMat ? '#38bdf8' : '#fbbf24', fontWeight: 800 }}>📍 {item.seat}:</span>
            <span style={{ color: '#ffffff', fontWeight: 600 }}>{item.verdict}</span>
            <span style={{ color: '#475569', marginLeft: '12px' }}>•</span>
          </div>
        ))}
      </div>
    </div>
  );
}