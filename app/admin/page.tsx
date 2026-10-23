'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import Link from 'next/link';

interface Poll {
  id: string;
  category: string;
  title_en: string;
  title_hi: string;
  starts_at?: string;
  current_cycle?: string;
  recurrence?: string;
  is_active?: boolean;
  blackout_seats?: string[];
  options: { id: number; text_en: string; text_hi: string }[];
}

export default function AdminDashboard() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [otpLogs, setOtpLogs] = useState<any[]>([]);
  const [blackoutSeatInput, setBlackoutSeatInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [integrityData, setIntegrityData] = useState<{
    lokmatCount: number;
    janmatCount: number;
    talliesTotal: number;
    drift: number;
  }>({ lokmatCount: 0, janmatCount: 0, talliesTotal: 0, drift: 0 });

  // 1. Load active polls from public.polls
  async function loadPolls() {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('starts_at', { ascending: false });
      if (data && !error) {
        setPolls(data);
        if (data.length > 0 && !selectedPoll) {
          setSelectedPoll(data[0]);
        }
      }
    } catch (err) {
      console.warn('Admin load polls error:', err);
    }
  }

  // 2. Load Live OTP dispatch records from public.citizen_otp_store
  async function loadOtpLogs() {
    try {
      const { data, error } = await supabase
        .from('citizen_otp_store')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data && !error) {
        setOtpLogs(data);
      }
    } catch (err) {
      console.warn('Admin load OTP logs error:', err);
    }
  }

  // 3. Cryptographic reconciliation check between vaults and matrix
  async function checkIntegrity() {
    try {
      const { count: lokmatCount } = await supabase
        .from('lokmat_votes')
        .select('*', { count: 'exact', head: true });

      const { count: janmatCount } = await supabase
        .from('janmat_anonymous_ballots')
        .select('*', { count: 'exact', head: true });

      const { data: tallies } = await supabase
        .from('constituency_tallies')
        .select('total_ballots');

      const sumTallies = tallies ? tallies.reduce((sum, r) => sum + (r.total_ballots || 0), 0) : 0;
      const totalVault = (lokmatCount || 0) + (janmatCount || 0);

      setIntegrityData({
        lokmatCount: lokmatCount || 0,
        janmatCount: janmatCount || 0,
        talliesTotal: sumTallies,
        drift: totalVault - sumTallies,
      });
    } catch (err) {
      console.warn('Integrity check error:', err);
    }
  }

  useEffect(() => {
    loadPolls();
    loadOtpLogs();
    checkIntegrity();
  }, []);

  // 4. Apply 48-Hour ECI Silence (Section 126 Blackout)
  const handleApplyBlackout = async () => {
    if (!selectedPoll) return;
    const cleanSeat = blackoutSeatInput.trim();
    if (!cleanSeat) return;

    setLoading(true);
    const currentBlackouts = Array.isArray(selectedPoll.blackout_seats) ? selectedPoll.blackout_seats : [];
    if (currentBlackouts.includes(cleanSeat)) {
      setStatusMessage(`Seat "${cleanSeat}" is already under statutory blackout.`);
      setLoading(false);
      return;
    }

    const updated = [...currentBlackouts, cleanSeat];
    const { error } = await supabase
      .from('polls')
      .update({ blackout_seats: updated })
      .eq('id', selectedPoll.id);

    setLoading(false);
    if (error) {
      setStatusMessage(`Error: ${error.message}`);
    } else {
      setStatusMessage(`✓ Applied 48-hr silence to ${cleanSeat}`);
      setSelectedPoll({ ...selectedPoll, blackout_seats: updated });
      setPolls(polls.map((p) => (p.id === selectedPoll.id ? { ...p, blackout_seats: updated } : p)));
      setBlackoutSeatInput('');
    }
  };

  // 5. Remove Silence from seat
  const handleRemoveBlackout = async (seatName: string) => {
    if (!selectedPoll) return;
    const updated = (selectedPoll.blackout_seats || []).filter((s) => s !== seatName);
    await supabase.from('polls').update({ blackout_seats: updated }).eq('id', selectedPoll.id);
    setSelectedPoll({ ...selectedPoll, blackout_seats: updated });
    setPolls(polls.map((p) => (p.id === selectedPoll.id ? { ...p, blackout_seats: updated } : p)));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🛡️</span>
              <h1 style={{ fontSize: '20px', fontWeight: 900, margin: 0, color: '#38bdf8' }}>
                BhuMat Sovereign Command & Admin Suite
              </h1>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Canonical Schema Monitor • 543 Lok Sabha Constituencies • Cryptographic Audit
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link
              href="/"
              style={{ padding: '8px 14px', backgroundColor: '#0284c7', color: '#fff', borderRadius: '8px', fontSize: '12px', fontWeight: 800, textDecoration: 'none' }}
            >
              👁️ View Live Feed ↗
            </Link>
          </div>
        </div>

        {/* SECTION 1: CRYPTOGRAPHIC PARITY & DRIFT AUDIT */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Section A: Cryptographic Parity & Audit
            </span>
            <button
              onClick={checkIntegrity}
              style={{ background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
            >
              ↻ Recheck
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '10px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>LokMat Ballots</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#f59e0b', marginTop: '2px' }}>{integrityData.lokmatCount}</div>
            </div>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '10px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>JanMat Secret Box</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>{integrityData.janmatCount}</div>
            </div>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '10px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Consensus Matrix Tallies</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#38bdf8', marginTop: '2px' }}>{integrityData.talliesTotal}</div>
            </div>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '10px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Audit Status</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: integrityData.drift === 0 ? '#10b981' : '#ef4444', marginTop: '4px' }}>
                {integrityData.drift === 0 ? '✓ Zero Drift' : `⚠️ Drift: ${integrityData.drift}`}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: LIVE OTP DISPATCH MONITOR (citizen_otp_store) */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Section B: Live OTP Dispatch Ledger (`citizen_otp_store`)
            </span>
            <button
              onClick={loadOtpLogs}
              style={{ background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
            >
              ↻ Refresh OTPs
            </button>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '200px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '8px' }}>Identifier</th>
                  <th style={{ padding: '8px' }}>6-Digit OTP</th>
                  <th style={{ padding: '8px' }}>Channel</th>
                  <th style={{ padding: '8px' }}>Status</th>
                  <th style={{ padding: '8px' }}>Dispatched At</th>
                </tr>
              </thead>
              <tbody>
                {otpLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>
                      No verification OTPs recorded yet in `citizen_otp_store`.
                    </td>
                  </tr>
                ) : (
                  otpLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '8px', fontWeight: 700, color: '#f8fafc' }}>{log.target_identifier}</td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 900 }}>{log.otp_code}</td>
                      <td style={{ padding: '8px', color: '#94a3b8' }}>{log.channel}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          backgroundColor: log.is_consumed ? '#064e3b' : '#78350f',
                          color: log.is_consumed ? '#6ee7b7' : '#fde68a',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 800
                        }}>
                          {log.is_consumed ? 'CONSUMED' : 'PENDING'}
                        </span>
                      </td>
                      <td style={{ padding: '8px', color: '#64748b', fontSize: '11px' }}>
                        {new Date(log.created_at).toLocaleTimeString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3: STATUTORY 48H ECI SILENCE (BLACKOUT CONTROLS) */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#f43f5e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Section C: ECI Section 126 Statutory Silence Controls (48h Blackout)
            </span>
            <select
              value={selectedPoll?.id || ''}
              onChange={(e) => setSelectedPoll(polls.find((p) => p.id === e.target.value) || null)}
              style={{ backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '6px', padding: '6px 10px', fontSize: '11px' }}
            >
              {polls.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.category}: {p.title_en.slice(0, 45)}...
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
            <input
              type="text"
              placeholder="Constituency name to silence (e.g. Purvi Champaran, Nagpur, Banka)..."
              value={blackoutSeatInput}
              onChange={(e) => setBlackoutSeatInput(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1.5px solid #334155',
                backgroundColor: '#0f172a',
                color: '#fff',
                fontSize: '12.5px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleApplyBlackout}
              disabled={loading || !blackoutSeatInput.trim()}
              style={{
                padding: '10px 16px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Apply 48h Silence
            </button>
          </div>

          {statusMessage && (
            <div style={{ fontSize: '11px', color: statusMessage.startsWith('✓') ? '#10b981' : '#f87171', marginTop: '8px', fontWeight: 700 }}>
              {statusMessage}
            </div>
          )}

          {/* Active Blackouts */}
          {selectedPoll?.blackout_seats && selectedPoll.blackout_seats.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', alignSelf: 'center', fontWeight: 700 }}>Active Silence Seats:</span>
              {selectedPoll.blackout_seats.map((seat) => (
                <span
                  key={seat}
                  style={{
                    backgroundColor: '#450a0a',
                    border: '1px solid #7f1d1d',
                    color: '#fca5a5',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  🏛️ {seat}
                  <button
                    onClick={() => handleRemoveBlackout(seat)}
                    style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontWeight: 900, padding: 0 }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}