'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lleeljlvqltfzlidmsqs.supabase.co';
const supabaseUrl = rawUrl.replace(/[()]/g, '').trim();
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZWVsamx2cWx0ZnpsaWRtc3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODE3NTUsImV4cCI6MjEwNjk1Nzc1NX0.sQdPyFJpjKrt8mZx_xpOh8lgYPxCGrsO7IgDmxiwJfc';
const supabaseKey = rawKey.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand',
  'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh', 'Maharashtra', 'Odisha',
  'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

export default function AdminPollManager() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');

  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  // Form State with Scheduling & Participation Mode
  const [newPoll, setNewPoll] = useState({
    id: `poll_${Date.now().toString().slice(-4)}`,
    category: 'JanMat',
    title_en: '',
    title_hi: '',
    option_0_en: '',
    option_0_hi: '',
    option_1_en: '',
    option_1_hi: '',
    option_2_en: '',
    option_2_hi: '',
    recurrence: 'monthly',
    participation_mode: 'recurring', // 'one_time' | 'recurring'
    current_cycle: '2026-10',
    target_region_type: 'PAN_INDIA',
    target_region_value: 'PAN India',
    starts_at: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
    is_active: true
  });

  async function fetchPolls() {
    setLoading(true);
    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .order('starts_at', { ascending: false });

    if (data && !error) setPolls(data);
    setLoading(false);
  }

  useEffect(() => {
    if (isAuthenticated) fetchPolls();
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === 'bhumat2026' || passcode === 'bhumat_admin') {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Invalid Sovereign Admin Passcode');
    }
  };

  async function handleToggleActive(pollId: string, currentStatus: boolean) {
    const { error } = await supabase
      .from('polls')
      .update({ is_active: !currentStatus })
      .eq('id', pollId);

    if (!error) fetchPolls();
  }

  async function handleManageBlackout(poll: any) {
    const currentBlackouts = poll.blackout_seats || [];
    const input = prompt(
      `ECI Election Silence Window for ${poll.id}:\nEnter comma-separated Lok Sabha seats to pause audits in:\n\nCurrent blackouts: [${currentBlackouts.join(', ')}]`,
      currentBlackouts.join(', ')
    );

    if (input !== null) {
      const seats = input
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const { error } = await supabase
        .from('polls')
        .update({ blackout_seats: seats })
        .eq('id', poll.id);

      if (!error) {
        setStatusMessage(`✓ Updated election blackout seats for ${poll.id}`);
        fetchPolls();
        setTimeout(() => setStatusMessage(''), 3500);
      }
    }
  }

  async function handleCreatePoll(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage('Scheduling poll in sovereign registry...');

    const payload = {
      ...newPoll,
      starts_at: new Date(newPoll.starts_at).toISOString(),
      blackout_seats: []
    };

    const { error } = await supabase.from('polls').insert([payload]);

    if (!error) {
      setStatusMessage('✓ Poll published with scheduled live trigger!');
      setNewPoll({
        id: `poll_${Date.now().toString().slice(-4)}`,
        category: 'JanMat',
        title_en: '',
        title_hi: '',
        option_0_en: '',
        option_0_hi: '',
        option_1_en: '',
        option_1_hi: '',
        option_2_en: '',
        option_2_hi: '',
        recurrence: 'monthly',
        participation_mode: 'recurring',
        current_cycle: '2026-10',
        target_region_type: 'PAN_INDIA',
        target_region_value: 'PAN India',
        starts_at: new Date().toISOString().slice(0, 16),
        is_active: true
      });
      fetchPolls();
      setTimeout(() => setStatusMessage(''), 4000);
    } else {
      setStatusMessage(`Error: ${error.message}`);
    }
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: '#ffffff', padding: '36px 32px', borderRadius: '20px', width: '320px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '3px 10px', borderRadius: '999px', textTransform: 'uppercase' }}>
              BhuMat Command Auth
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '12px 0 4px 0', color: '#0f172a' }}>Editorial Login</h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Enter sovereign admin key</p>
          </div>

          <input
            type="password"
            required
            placeholder="Passcode (bhumat2026)"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
          />

          {authError && <div style={{ color: '#e11d48', fontSize: '12px', fontWeight: 600, textAlign: 'center' }}>{authError}</div>}

          <button
            type="submit"
            style={{ width: '100%', padding: '12px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
          >
            Access Command Center 🔒
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', padding: '32px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'inline-block', backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', marginBottom: '6px' }}>
              BHUMAT SOVEREIGN ADMIN
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Poll Command Center</h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setIsAuthenticated(false)}
              style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}
            >
              Lock Deck 🔒
            </button>
            <a
              href="/"
              style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#334155', textDecoration: 'none' }}
            >
              ← View Citizen App
            </a>
          </div>
        </div>

        {/* Create / Schedule New Poll Form */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a' }}>Publish & Schedule Ballot Question</h2>

          <form onSubmit={handleCreatePoll} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Row 1: Identification & Timing */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Poll Identifier</label>
                <input
                  type="text"
                  required
                  value={newPoll.id}
                  onChange={(e) => setNewPoll({ ...newPoll, id: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Pillar</label>
                <select
                  value={newPoll.category}
                  onChange={(e) => setNewPoll({ ...newPoll, category: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '13px' }}
                >
                  <option value="JanMat">JanMat (Audit / 8 PM)</option>
                  <option value="LokMat">LokMat (Culture / 8 AM)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#0369a1', marginBottom: '6px' }}>
                  ⏰ Go-Live Time (starts_at)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newPoll.starts_at}
                  onChange={(e) => setNewPoll({ ...newPoll, starts_at: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px', borderRadius: '8px', border: '1.5px solid #38bdf8', backgroundColor: '#f0f9ff', fontSize: '12.5px', fontWeight: 700, color: '#0369a1' }}
                />
              </div>
            </div>

            {/* Row 2: Recurrence & Participation Rules */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Participation Mode</label>
                <select
                  value={newPoll.participation_mode}
                  onChange={(e) => setNewPoll({ ...newPoll, participation_mode: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', fontWeight: 700 }}
                >
                  <option value="one_time">One-Time Ballot (Locked Forever)</option>
                  <option value="recurring">Recurring (Resets Each Cycle)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Recurrence Cadence</label>
                <select
                  disabled={newPoll.participation_mode === 'one_time'}
                  value={newPoll.recurrence}
                  onChange={(e) => setNewPoll({ ...newPoll, recurrence: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: newPoll.participation_mode === 'one_time' ? '#e2e8f0' : '#ffffff', fontSize: '13px' }}
                >
                  <option value="daily">Daily Drop</option>
                  <option value="weekly">Weekly Drop</option>
                  <option value="monthly">Monthly Cycle</option>
                  <option value="quarterly">Quarterly Cycle</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Current Cycle Tag</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026-10"
                  value={newPoll.current_cycle}
                  onChange={(e) => setNewPoll({ ...newPoll, current_cycle: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Target Region Scope Config */}
            <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #a7f3d0', borderRadius: '12px', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '14px', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#065f46', marginBottom: '4px' }}>
                  TARGET REGION SCOPE
                </label>
                <select
                  value={newPoll.target_region_type}
                  onChange={(e) => {
                    const type = e.target.value;
                    setNewPoll({
                      ...newPoll,
                      target_region_type: type,
                      target_region_value: type === 'PAN_INDIA' ? 'PAN India' : (type === 'STATE' ? 'Bihar' : 'Darbhanga')
                    });
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #a7f3d0', backgroundColor: '#ffffff', fontSize: '13px', fontWeight: 700, color: '#065f46' }}
                >
                  <option value="PAN_INDIA">🇮🇳 PAN India (All 543 Seats)</option>
                  <option value="STATE">📍 Specific State / UT Only</option>
                  <option value="CONSTITUENCY">🎯 Specific Parliamentary Seat Only</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#065f46', marginBottom: '4px' }}>
                  {newPoll.target_region_type === 'PAN_INDIA' ? 'National Coverage' : 'Target Region Value'}
                </label>
                {newPoll.target_region_type === 'PAN_INDIA' && (
                  <input
                    type="text"
                    disabled
                    value="Active across all 543 Parliamentary Constituencies"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ecfdf5', fontSize: '12px', color: '#047857', fontWeight: 600 }}
                  />
                )}
                {newPoll.target_region_type === 'STATE' && (
                  <select
                    value={newPoll.target_region_value}
                    onChange={(e) => setNewPoll({ ...newPoll, target_region_value: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', fontWeight: 700 }}
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                )}
                {newPoll.target_region_type === 'CONSTITUENCY' && (
                  <input
                    type="text"
                    required
                    placeholder="e.g. Darbhanga, Araria, Bangalore South"
                    value={newPoll.target_region_value}
                    onChange={(e) => setNewPoll({ ...newPoll, target_region_value: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', fontWeight: 700 }}
                  />
                )}
              </div>
            </div>

            {/* Questions */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Question (English)</label>
              <input
                type="text"
                required
                placeholder="e.g. Should municipal authorities face statutory financial penalties for failing drinking water purity standards?"
                value={newPoll.title_en}
                onChange={(e) => setNewPoll({ ...newPoll, title_en: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Question (Hindi / हिन्दी)</label>
              <input
                type="text"
                required
                placeholder="e.g. क्या पेयजल शुद्धता मानकों में विफल रहने पर नगर निगमों पर कानूनी जुर्माना होना चाहिए?"
                value={newPoll.title_hi}
                onChange={(e) => setNewPoll({ ...newPoll, title_hi: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '13px' }}
              />
            </div>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Standardized 3 Ballot Choices:</span>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="text"
                  required
                  placeholder="Option 1 (English)"
                  value={newPoll.option_0_en}
                  onChange={(e) => setNewPoll({ ...newPoll, option_0_en: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
                <input
                  type="text"
                  required
                  placeholder="विकल्प 1 (हिन्दी)"
                  value={newPoll.option_0_hi}
                  onChange={(e) => setNewPoll({ ...newPoll, option_0_hi: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="text"
                  required
                  placeholder="Option 2 (English)"
                  value={newPoll.option_1_en}
                  onChange={(e) => setNewPoll({ ...newPoll, option_1_en: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
                <input
                  type="text"
                  required
                  placeholder="विकल्प 2 (हिन्दी)"
                  value={newPoll.option_1_hi}
                  onChange={(e) => setNewPoll({ ...newPoll, option_1_hi: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="text"
                  required
                  placeholder="Option 3 (English)"
                  value={newPoll.option_2_en}
                  onChange={(e) => setNewPoll({ ...newPoll, option_2_en: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
                <input
                  type="text"
                  required
                  placeholder="विकल्प 3 (हिन्दी)"
                  value={newPoll.option_2_hi}
                  onChange={(e) => setNewPoll({ ...newPoll, option_2_hi: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#059669' }}>{statusMessage}</span>
              <button
                type="submit"
                style={{ backgroundColor: '#10b981', color: '#ffffff', fontWeight: 800, padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px' }}
              >
                + Publish to Sovereign Network
              </button>
            </div>
          </form>
        </div>

        {/* Existing Polls Table with Schedule Status */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a' }}>Active Network Polls & Schedules</h2>

          {loading ? (
            <p style={{ color: '#64748b', fontSize: '13px' }}>Loading registered polls...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {polls.map((p) => {
                const blackouts = p.blackout_seats || [];
                const isFuture = new Date(p.starts_at) > new Date();

                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 18px',
                      borderRadius: '10px',
                      backgroundColor: isFuture ? '#eff6ff' : '#f8fafc',
                      border: isFuture ? '1.5px solid #bfdbfe' : '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ maxWidth: '600px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ backgroundColor: p.category === 'JanMat' ? '#dcfce7' : '#fef3c7', color: p.category === 'JanMat' ? '#15803d' : '#b45309', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', textTransform: 'uppercase' }}>
                          {p.category}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>{p.id}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                          {p.participation_mode === 'one_time' ? 'One-Time' : `Recurring: ${p.current_cycle} (${p.recurrence})`}
                        </span>
                        <span style={{ fontSize: '11px', color: isFuture ? '#d97706' : (p.is_active ? '#059669' : '#94a3b8'), fontWeight: 800 }}>
                          {isFuture ? `⏳ SCHEDULED (${new Date(p.starts_at).toLocaleDateString()} ${new Date(p.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : (p.is_active ? '● LIVE' : '○ RETIRED')}
                        </span>
                        {blackouts.length > 0 && (
                          <span style={{ fontSize: '10px', color: '#b91c1c', backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                            ⚠️ {blackouts.length} Seats Blacked Out (ECI)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{p.title_en}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{p.title_hi}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => handleManageBlackout(p)}
                        style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', color: '#c2410c', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        ECI Silence ({blackouts.length})
                      </button>

                      <button
                        onClick={() => handleToggleActive(p.id, p.is_active)}
                        style={{
                          backgroundColor: p.is_active ? '#fff1f2' : '#f0fdf4',
                          color: p.is_active ? '#e11d48' : '#15803d',
                          border: p.is_active ? '1px solid #fecdd3' : '1px solid #bbf7d0',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {p.is_active ? 'Deactivate' : 'Set Live'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}