'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';

// Complete mapping of states to their Lok Sabha seats for user selection
const STATE_TO_SEATS: Record<string, string[]> = {
  'Bihar': [
    'Araria', 'Arrah', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Buxar', 'Darbhanga', 'Gaya', 
    'Gopalganj', 'Hajipur', 'Jahanabad', 'Jamui', 'Jhanjharpur', 'Karakat', 'Katihar', 'Khagaria', 'Kishanganj', 
    'Madhepura', 'Madhubani', 'Maharajganj', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Paschim Champaran', 
    'Pataliputra', 'Patna Sahib', 'Purnia', 'Purvi Champaran', 'Samastipur', 'Saran', 'Sasaram', 'Sheohar', 
    'Sitamarhi', 'Siwan', 'Supaul', 'Ujiarpur', 'Vaishali', 'Valmiki Nagar'
  ],
  'Maharashtra': [
    'Ahmednagar', 'Akola', 'Amravati', 'Baramati', 'Beed', 'Bhandara Gondiya', 'Bhiwandi', 'Buldhana', 
    'Chandrapur', 'Dhule', 'Dindori', 'Gadchiroli-Chimur', 'Hatkanangle', 'Hingoli', 'Jalgaon', 'Jalna', 
    'Kalyan', 'Kolhapur', 'Latur', 'Madha', 'Maval', 'Mumbai North', 'Mumbai North Central', 'Mumbai North East', 
    'Mumbai North West', 'Mumbai South', 'Mumbai South Central', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 
    'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ramtek', 'Ratnagiri-Sindhudurg', 'Raver', 'Sangli', 
    'Satara', 'Shirdi', 'Shirur', 'Solapur', 'Thane', 'Wardha', 'Yavatmal-Washim'
  ],
  // Add other states or fallback dynamically as needed
};

export default function SponsorPollModal({ voterToken, username, userState, userSeat, userDbgBalance, onClose }: any) {
  const [titleEn, setTitleEn] = useState('');
  const [category, setCategory] = useState<'JanMat' | 'LokMat'>('JanMat');
  
  // Default to home seat selected
  const [selectedSeats, setSelectedSeats] = useState<string[]>(userSeat ? [userSeat] : []);
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // 50 DBG per seat selected
  const totalCost = selectedSeats.length * 50;
  const availableSeatsInState = STATE_TO_SEATS[userState] || [userSeat];

  const toggleSeat = (seatName: string) => {
    // Prevent unchecking user's mandatory home seat if desired, or let them pick freely
    if (seatName === userSeat) return; // Home seat is always included as base

    if (selectedSeats.includes(seatName)) {
      setSelectedSeats(selectedSeats.filter(s => s !== seatName));
    } else {
      setSelectedSeats([...selectedSeats, seatName]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleEn.trim()) return alert('Please enter a poll question.');
    if (userDbgBalance < totalCost) {
      alert(`Insufficient DBG balance. You selected ${selectedSeats.length} seats (${totalCost} DBG required), but you have ${userDbgBalance} DBG.`);
      return;
    }

    setLoading(true);
    setStatusMsg('Submitting proposal & placing DBG in escrow...');

    const { data, error } = await supabase.rpc('submit_sponsored_poll', {
      p_voter_token: voterToken,
      p_username: username || 'Citizen',
      p_state_name: userState,
      p_home_seat: userSeat || selectedSeats[0],
      p_scope: selectedSeats.length > 1 ? 'STATE_CUSTOM' : 'HOME_SEAT',
      p_category: category,
      p_title_en: titleEn.trim(),
      p_title_hi: titleEn.trim(),
      p_options: [
        { id: 0, text_en: 'Yes / Agree', text_hi: 'हाँ / सहमत', color: '#10b981' },
        { id: 1, text_en: 'No / Disagree', text_hi: 'नहीं / असहमत', color: '#f59e0b' }
      ],
      p_seats: selectedSeats
    });

    setLoading(false);
    if (error || !data?.success) {
      setStatusMsg(`❌ Error: ${error?.message || data?.error}`);
    } else {
      setStatusMsg('✓ Proposal submitted successfully! Pending admin review. DBG held in escrow.');
      setTimeout(() => onClose(), 2000);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 900, margin: 0 }}>💡 Sponsor Local BhuMat Poll</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: 900, cursor: 'pointer' }}>✕</button>
        </div>

        <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
          Base cost is <strong style={{ color: '#0f172a' }}>50 DBG</strong> for your home seat ({userSeat}). Hand-pick additional seats in {userState} for +50 DBG each.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>Category Track</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setCategory('JanMat')}
                style={{ padding: '8px', borderRadius: '8px', border: `2px solid ${category === 'JanMat' ? '#059669' : '#e2e8f0'}`, backgroundColor: category === 'JanMat' ? '#ecfdf5' : '#ffffff', color: '#059669', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
              >
                🌆 JanMat (Civic)
              </button>
              <button
                type="button"
                onClick={() => setCategory('LokMat')}
                style={{ padding: '8px', borderRadius: '8px', border: `2px solid ${category === 'LokMat' ? '#d97706' : '#e2e8f0'}`, backgroundColor: category === 'LokMat' ? '#fffbeb' : '#ffffff', color: '#d97706', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
              >
                🌅 LokMat (Debate)
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>Your Poll Question (English) *</label>
            <input
              type="text"
              required
              placeholder="e.g. Should our district construct a new public sports complex?"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '12.5px', fontWeight: 600 }}
            />
          </div>

          {/* Seat Picker Grid */}
          <div>
            <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Hand-Pick Target Seats in {userState} (50 DBG / seat):
            </label>
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', backgroundColor: '#f8fafc' }}>
              {availableSeatsInState.map((seat) => {
                const isHome = seat === userSeat;
                const isSelected = selectedSeats.includes(seat);
                return (
                  <span
                    key={seat}
                    onClick={() => toggleSeat(seat)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: isHome ? 'default' : 'pointer',
                      backgroundColor: isSelected ? '#0284c7' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#334155',
                      border: `1px solid ${isSelected ? '#0284c7' : '#cbd5e1'}`
                    }}
                  >
                    {isHome ? '🏠 ' : (isSelected ? '✓ ' : '＋ ')}{seat} {isHome ? '(Home)' : ''}
                  </span>
                );
              })}
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>Selected: {selectedSeats.length} Seats</span>
              <span style={{ fontSize: '13px', fontWeight: 900, color: '#d97706' }}>Total Cost: {totalCost} DBG</span>
            </div>
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: userDbgBalance >= totalCost ? '#059669' : '#dc2626' }}>
              Balance: {userDbgBalance} DBG
            </span>
          </div>

          {statusMsg && (
            <div style={{ fontSize: '11.5px', fontWeight: 800, color: statusMsg.startsWith('✓') ? '#059669' : '#dc2626' }}>
              {statusMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ padding: '12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 900, cursor: 'pointer', marginTop: '4px' }}
          >
            {loading ? 'Submitting...' : `Sponsor Poll (${totalCost} DBG for ${selectedSeats.length} Seats)`}
          </button>
        </form>
      </div>
    </div>
  );
}