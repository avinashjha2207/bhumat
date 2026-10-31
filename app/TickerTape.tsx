'use client';

import React, { useMemo } from 'react';

const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];

interface TickerItem {
  seat: string;
  state: string;
  stance: string;
  stanceColor?: string;
  isFortified: boolean;
  isTie: boolean;
  isCallout: boolean;
}

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

function formatTickerStance(text: string, maxLen = 22): string {
  if (!text) return 'Consensus Active';
  let clean = text.split('(')[0].trim();
  if (clean.length > maxLen) {
    clean = clean.slice(0, maxLen - 1).trim() + '…';
  }
  return clean;
}

function determineLeadingOption(tally: any, optionsCount: number): { leadIdx: number; isTie: boolean; totalVotes: number } {
  if (!tally) return { leadIdx: 0, isTie: false, totalVotes: 0 };
  const totalVotes = Number(tally.total_votes || tally.total_ballots || 0);

  if (tally.leading_option_id !== undefined && tally.leading_option_id !== null) {
    return { leadIdx: Number(tally.leading_option_id), isTie: Boolean(tally.is_tie), totalVotes };
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

  return { leadIdx, isTie: tieCount > 1, totalVotes };
}

export default function TickerTape({
  tallies = [],
  options = [],
  pollCategory = 'LokMat',
  lang = 'EN'
}: TickerTapeProps) {
  const isJanMat = pollCategory === 'JanMat';

  const streamItems = useMemo<TickerItem[]>(() => {
    if (!options || options.length === 0) return [];

    const activeTallies = (tallies || []).filter(
      (t) => Number(t.total_votes || t.total_ballots || 0) > 0
    );

    // Scenario A: At least one seat has cast ballots
    if (activeTallies.length > 0) {
      const items = activeTallies.map((t) => {
        const pcName = t.constituency_name || t.pc_name || 'Bharat';
        const stName = t.state_name || t.state_ut || '';
        const { leadIdx, isTie, totalVotes } = determineLeadingOption(t, options.length);
        const optObj = options[leadIdx];
        const optText = getOptionLabel(optObj, lang);
        const customClr = optObj?.color;
        const stanceColor = (customClr && customClr !== '#ffffff' && customClr !== '#fff')
          ? customClr
          : OPTION_PALETTE[leadIdx % OPTION_PALETTE.length];

        return {
          seat: pcName,
          state: stName,
          stance: isTie
            ? (lang === 'HI' ? 'बराबर मत (Split Mat)' : 'Split Mat')
            : formatTickerStance(optText),
          stanceColor: isTie ? '#f59e0b' : stanceColor,
          isFortified: totalVotes >= 50,
          isTie,
          isCallout: false
        };
      });

      // If only 1 or 2 seats have voted, interleave authentic regional discovery callouts
      if (items.length < 4) {
        const callouts = [
          {
            seat: lang === 'HI' ? 'अखिल भारतीय जनमत' : 'Pan-Bharat Scoreboard',
            state: '543 Seats',
            stance: lang === 'HI' ? 'मतदान कर अपने क्षेत्र का मत दर्ज करें' : 'Cast ballot to unlock your seat',
            isFortified: false,
            isTie: false,
            isCallout: true
          },
          {
            seat: lang === 'HI' ? 'संवैधानिक कोरम' : 'Constitutional Quorum',
            state: '50 Votes',
            stance: lang === 'HI' ? '50 सत्यापित मतों पर सीट प्रमाणित' : '50 verified votes unlocks map color',
            isFortified: true,
            isTie: false,
            isCallout: true
          }
        ];
        return [...items, ...callouts];
      }

      return items;
    }

    // Scenario B: Zero votes across all 543 seats (Fresh / Day-0 launch state)
    // NEVER show fake stance data. Show authentic awaiting-consensus messaging.
    return [
      {
        seat: lang === 'HI' ? 'अखिल भारतीय जनमत' : 'Pan-Bharat Scoreboard',
        state: '543 Seats',
        stance: lang === 'HI' ? 'शुरुआती मतों की प्रतीक्षा जारी' : 'Awaiting first verified ballots',
        isFortified: false,
        isTie: false,
        isCallout: true
      },
      {
        seat: lang === 'HI' ? 'संसदीय सीट' : 'Constituency Telemetry',
        state: 'Live',
        stance: lang === 'HI' ? 'पहला मत देकर अपनी सीट सक्रिय करें' : 'Be the first to vote from your seat',
        isFortified: true,
        isTie: false,
        isCallout: true
      },
      {
        seat: lang === 'HI' ? 'गोपनीय मतपेटी' : 'Secret Ballot Vault',
        state: 'Zero GPS',
        stance: lang === 'HI' ? '100% गोपनीय व सत्यापित' : '100% anonymous & verified',
        isFortified: false,
        isTie: false,
        isCallout: true
      }
    ];
  }, [tallies, options, lang]);

  // Duplicate stream items to achieve smooth, seamless marquee looping
  const loopItems = useMemo(() => {
    if (streamItems.length === 0) return [];
    let list = [...streamItems];
    while (list.length < 6) {
      list = [...list, ...streamItems];
    }
    return [...list, ...list];
  }, [streamItems]);

  if (loopItems.length === 0) return null;

  const calculatedDuration = Math.max(26, Math.round(loopItems.length * 3.5));

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

      {/* Pinned Left LIVE 543 Indicator Badge */}
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

      {/* Marquee Track with Deterministic Continuous Duration */}
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
              <span style={{ color: item.isCallout ? '#38bdf8' : '#ffffff', fontWeight: 800 }}>
                {item.isCallout ? '⚡' : '📍'} {item.seat}
              </span>
              {item.state && (
                <span style={{ fontSize: '9px', color: '#64748b' }}>
                  ({item.state})
                </span>
              )}
              <span style={{ color: '#475569', fontSize: '10px' }}>:</span>
              <span
                style={{
                  color: item.isCallout
                    ? (item.isFortified ? '#38bdf8' : '#34d399')
                    : (item.stanceColor || (item.isTie ? '#f59e0b' : '#34d399')),
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