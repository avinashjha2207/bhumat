import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getStateSilhouette } from '../../utils/stateSilhouettes';

export const runtime = 'edge';

const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const seat = searchParams.get('seat') || 'Bharat';
    const state = searchParams.get('state') || '';
    const category = searchParams.get('category') || 'JanMat';
    const title = searchParams.get('title') || 'Public Opinion Consensus';
    const leadText = searchParams.get('lead') || 'Consensus Forming';
    const leadPct = searchParams.get('pct') || '0';
    const totalVotes = searchParams.get('total') || '0';
    const lang = searchParams.get('lang') || 'EN';
    const optionIdx = parseInt(searchParams.get('optIdx') || '0', 10);

    const isJanMat = category === 'JanMat';
    const accentColor = isJanMat ? '#059669' : '#d97706';
    const accentBg = isJanMat ? '#ecfdf5' : '#fffbeb';
    const accentBorder = isJanMat ? '#a7f3d0' : '#fde68a';
    const stanceColor = OPTION_PALETTE[optionIdx % OPTION_PALETTE.length] || accentColor;

    const silhouettePath = getStateSilhouette(state || seat);

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            backgroundColor: '#090d16',
            padding: '44px 50px',
            fontFamily: 'sans-serif',
            color: '#ffffff',
            boxSizing: 'border-box',
          }}
        >
          {/* LEFT COLUMN: 65% Main Content & Consensus Stats */}
          <div
            style={{
              width: '65%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              paddingRight: '36px',
            }}
          >
            {/* Top Bar: Brand & Category Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '32px', fontWeight: 900, color: '#38bdf8', letterSpacing: '-0.02em' }}>
                BhuMat
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  backgroundColor: accentBg,
                  color: accentColor,
                  border: `1.5px solid ${accentBorder}`,
                  padding: '4px 14px',
                  borderRadius: '999px',
                  textTransform: 'uppercase',
                }}
              >
                ● {category} {lang === 'HI' ? 'संप्रभु ऑडिट' : 'SOVEREIGN AUDIT'}
              </span>
            </div>

            {/* Question Title */}
            <div
              style={{
                fontSize: title.length > 75 ? '26px' : '32px',
                fontWeight: 850,
                color: '#f8fafc',
                lineHeight: 1.32,
                maxHeight: '130px',
                overflow: 'hidden',
                margin: '12px 0',
              }}
            >
              {title}
            </div>

            {/* Leading Consensus Highlight Card */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                backgroundColor: '#131b2e',
                border: '1.5px solid #1e293b',
                borderRadius: '16px',
                padding: '16px 20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {lang === 'HI' ? 'अग्रणी जनमत रुख' : 'Leading Seat Consensus'}
                </span>
                <span style={{ fontSize: '24px', fontWeight: 900, color: stanceColor }}>
                  {leadPct}%
                </span>
              </div>

              <div style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                {leadText}
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '8px', backgroundColor: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.max(6, Number(leadPct)))}%`,
                    height: '100%',
                    backgroundColor: stanceColor,
                  }}
                />
              </div>
            </div>

            {/* Footer Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#64748b', paddingTop: '8px' }}>
              <span>🗳️ {totalVotes} {lang === 'HI' ? 'मत दर्ज' : 'Ballots Cast'}</span>
              <span>•</span>
              <span style={{ color: '#10b981', fontWeight: 700 }}>
                {lang === 'HI' ? 'सत्यापित संप्रभु ग्रिड' : 'Verified Sovereign Grid'}
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN: 35% State Drishti Silhouette Canvas */}
          <div
            style={{
              width: '35%',
              height: '100%',
              backgroundColor: '#111827',
              border: '1.5px solid #1e293b',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '24px 18px',
              boxSizing: 'border-box',
              position: 'relative',
            }}
          >
            {/* Top Seat Tag */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                padding: '6px 14px',
                borderRadius: '999px',
                maxWidth: '95%',
              }}
            >
              <span style={{ fontSize: '13px' }}>📍</span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  color: '#38bdf8',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {seat}
              </span>
            </div>

            {/* Glowing State Silhouette Vector */}
            <div
              style={{
                width: '180px',
                height: '180px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <svg width="180" height="180" viewBox="0 0 100 100">
                {/* State Polygon Silhouette */}
                <path
                  d={silhouettePath}
                  fill={stanceColor}
                  fillOpacity="0.22"
                  stroke={stanceColor}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                {/* Beacon Radar Center */}
                <circle cx="50" cy="50" r="14" fill="none" stroke={stanceColor} strokeWidth="1.5" strokeOpacity="0.6" />
                <circle cx="50" cy="50" r="5" fill={stanceColor} />
              </svg>
            </div>

            {/* Jurisdiction Label & CTA */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {state || 'BHARAT'} DRISHTI
              </span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8' }}>
                {lang === 'HI' ? 'मतदान करें ❯' : 'Cast Ballot ❯'}
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err) {
    return new Response('Failed to generate image', { status: 500 });
  }
}