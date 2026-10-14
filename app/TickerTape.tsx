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
        const { data, error } = await supabase
          .from('constituency_tallies')
          .select('*')
          .eq('poll_id', activePoll.id);

        if (data && data.length > 0 && !error && isMounted) {
          const list: TickerItem[] = data
            .filter((row: any) => Number(row.total_votes || 0) > 0)
            .map((row: any) => {
              const total = Number(row.total_votes || 0);
              const isTie = Boolean(row.is_tie);
              const optIndex = Number(row.leading_option || 0);
              let statusText = '';

              if (isTie) {
                statusText = lang === 'HI' ? '⚖️ खंडित मत (टाई)' : '⚖️ Split Mat (Tie)';
              } else {
                const optObj = activePoll.options?.[optIndex];
                statusText = optObj
                  ? (lang === 'EN' ? optObj.text_en : optObj.text_hi).split('/')[0].trim()
                  : `Option ${optIndex + 1}`;
              }

              const trendTag = total >= 20
                ? (lang === 'HI' ? 'सत्यापित' : 'Fortified')
                : (lang === 'HI' ? 'रुझान' : 'Early Trend');

              return {
                seat: row.constituency_name,
                verdict: `${statusText} • ${trendTag}`
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
      const speed = 28;
      setAnimDuration(Math.max(scrollW / 2 / speed, 14));
    }
  }, [tickerItems]);

  const hasLiveVotes = tickerItems.length > 0;
  const fallbackItems = isJanMat
    ? [
        {
          seat: 'Pan-Bharat',
          verdict: lang === 'HI' ? 'गोपनीय मतपेटी • संप्रभु जनमत ग्रिड' : 'Cryptographic Secret Ballot • Sovereign Public Opinion'
        },
        {
          seat: '543 Seats',
          verdict: lang === 'HI' ? 'प्रत्येक मत से जीवंत नक्शा • सार्वजनिक नागरिक ऑडिट' : 'Every Ballot Lights The Map • Live Civic Audit'
        }
      ]
    : [
        {
          seat: 'Pan-Bharat',
          verdict: lang === 'HI' ? 'जनता की आवाज • महान सांस्कृतिक मत' : 'Voice of the People • The Great Cultural Mat'
        },
        {
          seat: '543 Seats',
          verdict: lang === 'HI' ? 'अपने संसदीय क्षेत्र से जुड़ें • रियल-टाइम मत' : 'Connect with your constituency • Real-time Mat'
        }
      ];

  const rawList = hasLiveVotes ? tickerItems : fallbackItems;
  const items = rawList.length < 5 ? [...rawList, ...rawList, ...rawList, ...rawList] : [...rawList, ...rawList];

  return (
    <div
      style={{
        width: '100%',
        height: '36px',
        backgroundColor: '#0f172a',
        borderRadius: '8px',
        border: '1px solid #1e293b',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        boxSizing: 'border-box'
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
            <span style={{ color: '#475569', marginLeft: '10px' }}>•</span>
          </div>
        ))}
      </div>
    </div>
  );
}