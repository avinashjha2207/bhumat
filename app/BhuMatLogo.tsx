'use client';

import React from 'react';

interface BhuMatLogoProps {
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  onClick?: () => void;
}

export default function BhuMatLogo({
  animated = true,
  size = 'md',
  showSubtitle = true,
  onClick,
}: BhuMatLogoProps) {
  const dim = {
    sm: { emblemSize: 30, titleSize: 20, badgeFontSize: 7, earlyAccessSize: 7.5, gap: 9 },
    md: { emblemSize: 38, titleSize: 24, badgeFontSize: 8, earlyAccessSize: 8.5, gap: 10 },
    lg: { emblemSize: 48, titleSize: 30, badgeFontSize: 9, earlyAccessSize: 9.5, gap: 12 },
  }[size];

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${dim.gap}px`,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes spinClockwise {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spinCounterClockwise {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes beaconHeartbeat {
          0% { transform: scale(0.92); opacity: 0.85; }
          50% { transform: scale(1.18); opacity: 1; filter: drop-shadow(0 0 5px #10b981); }
          100% { transform: scale(0.92); opacity: 0.85; }
        }
        @keyframes beaconWaveRipple {
          0% { r: 6.5px; opacity: 0.85; stroke-width: 1.8px; }
          100% { r: 17px; opacity: 0; stroke-width: 0.4px; }
        }
        /* Tier 1: National Orbit (Clockwise, 24s) */
        .ring-national-orbit {
          transform-origin: 22px 22px;
          animation: spinClockwise 24s linear infinite;
        }
        /* Tier 2: State Orbit (Counter-Clockwise, 16s) */
        .ring-state-orbit {
          transform-origin: 22px 22px;
          animation: spinCounterClockwise 16s linear infinite;
        }
        /* Tier 3: Lok Sabha Orbit (Clockwise, 10s) */
        .ring-loksabha-orbit {
          transform-origin: 22px 22px;
          animation: spinClockwise 10s linear infinite;
        }
        .emblem-pulse {
          transform-origin: 22px 22px;
          animation: beaconHeartbeat 2.2s ease-in-out infinite;
        }
        .emblem-wave {
          animation: beaconWaveRipple 2.4s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
        }
      `}</style>

      {/* 1. Sovereign 3-Tier Astrolabe Emblem */}
      <svg
        width={dim.emblemSize}
        height={dim.emblemSize}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <linearGradient id="logoNeedleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* Squircle Base */}
        <rect width="44" height="44" rx="11" fill="url(#logoBgGrad)" stroke="#1e293b" strokeWidth="1.2" />

        {/* TIER 1: National Outer Ring (Clockwise, 24s) */}
        <g className={animated ? 'ring-national-orbit' : ''}>
          <circle cx="22" cy="22" r="16.5" stroke="#0284c7" strokeWidth="1.2" strokeDasharray="5,4" opacity="0.7" />
          <circle cx="38.5" cy="22" r="1.4" fill="#38bdf8" />
          <circle cx="5.5" cy="22" r="1.4" fill="#38bdf8" />
        </g>

        {/* TIER 2: State Middle Ring (Counter-Clockwise, 16s) */}
        <g className={animated ? 'ring-state-orbit' : ''}>
          <circle cx="22" cy="22" r="11.5" stroke="#0ea5e9" strokeWidth="1.2" strokeDasharray="3,3" opacity="0.6" />
          <circle cx="22" cy="10.5" r="1.3" fill="#38bdf8" />
          <circle cx="22" cy="33.5" r="1.3" fill="#10b981" />
        </g>

        {/* Consensus Wave Ripple */}
        {animated && <circle cx="22" cy="22" className="emblem-wave" stroke="#10b981" fill="none" />}

        {/* Bharat Spatial Needle Contour */}
        <path
          d="M 22 8
             C 24 10, 26 11, 28 13
             C 31 16, 32 18, 31 21
             C 29 25, 26 31, 22 36
             C 18 31, 15 25, 13 21
             C 12 18, 13 16, 16 13
             C 18 11, 20 10, 22 8 Z"
          fill="url(#logoNeedleGrad)"
          fillOpacity="0.16"
          stroke="url(#logoNeedleGrad)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* TIER 3: Lok Sabha Inner Ring (Clockwise, 10s) */}
        <g className={animated ? 'ring-loksabha-orbit' : ''}>
          <circle cx="22" cy="22" r="6.8" stroke="#10b981" strokeWidth="1.4" strokeDasharray="2,2" opacity="0.85" />
        </g>

        {/* TIER 0: Citizen Sovereign Core (Heartbeat Pulse) */}
        <g className={animated ? 'emblem-pulse' : ''}>
          <circle cx="22" cy="22" r="3.2" fill="#10b981" />
          <circle cx="22" cy="22" r="1.3" fill="#ffffff" />
        </g>

        {/* Saffron North & Emerald South Pin Accents */}
        <circle cx="22" cy="8" r="1.4" fill="#f97316" />
        <circle cx="22" cy="36" r="1.4" fill="#10b981" />
      </svg>

      {/* 2. Brand Wordmark & Early Access Stack */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5px' }}>
          {/* Indian Flag Saffron (Kesari) */}
          <span style={{ fontSize: `${dim.titleSize}px`, fontWeight: 900, color: '#f97316', letterSpacing: '-0.035em' }}>
            Bhu
          </span>
          {/* Indian Flag Green (India Green) */}
          <span style={{ fontSize: `${dim.titleSize}px`, fontWeight: 900, color: '#059669', letterSpacing: '-0.035em' }}>
            Mat
          </span>
        </div>

        {/* Unified EARLY ACCESS under BhuMat */}
        <span style={{
          fontSize: `${dim.earlyAccessSize}px`,
          fontWeight: 800,
          color: '#64748b',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginTop: '3.5px',
          lineHeight: 1
        }}>
          EARLY ACCESS
        </span>
      </div>
    </div>
  );
}