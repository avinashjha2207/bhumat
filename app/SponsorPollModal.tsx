'use client';
import React, { useState, useMemo } from 'react';
import { supabase, safeStorage } from './utils/supabaseClient';

interface SponsorPollModalProps {
  voterToken: string;
  username: string;
  userState: string;
  userSeat: string;
  userDbgBalance: number;
  onClose: () => void;
}

const STATE_SEATS_MAP: Record<string, string[]> = {
  'Bihar': ['Araria', 'Arrah', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Buxar', 'Darbhanga', 'Gaya', 'Gopalganj', 'Hajipur', 'Jahanabad', 'Jamui', 'Jhanjharpur', 'Karakat', 'Katihar', 'Khagaria', 'Kishanganj', 'Madhepura', 'Madhubani', 'Maharajganj', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Paschim Champaran', 'Pataliputra', 'Patna Sahib', 'Purnia', 'Purvi Champaran', 'Samastipur', 'Saran', 'Sasaram', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Ujiarpur', 'Vaishali', 'Valmiki Nagar'],
  'Delhi': ['Chandni Chowk', 'East Delhi', 'New Delhi', 'North East Delhi', 'North West Delhi', 'South Delhi', 'West Delhi'],
  'Maharashtra': ['Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Baramati', 'Beed', 'Bhandara Gondiya', 'Bhiwandi', 'Buldhana', 'Chandrapur', 'Dhule', 'Dindori', 'Gadchiroli-Chimur', 'Hatkanangle', 'Hingoli', 'Jalgaon', 'Jalna', 'Kalyan', 'Kolhapur', 'Latur', 'Madha', 'Maval', 'Mumbai North', 'Mumbai North Central', 'Mumbai North East', 'Mumbai North West', 'Mumbai South', 'Mumbai South Central', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ramtek', 'Ratnagiri-Sindhudurg', 'Raver', 'Sangli', 'Satara', 'Shirdi', 'Shirur', 'Solapur', 'Thane', 'Wardha', 'Yavatmal-Washim'],
  'Karnataka': ['Bagalkot', 'Bangalore Central', 'Bangalore North', 'Bangalore Rural', 'Bangalore South', 'Belgaum', 'Bellary', 'Bidar', 'Bijapur', 'Chamarajanagar', 'Chikkballapur', 'Chikkodi', 'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gulbarga', 'Hassan', 'Haveri', 'Kolar', 'Koppal', 'Mandya', 'Mysore', 'Raichur', 'Shimoga', 'Tumkur', 'Udupi Chikmagalur', 'Uttara Kannada'],
  'Uttar Pradesh': ['Agra', 'Aligarh', 'Allahabad', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Aonla', 'Azamgarh', 'Badaun', 'Baghpat', 'Bahraich', 'Ballia', 'Banda', 'Bansgaon', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Bulandshahr', 'Chandauli', 'Deoria', 'Dhaurahra', 'Domariyaganj', 'Etah', 'Etawah', 'Faizabad', 'Farrukhabad', 'Fatehpur', 'Fatehpur Sikri', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Ghosi', 'Gonda', 'Gorakhpur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kairana', 'Kaiserganj', 'Kannauj', 'Kanpur', 'Kaushambi', 'Kheri', 'Kushi Nagar', 'Lalganj', 'Lucknow', 'Machhlishahr', 'Mainpuri', 'Mathura', 'Meerut', 'Mirzapur', 'Misrikh', 'Mohanlalganj', 'Moradabad', 'Muzaffarnagar', 'Nagina', 'Phulpur', 'Pilibhit', 'Pratapgarh', 'Rae Bareli', 'Rampur', 'Robertsganj', 'Saharanpur', 'Salempur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shrawasti', 'Siddharthnagar', 'Sitapur', 'Sultanpur', 'Unnao', 'Varanasi']
};

export default function SponsorPollModal({
  voterToken,
  username,
  userState,
  userSeat,
  userDbgBalance,
  onClose
}: SponsorPollModalProps) {
  const [titleEn, setTitleEn] = useState('');
  const [titleHi, setTitleHi] = useState('');
  const [category, setCategory] = useState<'LokMat' | 'JanMat'>('LokMat');
  const [opt0En, setOpt0En] = useState('Yes');
  const [opt1En, setOpt1En] = useState('No');
  const [selectedPeers, setSelectedPeers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const stateSeats = useMemo(() => {
    return (STATE_SEATS_MAP[userState] || []).filter(s => s.toLowerCase() !== userSeat.toLowerCase());
  }, [userState, userSeat]);

  const togglePeerSeat = (seat: string) => {
    if (selectedPeers.includes(seat)) {
      setSelectedPeers(selectedPeers.filter(s => s !== seat));
    } else {
      if (selectedPeers.length >= 2) return;
      setSelectedPeers([...selectedPeers, seat]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleEn.trim()) {
      setErrorMsg('Please write your question');
      return;
    }
    if (userDbgBalance < 50) {
      setErrorMsg(`50 DBG required. Your balance: ${userDbgBalance} DBG`);
      return;
    }
    if (selectedPeers.length < 2) {
      setErrorMsg('Please select 2 additional constituencies from your state');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const targetSeats = [userSeat, ...selectedPeers];
    const optionsPayload = [
      { id: 0, text_en: opt0En, text_hi: opt0En, color: '#f97316' },
      { id: 1, text_en: opt1En, text_hi: opt1En, color: '#10b981' }
    ];

    try {
      const { data, error } = await supabase.rpc('sponsor_community_poll', {
        p_voter_token: voterToken,
        p_username: username,
        p_category: category,
        p_title_en: titleEn.trim(),
        p_title_hi: titleHi.trim() || titleEn.trim(),
        p_options: JSON.stringify(optionsPayload),
        p_home_state: userState,
        p_home_seat: userSeat,
        p_target_seats: targetSeats
      });

      if (error || !data?.success) {
        setErrorMsg(error?.message || data?.error || 'Failed to submit proposal');
        setIsSubmitting(false);
      } else {
        if (data.new_balance !== undefined) {
          safeStorage.setItem('bhumat_dbg_balance', String(data.new_balance));
        }
        alert('✓ 50 DBG Burned! Your 3-constituency poll proposal has been dispatched for editorial review.');
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '430px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '22px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 900, backgroundColor: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: '6px' }}>
            ⚡ 50 DBG SPONSORSHIP
          </span>
          <button
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 800, color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        <h3 style={{ margin: '4px 0 2px 0', fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
          Sponsor 3-Seat Public Poll
        </h3>
        <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
          Target your question to <strong>{userSeat}</strong> plus 2 additional seats in <strong>{userState}</strong>.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setCategory('LokMat')}
              style={{
                flex: 1, padding: '8px', borderRadius: '10px',
                border: `1.5px solid ${category === 'LokMat' ? '#d97706' : '#cbd5e1'}`,
                backgroundColor: category === 'LokMat' ? '#fffbeb' : '#ffffff',
                color: category === 'LokMat' ? '#92400e' : '#475569',
                fontSize: '11.5px', fontWeight: 800, cursor: 'pointer'
              }}
            >
              🌅 LokMat (Cultural)
            </button>
            <button
              type="button"
              onClick={() => setCategory('JanMat')}
              style={{
                flex: 1, padding: '8px', borderRadius: '10px',
                border: `1.5px solid ${category === 'JanMat' ? '#059669' : '#cbd5e1'}`,
                backgroundColor: category === 'JanMat' ? '#ecfdf5' : '#ffffff',
                color: category === 'JanMat' ? '#065f46' : '#475569',
                fontSize: '11.5px', fontWeight: 800, cursor: 'pointer'
              }}
            >
              🌆 JanMat (Governance)
            </button>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Your Question (English) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Should the local highway bypass have streetlighting?"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '12.5px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Question in Hindi (Optional)
            </label>
            <input
              type="text"
              placeholder="हिंदी अनुवाद..."
              value={titleHi}
              onChange={(e) => setTitleHi(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '12.5px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 800, color: '#334155' }}>Option 1</label>
              <input
                type="text"
                value={opt0En}
                onChange={(e) => setOpt0En(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 800, color: '#334155' }}>Option 2</label>
              <input
                type="text"
                value={opt1En}
                onChange={(e) => setOpt1En(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>
          </div>

          {/* 3-Constituency Picker */}
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              Select 2 Additional {userState} Seats ({selectedPeers.length}/2 chosen):
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px' }}>
              1. 📍 <strong>{userSeat}</strong> (Your Home Seat is locked)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
              {stateSeats.map((seat) => {
                const isSelected = selectedPeers.includes(seat);
                return (
                  <button
                    key={seat}
                    type="button"
                    onClick={() => togglePeerSeat(seat)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: `1px solid ${isSelected ? '#0284c7' : '#cbd5e1'}`,
                      backgroundColor: isSelected ? '#e0f2fe' : '#ffffff',
                      color: isSelected ? '#0369a1' : '#334155',
                      fontSize: '11px',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer'
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '}{seat}
                  </button>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626' }}>
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || userDbgBalance < 50 || selectedPeers.length < 2}
            style={{
              padding: '12px',
              backgroundColor: userDbgBalance >= 50 && selectedPeers.length === 2 ? '#10b981' : '#cbd5e1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: userDbgBalance >= 50 && selectedPeers.length === 2 ? 'pointer' : 'not-allowed',
              marginTop: '4px'
            }}
          >
            {isSubmitting ? 'Submitting Proposal...' : `Burn 50 DBG & Dispatch (${userDbgBalance} Available)`}
          </button>
        </form>
      </div>
    </div>
  );
}