'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lleeljlvqltfzlidmsqs.supabase.co';
const supabaseUrl = rawUrl.replace(/[()]/g, '').trim();
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZWVsamx2cWx0ZnpsaWRtc3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODE3NTUsImV4cCI6MjEwNjk1Nzc1NX0.sQdPyFJpjKrt8mZx_xpOh8lgYPxCGrsO7IgDmxiwJfc';
const supabase = createClient(supabaseUrl, rawKey.trim());

interface OptionItem {
  id: number;
  text_en: string;
  text_hi: string;
}

export default function AdminPollManager() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  // 543 Constituencies List for Granular Multi-Select
  const [allConstituencies, setAllConstituencies] = useState<Array<{ id: string; name: string; state: string }>>([]);
  const [seatFilter, setSeatFilter] = useState('');

  // Form State: Dynamic 2 to 4 Options & Multi-Seat Arrays
  const [pollId, setPollId] = useState(`poll_${Date.now().toString().slice(-4)}`);
  const [category, setCategory] = useState<'JanMat' | 'LokMat'>('JanMat');
  const [titleEn, setTitleEn] = useState('');
  const [titleHi, setTitleHi] = useState('');
  const [recurrence, setRecurrence] = useState('monthly');
  const [participationMode, setParticipationMode] = useState('recurring');
  const [currentCycle, setCurrentCycle] = useState('2026-10');
  const [targetScope, setTargetScope] = useState<'PAN_INDIA' | 'CUSTOM_SEATS'>('PAN_INDIA');
  const [selectedTargetSeats, setSelectedTargetSeats] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 16));

  const [options, setOptions] = useState<OptionItem[]>([
    { id: 0, text_en: 'Excellent & Well Maintained', text_hi: 'बहुत अच्छी और सुव्यवस्थित' },
    { id: 1, text_en: 'Average / Regular Potholes', text_hi: 'औसत / आए दिन गड्ढे' },
    { id: 2, text_en: 'Severe Deterioration / Unsafe', text_hi: 'बेहद खराब और असुरक्षित' }
  ]);

  // Load 543 Seats List
  useEffect(() => {
    fetch('/india_pc_preprojected.json')
      .then((res) => res.json())
      .then((data) => {
        setAllConstituencies(data.map((d: any) => ({ id: d.id, name: d.name, state: d.state })));
      })
      .catch((e) => console.warn('Could not load seats:', e));
  }, []);

  async function fetchPolls() {
    setLoading(true);
    const { data } = await supabase.from('polls').select('*').order('starts_at', { ascending: false });
    if (data) setPolls(data);
    setLoading(false);
  }

  useEffect(() => {
    if (isAuthenticated) fetchPolls();
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === 'bhumat2026') {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Invalid Admin Passcode');
    }
  };

  const handleAddOption = () => {
    if (options.length >= 4) return;
    setOptions([...options, { id: options.length, text_en: '', text_hi: '' }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const updated = options.filter((_, i) => i !== index).map((opt, i) => ({ ...opt, id: i }));
    setOptions(updated);
  };

  const toggleTargetSeat = (seatName: string) => {
    setSelectedTargetSeats((prev) =>
      prev.includes(seatName) ? prev.filter((s) => s !== seatName) : [...prev, seatName]
    );
  };

  async function handleToggleBlackout(poll: any) {
    const seat = prompt(`Enter Lok Sabha seat name to add/remove from Election Silence Blackout for ${poll.id}:`);
    if (!seat) return;
    const current = poll.blackout_seats || [];
    const updated = current.includes(seat) ? current.filter((s: string) => s !== seat) : [...current, seat];
    await supabase.from('polls').update({ blackout_seats: updated }).eq('id', poll.id);
    fetchPolls();
  }

  async function handleCreatePoll(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage('Publishing poll to Sovereign Registry...');

    const payload = {
      id: pollId,
      category,
      title_en: titleEn,
      title_hi: titleHi,
      options,
      option_0_en: options[0]?.text_en || '',
      option_0_hi: options[0]?.text_hi || '',
      option_1_en: options[1]?.text_en || '',
      option_1_hi: options[1]?.text_hi || '',
      option_2_en: options[2]?.text_en || '',
      option_2_hi: options[2]?.text_hi || '',
      recurrence,
      participation_mode: participationMode,
      current_cycle: currentCycle,
      target_region_type: targetScope === 'PAN_INDIA' ? 'PAN_INDIA' : 'CUSTOM_SEATS',
      target_seats: targetScope === 'PAN_INDIA' ? [] : selectedTargetSeats,
      blackout_seats: [],
      starts_at: new Date(startsAt).toISOString(),
      is_active: true
    };

    const { error } = await supabase.from('polls').insert([payload]);

    if (!error) {
      setStatusMessage('✓ Poll published successfully with dynamic options and scope!');
      fetchPolls();
      setTimeout(() => setStatusMessage(''), 4000);
    } else {
      setStatusMessage(`Error: ${error.message}`);
    }
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', fontFamily: 'system-ui' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: '#ffffff', padding: '36px 32px', borderRadius: '20px', width: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#0f172a', textAlign: 'center' }}>BhuMat Command Auth</h2>
          <input
            type="password"
            placeholder="Passcode (bhumat2026)"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            style={{ padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px' }}
          />
          {authError && <div style={{ color: '#e11d48', fontSize: '12px', fontWeight: 600 }}>{authError}</div>}
          <button type="submit" style={{ padding: '12px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>
            Access Deck 🔒
          </button>
        </form>
      </div>
    );
  }

  const filteredSeats = allConstituencies.filter(
    (c) => c.name.toLowerCase().includes(seatFilter.toLowerCase()) || c.state.toLowerCase().includes(seatFilter.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', padding: '32px 20px', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>BhuMat Poll Command Center</h1>
          <a href="/" style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#334155', textDecoration: 'none' }}>
            ← View Citizen App
          </a>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0' }}>Create Audit (2–4 Options & Hand-Picked Seats)</h2>
          <form onSubmit={handleCreatePoll} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Poll Identifier</label>
                <input type="text" required value={pollId} onChange={(e) => setPollId(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Pillar</label>
                <select value={category} onChange={(e: any) => setCategory(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <option value="JanMat">JanMat (Audit / 8 PM)</option>
                  <option value="LokMat">LokMat (Culture / 8 AM)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1' }}>⏰ Go-Live Time</label>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '9px', borderRadius: '8px', border: '1.5px solid #38bdf8', backgroundColor: '#f0f9ff' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Question (English)</label>
              <input type="text" required value={titleEn} onChange={(e) => setTitleEn(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Question (Hindi)</label>
              <input type="text" required value={titleHi} onChange={(e) => setTitleHi(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>

            {/* Dynamic Options Section (2 to 4 Options) */}
            <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>Ballot Options ({options.length}/4)</span>
                {options.length < 4 && (
                  <button type="button" onClick={handleAddOption} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    + Add Option
                  </button>
                )}
              </div>
              {options.map((opt, idx) => (
                <div key={opt.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    required
                    placeholder={`Option ${idx + 1} (English)`}
                    value={opt.text_en}
                    onChange={(e) => {
                      const updated = [...options];
                      updated[idx].text_en = e.target.value;
                      setOptions(updated);
                    }}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                  <input
                    type="text"
                    required
                    placeholder={`विकल्प ${idx + 1} (हिन्दी)`}
                    value={opt.text_hi}
                    onChange={(e) => {
                      const updated = [...options];
                      updated[idx].text_hi = e.target.value;
                      setOptions(updated);
                    }}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                  {options.length > 2 && (
                    <button type="button" onClick={() => handleRemoveOption(idx)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Target Region Scope: PAN India or Hand-Pick 543 Seats */}
            <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #a7f3d0', borderRadius: '12px', padding: '14px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#065f46' }}>
                  <input type="radio" checked={targetScope === 'PAN_INDIA'} onChange={() => setTargetScope('PAN_INDIA')} /> 🇮🇳 PAN India (All 543 Seats)
                </label>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#065f46' }}>
                  <input type="radio" checked={targetScope === 'CUSTOM_SEATS'} onChange={() => setTargetScope('CUSTOM_SEATS')} /> 🎯 Hand-Pick Constituencies ({selectedTargetSeats.length} selected)
                </label>
              </div>

              {targetScope === 'CUSTOM_SEATS' && (
                <div>
                  <input
                    type="text"
                    placeholder="Search from 543 parliamentary seats to add..."
                    value={seatFilter}
                    onChange={(e) => setSeatFilter(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', border: '1px solid #a7f3d0', marginBottom: '8px', fontSize: '12px' }}
                  />
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px', backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {filteredSeats.slice(0, 40).map((seat) => {
                      const isChecked = selectedTargetSeats.includes(seat.name);
                      return (
                        <button
                          key={seat.id}
                          type="button"
                          onClick={() => toggleTargetSeat(seat.name)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: isChecked ? '1px solid #059669' : '1px solid #cbd5e1',
                            backgroundColor: isChecked ? '#ecfdf5' : '#f8fafc',
                            color: isChecked ? '#065f46' : '#475569',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {isChecked ? '✓ ' : '+ '} {seat.name} ({seat.state})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#059669' }}>{statusMessage}</span>
              <button type="submit" style={{ backgroundColor: '#10b981', color: '#ffffff', fontWeight: 800, padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                + Publish Ballot
              </button>
            </div>
          </form>
        </div>

        {/* Existing Polls List */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0' }}>Active Polls & Blackouts</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {polls.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1' }}>{p.category} • {p.id}</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700 }}>{p.title_en}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {p.options?.length || 3} Options • Scope: {p.target_region_type} • Blackouts: {(p.blackout_seats || []).length} seats
                  </div>
                </div>
                <button onClick={() => handleToggleBlackout(p)} style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#c2410c', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  ECI Blackout ({(p.blackout_seats || []).length})
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}