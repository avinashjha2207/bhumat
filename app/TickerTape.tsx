'use client';

import React, { useMemo } from 'react';

interface TickerTapeProps {
  tallies: any[];
  options: any[];
  pollCategory?: string;
  lang?: 'EN' | 'HI';
}

function getOptionLabel(opt: any, lang: 'EN' | 'HI'): string {
  if (!opt) return '';
  if (typeof opt === 'string') return opt;
  if (lang === 'HI') {
    return opt.text_hi || opt.text_en || '';
  }
  return opt.text_en || opt.text_hi || '';
}

function formatTickerStance(text: string, maxLen = 20): string {
  if (!text) return 'Consensus Building';
  let clean = text.split('(')[0].trim();
  if (clean.length > maxLen) {
    clean = clean.slice(0, maxLen - 1).trim() + '…';
  }
  return clean;
}

function determineLeadingOption(tally: any, optionsCount: number): { leadIdx: number; isTie: boolean } {
  if (!tally) return { leadIdx: 0, isTie: false };

  if (tally.leading_option_id !== undefined && tally.leading_option_id !== null) {
    return { leadIdx: Number(tally.leading_option_id), isTie: Boolean(tally.is_tie) };
  }

  let maxVotes = -1;
  let leadIdx = 0;
  let tieCount = 0;

  for (let i = 0; i < optionsCount; i++) {
    const votes = Number(tally[`opt_${i}_votes`] ?? tally[`opt_${i}_count`] ?? 0);
    if (votes > maxVotes) {
      maxVotes = votes;
      leadIdx = i;
      tieCount = 1;
    } else if (votes === maxVotes && votes > 0) {
      tieCount++;
    }
  }

  return { leadIdx, isTie: tieCount > 1 };
}

export default function TickerTape({
  tallies = [],
  options = [],
  pollCategory = 'LokMat',
  lang = 'EN'
}: TickerTapeProps) {
  const isJanMat = pollCategory === 'JanMat';

  const streamItems = useMemo(() => {
    if (!options || options.length === 0) return [];

    const activeTallies = tallies.filter(
      (t) => Number(t.total_votes || t.total_ballots || 0) > 0
    );

    if (activeTallies.length > 0) {
      return activeTallies.map((t) => {
        const pcName = t.constituency_name || t.pc_name || 'Bharat';
        const stName = t.state_name || t.state_ut || '';
        const { leadIdx, isTie } = determineLeadingOption(t, options.length);
        const optText = getOptionLabel(options[leadIdx], lang);

        return {
          seat: pcName,
          state: stName,
          stance: isTie
            ? (lang === 'HI' ? 'बराबर मत' : 'Split Mat')
            : formatTickerStance(optText),
          isFortified: Number(t.total_votes || t.total_ballots || 0) >= 50,
          isTie
        };
      });
    }

    const sampleSeats = [
      { pc: 'Darbhanga', st: 'Bihar' },
      { pc: 'Bangalore South', st: 'Karnataka' },
      { pc: 'Kanpur', st: 'UP' },
      { pc: 'Nagpur', st: 'Maharashtra' },
      { pc: 'New Delhi', st: 'Delhi' },
      { pc: 'Patna Sahib', st: 'Bihar' },
      { pc: 'Hyderabad', st: 'Telangana' },
      { pc: 'Jaipur', st: 'Rajasthan' }
    ];

    return sampleSeats.map((seed, idx) => {
      const optIdx = idx % options.length;
      const optText = getOptionLabel(options[optIdx], lang);
      return {
        seat: seed.pc,
        state: seed.st,
        stance: formatTickerStance(optText),
        isFortified: idx % 2 === 0,
        isTie: false
      };
    });
  }, [tallies, options, lang]);

  // Standard static duplicate list
  const loopItems = useMemo(() => {
    if (streamItems.length === 0) return [];
    let list = [...streamItems];
    while (list.length < 8) {
      list = [...list, ...streamItems];
    }
    return [...list, ...list];
  }, [streamItems]);

  if (loopItems.length === 0) return null;

  // Compute fixed duration purely from item count so it NEVER mutates or flashes after mount
  const calculatedDuration = Math.max(24, Math.round(loopItems.length * 2.8));

  return (
    <div
      style={{
        width: '100%',
        height: '32px',
        backgroundColor: '#090d16',
        borderRadius: '10px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        margin: '6px 0 10px 0',
        position: 'relative',
        boxSizing: 'border-box',
        border: '1px solid #1e293b',
        userSelect: 'none'
      }}
    >
      <style>{`
        @keyframes bhumatConstantSpeedScroll {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes tickerDotGlow {
          0% { transform: scale(0.9); opacity: 0.85; }
          50% { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.85; }
        }
        .bhumat-constant-track {
          display: inline-flex;
          align-items: center;
          gap: 24px;
          will-change: transform;
        }
        .bhumat-constant-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Pinned Left LIVE 543 Badge */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
          backgroundColor: '#090d16',
          padding: '0 8px 0 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          borderRight: '1px solid #1e293b',
          boxShadow: '4px 0 10px rgba(9, 13, 22, 0.95)'
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isJanMat ? '#10b981' : '#f59e0b',
            boxShadow: `0 0 6px ${isJanMat ? '#10b981' : '#f59e0b'}`,
            animation: 'tickerDotGlow 1.8s infinite ease-in-out'
          }}
        />
        <span
          style={{
            fontSize: '9.5px',
            fontWeight: 900,
            color: '#38bdf8',
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
          }}
        >
          {lang === 'HI' ? 'लाइव 543' : 'LIVE 543'}
        </span>
      </div>

      {/* Smooth Marquee Track with Deterministic Duration */}
      <div style={{ width: '100%', overflow: 'hidden', paddingLeft: '86px' }}>
        <div
          className="bhumat-constant-track"
          style={{
            animation: `bhumatConstantSpeedScroll ${calculatedDuration}s linear infinite`
          }}
        >
          {loopItems.map((item, idx) => (
            <div
              key={`${item.seat}-${idx}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#cbd5e1',
                whiteSpace: 'nowrap'
              }}
            >
              <span style={{ color: '#ffffff', fontWeight: 800 }}>
                📍 {item.seat}
              </span>
              {item.state && (
                <span style={{ fontSize: '9px', color: '#64748b' }}>
                  ({item.state})
                </span>
              )}
              <span style={{ color: '#475569', fontSize: '10px' }}>:</span>
              <span
                style={{
                  color: item.isTie
                    ? '#f59e0b'
                    : item.isFortified
                    ? '#38bdf8'
                    : '#34d399',
                  fontWeight: 800
                }}
              >
                {item.stance}
              </span>
              <span style={{ color: '#1e293b', marginLeft: '6px' }}>•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}