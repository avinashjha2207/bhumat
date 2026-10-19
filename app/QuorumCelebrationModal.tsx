'use client';
import React from 'react';

interface QuorumCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  seatName: string;
  stateName: string;
  totalVotes: number;
  lang: 'EN' | 'HI';
  referralCode?: string;
}

export default function QuorumCelebrationModal({
  isOpen,
  onClose,
  seatName,
  stateName,
  totalVotes,
  lang,
  referralCode = 'BM78491'
}: QuorumCelebrationModalProps) {
  if (!isOpen) return null;

  const handleShareVictory = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vote.bhumat.com';
    const text = lang === 'HI'
      ? `🏛️ *ऐतिहासिक क्षण:* हमारे संसदीय क्षेत्र *${seatName}* (${stateName}) ने भूमत पर 50 मतों का संप्रभु कोरम पूर्ण कर लिया है!\n\nअब हमारे क्षेत्र का जनमत आधिकारिक रूप से संप्रभु ग्रिड पर प्रमाणित हो चुका है।\n\nआप भी अपने लोकसभा क्षेत्र की आवाज़ बनें:\n${origin}?seat=${encodeURIComponent(seatName)}&ref=${referralCode}`
      : `🏛️ *HISTORIC CIVIC MILESTONE:* Our parliamentary constituency *${seatName}* (${stateName}) has reached 50 verified ballots and fortified its sovereign quorum on BhuMat!\n\nOur seat's consensus is now officially certified across Bharat.\n\nMake your voice count:\n${origin}?seat=${encodeURIComponent(seatName)}&ref=${referralCode}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(6px)',
        zIndex: 260,
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
          maxWidth: '400px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'center'
        }}
      >
        {/* Tricolor Ribbon Header */}
        <div style={{ height: '6px', background: 'linear-gradient(90deg, #ff9933 33.3%, #ffffff 33.3%, #ffffff 66.6%, #138808 66.6%)' }} />

        <div style={{ padding: '26px 20px 22px 20px', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#ecfdf5',
            border: '2px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px'
          }}>
            🏆
          </div>

          <div>
            <span style={{ fontSize: '11px', fontWeight: 900, backgroundColor: '#fef3c7', color: '#b45309', padding: '3px 10px', borderRadius: '999px', letterSpacing: '0.04em' }}>
              {lang === 'HI' ? 'संसदीय कोरम पूर्ण (50 मत)' : 'FORTIFIED QUORUM REACHED'}
            </span>
            <h3 style={{ margin: '8px 0 4px 0', fontSize: '21px', fontWeight: 900, color: '#0f172a' }}>
              {seatName} ({stateName})
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.45 }}>
              {lang === 'HI'
                ? `बधाई! आपके क्षेत्र ने 50 प्रमाणित मतों का मील का पत्थर पार कर संप्रभु जनमत ग्रिड पर संवैधानिक मान्यता प्राप्त कर ली है।`
                : `Congratulations! Your constituency has crossed the 50-ballot threshold, unlocking verified constitutional consensus standing.`}
            </p>
          </div>

          {/* Metric Box */}
          <div style={{
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: '#f8fafc',
            border: '1.5px solid #e2e8f0',
            borderRadius: '16px',
            padding: '12px 14px',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800 }}>CERTIFIED BALLOTS</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                {totalVotes} / 50 ✓
              </div>
            </div>
            <div style={{ width: '1px', height: '32px', backgroundColor: '#e2e8f0' }} />
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800 }}>COMMUNITY STATUS</div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
                🛡️ Fortified
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '4px' }}>
            <button
              onClick={handleShareVictory}
              style={{
                width: '100%',
                padding: '13px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '13.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
              }}
            >
              <span>📲</span>
              <span>{lang === 'HI' ? 'व्हाट्सएप पर जीत साझा करें' : 'Share Milestone on WhatsApp'}</span>
            </button>
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                border: 'none',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {lang === 'HI' ? 'बंद करें' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}