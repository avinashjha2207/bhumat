'use client';

import React from 'react';

interface TickerTapeProps {
  activePoll?: any;
  lang: 'EN' | 'HI';
}

const SAMPLE_VERDICTS = [
  { seat: 'Darbhanga', verdict: 'Excellent & Well Maintained' },
  { seat: 'Bangalore South', verdict: 'Average' },
  { seat: 'Hyderabad', verdict: 'Excellent & Well Maintained' },
  { seat: 'Meerut', verdict: 'Average' },
  { seat: 'Nagapattinam', verdict: 'Severe Deterioration' },
  { seat: 'Mumbai South', verdict: 'Average' },
  { seat: 'New Delhi', verdict: 'Excellent & Well Maintained' },
  { seat: 'Varanasi', verdict: 'Excellent & Well Maintained' },
  { seat: 'Patna Sahib', verdict: 'Average' },
  { seat: 'Secunderabad', verdict: 'Excellent & Well Maintained' }
];

export default function TickerTape({ activePoll, lang }: TickerTapeProps) {
  const items = SAMPLE_VERDICTS;

  return (
    <div
      style={{
        width: '100%',
        overflow: 'hidden',
        backgroundColor: '#0f172a',
        borderRadius: '8px',
        padding: '8px 0',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        boxSizing: 'border-box'
      }}
    >
      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-inner {
          display: inline-flex;
          align-items: center;
          gap: 24px;
          animation: tickerScroll 25s linear infinite;
        }
        .ticker-inner:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="ticker-inner">
        {[...items, ...items].map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11.5px',
              color: '#f8fafc',
              fontWeight: 600
            }}
          >
            <span style={{ color: '#38bdf8', fontWeight: 800 }}>📍 {item.seat}:</span>
            <span style={{ color: '#e2e8f0' }}>{item.verdict}</span>
            <span style={{ color: '#475569', marginLeft: '12px' }}>•</span>
          </div>
        ))}
      </div>
    </div>
  );
}