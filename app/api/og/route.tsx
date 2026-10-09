import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const seat = searchParams.get('seat') || 'Bharat';
  const state = searchParams.get('state') || 'National';
  const verdict = searchParams.get('verdict') || 'Live Consensus';
  const pct = searchParams.get('pct') || '62';
  const question = searchParams.get('q') || 'Sovereign JanMat Consensus Audit';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0f172a',
          padding: '60px 70px',
          fontFamily: 'sans-serif'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: '#38bdf8', letterSpacing: '-0.04em' }}>
              BHUMAT
            </span>
            <span
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: '#0369a1',
                backgroundColor: '#e0f2fe',
                padding: '4px 12px',
                borderRadius: '999px'
              }}
            >
              DRISHTI BHARAT
            </span>
          </div>
          <span style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 600 }}>
            543 Parliamentary Seats
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '20px', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase' }}>
            📍 {seat} ({state}) Audit Report
          </div>
          <div style={{ fontSize: '36px', color: '#ffffff', fontWeight: 900, lineHeight: 1.25 }}>
            "{question}"
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#1e293b',
            border: '2px solid #334155',
            borderRadius: '20px',
            padding: '24px 32px'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '15px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>
              Leading Verdict
            </span>
            <span style={{ fontSize: '32px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
              {verdict}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '42px', fontWeight: 900, color: '#38bdf8' }}>
              {pct}%
            </span>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 700 }}>
              Consensus Lead
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '16px', color: '#64748b', fontWeight: 600 }}>
            ECI Delimitation Compliant • Cryptographic Secret Ballot
          </span>
          <span style={{ fontSize: '18px', color: '#10b981', fontWeight: 800 }}>
            bhumat.com
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630
    }
  );
}