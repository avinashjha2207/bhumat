'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { supabase, safeStorage } from './utils/supabaseClient';
import TickerTape from './TickerTape';
import { getCurrentCycleId } from './utils/cycleManager';
import { solvePoWChallenge } from './utils/powSolver';

const PhoneAuthModal = dynamic(() => import('./PhoneAuthModal'), { ssr: false });
const DrishtiMap = dynamic(() => import('./DrishtiMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '260px', backgroundColor: '#f1f5f9', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '12px' }}>
      Loading sovereign map vector...
    </div>
  )
});
const PollExpandedView = dynamic(() => import('./PollExpandedView'), { ssr: false });
const LeaderboardView = dynamic(() => import('./LeaderboardView'), { ssr: false });

const SEAT_CHANGE_COST_DBG = 1; // Standardized: 1 DBG per shift
const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];

interface Poll {
  id: string;
  category: string;
  title_en: string;
  title_hi: string;
  target_region_type?: string;
  target_seats?: string[];
  blackout_seats?: string[];
  starts_at?: string;
  participation_mode?: string;
  current_cycle?: string;
  recurrence?: string;
  is_active?: boolean;
  options: { id: number; text_en: string; text_hi: string }[];
}

const GROUPED_PARLIAMENTARY_SEATS: Record<string, string[]> = {
  'Andaman and Nicobar Islands': ['Andaman and Nicobar Islands'],
  'Andhra Pradesh': ['Amalapuram', 'Anakapalli', 'Anantapur', 'Araku', 'Bapatla', 'Chittoor', 'Eluru', 'Guntur', 'Hindupur', 'Kadapa', 'Kakinada', 'Kurnool', 'Machilipatnam', 'Nandyal', 'Narasaraopet', 'Narsapuram', 'Nellore', 'Ongole', 'Rajahmundry', 'Rajampet', 'Srikakulam', 'Tirupati', 'Vijayawada', 'Visakhapatnam', 'Vizianagaram'],
  'Arunachal Pradesh': ['Arunachal East', 'Arunachal West'],
  'Assam': ['Barpeta', 'Darrang-Udalguri', 'Dhubri', 'Dibrugarh', 'Diphu', 'Guwahati', 'Kaziranga', 'Kokrajhar', 'Lakhimpur', 'Nagaon', 'Silchar', 'Sonitpur'],
  'Bihar': ['Araria', 'Arrah', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Buxar', 'Darbhanga', 'Gaya', 'Gopalganj', 'Hajipur', 'Jahanabad', 'Jamui', 'Jhanjharpur', 'Karakat', 'Katihar', 'Khagaria', 'Kishanganj', 'Madhepura', 'Madhubani', 'Maharajganj', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Paschim Champaran', 'Pataliputra', 'Patna Sahib', 'Purnia', 'Purvi Champaran', 'Samastipur', 'Saran', 'Sasaram', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Ujiarpur', 'Vaishali', 'Valmiki Nagar'],
  'Chandigarh': ['Chandigarh'],
  'Chhattisgarh': ['Bastar', 'Bilaspur', 'Durg', 'Janjgir-Champa', 'Kanker', 'Korba', 'Mahasamund', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Surguja'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Dadra and Nagar Haveli', 'Daman and Diu'],
  'Delhi': ['Chandni Chowk', 'East Delhi', 'New Delhi', 'North East Delhi', 'North West Delhi', 'South Delhi', 'West Delhi'],
  'Goa': ['North Goa', 'South Goa'],
  'Gujarat': ['Ahmedabad East', 'Ahmedabad West', 'Amreli', 'Anand', 'Banaskantha', 'Bardoli', 'Bharuch', 'Bhavnagar', 'Chhota Udaipur', 'Dahod', 'Gandhinagar', 'Jamnagar', 'Junagadh', 'Kachchh', 'Kheda', 'Mehsana', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar', 'Vadodara', 'Valsad'],
  'Haryana': ['Ambala', 'Bhiwani-Mahendragarh', 'Faridabad', 'Gurgaon', 'Hisar', 'Karnal', 'Kurukshetra', 'Rohtak', 'Sirsa', 'Sonipat'],
  'Himachal Pradesh': ['Hamirpur', 'Kangra', 'Mandi', 'Shimla'],
  'Jammu and Kashmir': ['Anantnag-Rajouri', 'Baramulla', 'Jammu', 'Srinagar', 'Udhampur'],
  'Jharkhand': ['Chatra', 'Dhanbad', 'Dumka', 'Giridih', 'Godda', 'Hazaribagh', 'Jamshedpur', 'Khunti', 'Kodarma', 'Lohardaga', 'Palamu', 'Rajmahal', 'Ranchi', 'Singhbhum'],
  'Karnataka': ['Bagalkot', 'Bangalore Central', 'Bangalore North', 'Bangalore Rural', 'Bangalore South', 'Belgaum', 'Bellary', 'Bidar', 'Bijapur', 'Chamarajanagar', 'Chikkballapur', 'Chikkodi', 'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gulbarga', 'Hassan', 'Haveri', 'Kolar', 'Koppal', 'Mandya', 'Mysore', 'Raichur', 'Shimoga', 'Tumkur', 'Udupi Chikmagalur', 'Uttara Kannada'],
  'Kerala': ['Alappuzha', 'Alathur', 'Attingal', 'Chalakudy', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Mavelikkara', 'Palakkad', 'Pathanamthitta', 'Ponnani', 'Thiruvananthapuram', 'Thrissur', 'Vatakara', 'Wayanad'],
  'Ladakh': ['Ladakh'],
  'Lakshadweep': ['Lakshadweep'],
  'Madhya Pradesh': ['Balaghat', 'Betul', 'Bhind', 'Bhopal', 'Chhindwara', 'Damoh', 'Dewas', 'Dhar', 'Guna', 'Gwalior', 'Hoshangabad', 'Indore', 'Jabalpur', 'Khajuraho', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Shahdol', 'Sidhi', 'Tikamgarh', 'Ujjain', 'Vidisha'],
  'Maharashtra': ['Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Baramati', 'Beed', 'Bhandara Gondiya', 'Bhiwandi', 'Buldhana', 'Chandrapur', 'Dhule', 'Dindori', 'Gadchiroli-Chimur', 'Hatkanangle', 'Hingoli', 'Jalgaon', 'Jalna', 'Kalyan', 'Kolhapur', 'Latur', 'Madha', 'Maval', 'Mumbai North', 'Mumbai North Central', 'Mumbai North East', 'Mumbai North West', 'Mumbai South', 'Mumbai South Central', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ramtek', 'Ratnagiri-Sindhudurg', 'Raver', 'Sangli', 'Satara', 'Shirdi', 'Shirur', 'Solapur', 'Thane', 'Wardha', 'Yavatmal-Washim'],
  'Manipur': ['Inner Manipur', 'Outer Manipur'],
  'Meghalaya': ['Shillong', 'Tura'],
  'Mizoram': ['Mizoram'],
  'Nagaland': ['Nagaland'],
  'Odisha': ['Aska', 'Balasore', 'Bargarh', 'Berhampur', 'Bhadrak', 'Bhubaneswar', 'Bolangir', 'Cuttack', 'Dhenkanal', 'Jagatsinghpur', 'Jajpur', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Keonjhar', 'Koraput', 'Mayurbhanj', 'Nabarangpur', 'Puri', 'Sambalpur', 'Sundargarh'],
  'Puducherry': ['Puducherry'],
  'Punjab': ['Amritsar', 'Anandpur Sahib', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Firozpur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Khadoor Sahib', 'Ludhiana', 'Patiala', 'Sangrur'],
  'Rajasthan': ['Ajmer', 'Alwar', 'Banswara', 'Barmer', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Chittorgarh', 'Churu', 'Dausa', 'Ganganagar', 'Jaipur', 'Jaipur Rural', 'Jalore', 'Jhalawar-Baran', 'Jhunjhunu', 'Jodhpur', 'Karauli-Dholpur', 'Kota', 'Nagaur', 'Pali', 'Rajsamand', 'Sikar', 'Tonk-Sawai Madhopur', 'Udaipur'],
  'Sikkim': ['Sikkim'],
  'Tamil Nadu': ['Arakkonam', 'Arani', 'Chennai Central', 'Chennai North', 'Chennai South', 'Chidambaram', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram', 'Kanniyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pollachi', 'Ramanathapuram', 'Salem', 'Sivaganga', 'Sriperumbudur', 'Tenkasi', 'Thanjavur', 'Theni', 'Thiruvallur', 'Thoothukkudi', 'Tiruchirappalli', 'Tirunelveli', 'Tiruppur', 'Tiruvannamalai', 'Vellore', 'Viluppuram', 'Virudhunagar'],
  'Telangana': ['Adilabad', 'Bhongir', 'Chevella', 'Hyderabad', 'Karimnagar', 'Khammam', 'Mahabubabad', 'Mahbubnagar', 'Medak', 'Nagarkurnool', 'Nalgonda', 'Nizamabad', 'Peddapalle', 'Secunderabad', 'Warangal', 'Zahirabad'],
  'Tripura': ['Tripura East', 'Tripura West'],
  'Uttar Pradesh': ['Agra', 'Aligarh', 'Allahabad', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Aonla', 'Azamgarh', 'Badaun', 'Baghpat', 'Bahraich', 'Ballia', 'Banda', 'Bansgaon', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Bulandshahr', 'Chandauli', 'Deoria', 'Dhaurahra', 'Domariyaganj', 'Etah', 'Etawah', 'Faizabad', 'Farrukhabad', 'Fatehpur', 'Fatehpur Sikri', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Ghosi', 'Gonda', 'Gorakhpur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kairana', 'Kaiserganj', 'Kannauj', 'Kanpur', 'Kaushambi', 'Kheri', 'Kushi Nagar', 'Lalganj', 'Lucknow', 'Machhlishahr', 'Maharajganj', 'Mainpuri', 'Mathura', 'Meerut', 'Mirzapur', 'Misrikh', 'Mohanlalganj', 'Moradabad', 'Muzaffarnagar', 'Nagina', 'Phulpur', 'Pilibhit', 'Pratapgarh', 'Rae Bareli', 'Rampur', 'Robertsganj', 'Saharanpur', 'Salempur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shrawasti', 'Siddharthnagar', 'Sitapur', 'Sultanpur', 'Unnao', 'Varanasi'],
  'Uttarakhand': ['Almora', 'Garhwal', 'Haridwar', 'Nainital-Udhamsingh Nagar', 'Tehri Garhwal'],
  'West Bengal': ['Alipurduars', 'Arambagh', 'Asansol', 'Baharampur', 'Balurghat', 'Bangaon', 'Bankura', 'Barasat', 'Bardhaman Durgapur', 'Bardhaman Purba', 'Barrackpore', 'Basirhat', 'Birbhum', 'Bishnupur', 'Bolpur', 'Cooch Behar', 'Darjeeling', 'Diamond Harbour', 'Dum Dum', 'Ghatal', 'Hooghly', 'Howrah', 'Jadavpur', 'Jalpaiguri', 'Jangipur', 'Jaynagar', 'Jhargram', 'Kanthi', 'Kolkata Dakshin', 'Kolkata Uttar', 'Krishnanagar', 'Maldaha Dakshin', 'Maldaha Uttar', 'Mathurapur', 'Medinipur', 'Murshidabad', 'Purulia', 'Raiganj', 'Ranaghat', 'Sreerampur', 'Tamluk', 'Uluberia']
};

function format3LetterDate(dateStr?: string, lang: 'EN' | 'HI' = 'EN'): string {
  if (!dateStr) return lang === 'HI' ? 'जल्द' : 'TBA';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return lang === 'HI' ? 'जल्द' : 'TBA';
  return d.toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

function formatVotingSince(dateStr?: string, lang: 'EN' | 'HI' = 'EN'): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return lang === 'HI' ? '11 अक्टू 2026' : '11 Oct 2026';
  return d.toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function resolveCivicRecognitionTier(prevVotes: number): { title: string; color: string; level: number } {
  if (prevVotes >= 50) return { title: '👑 Sovereign Ratna (Level 5)', color: '#8b5cf6', level: 5 };
  if (prevVotes >= 40) return { title: '⚖️ Rashtriya Nirdharak (Level 4)', color: '#0284c7', level: 4 };
  if (prevVotes >= 25) return { title: '🛡️ Lok Prahari (Level 3)', color: '#10b981', level: 3 };
  if (prevVotes >= 10) return { title: '🏛️ Jagruk Nagrik (Level 2)', color: '#d97706', level: 2 };
  return { title: '🌱 Prathamik Nagrik (Level 1)', color: '#64748b', level: 1 };
}

function getOrCreateVoterToken(): string {
  let token = safeStorage.getItem('bhumat_voter_token');
  if (!token) {
    token = 'bn_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    safeStorage.setItem('bhumat_voter_token', token);
  }
  return token;
}

export default function BhuMatApp() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'vote' | 'schedule' | 'profile'>('vote');
  const [lang, setLang] = useState<'EN' | 'HI'>('EN');
  const [pillarFilter, setPillarFilter] = useState<'ALL' | 'JanMat' | 'LokMat'>('ALL');
  const [toast, setToast] = useState<{ msg: string; x: number; y: number } | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{ title: string; desc: string; x: number; y: number } | null>(null);
  const infoPopupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [expandedPoll, setExpandedPoll] = useState<Poll | null>(null);
  const [username] = useState('CitizenBharat');
  
  // 1 DBG Standardized Default Balance
  const [dbgPoints, setDbgPoints] = useState<number>(() => {
    try {
      const saved = safeStorage.getItem('bhumat_dbg_balance');
      return saved !== null && !isNaN(Number(saved)) ? Number(saved) : 1;
    } catch (e) {
      return 1;
    }
  });

  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  // Onboarding Guide State
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3>(1);

  const [guestVotesCast, setGuestVotesCast] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = safeStorage.getItem('bhumat_guest_vote_count');
      return stored ? parseInt(stored, 10) : 0;
    }
    return 0;
  });
  const [linkedPhone, setLinkedPhone] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? safeStorage.getItem('bhumat_user_phone') : null;
  });

  async function fetchLedger(token: string) {
    try {
      const { data } = await supabase
        .from('civic_credit_ledger')
        .select('*')
        .eq('voter_token', token)
        .order('created_at', { ascending: false });
      if (data) setLedgerEntries(data);
    } catch (err) {
      console.warn('Ledger fetch error:', err);
    }
  }

  const [referralCode, setReferralCode] = useState('BM78491');
  const [janmatAuditsCount, setJanmatAuditsCount] = useState(0);
  const [lokmatPollsCount, setLokmatPollsCount] = useState(0);
  const [totalVotesCount, setTotalVotesCount] = useState(0);
  const [monthlyVotesCount, setMonthlyVotesCount] = useState(0);
  const [prevMonthVotesCount, setPrevMonthVotesCount] = useState(0);
  const [deviceHash, setDeviceHash] = useState<string>('');
  const [votingSinceDate, setVotingSinceDate] = useState<string>('');
  const [selectedSeat, setSelectedSeat] = useState<{ name: string; state: string } | null>(null);
  const [tentativeSeat, setTentativeSeat] = useState<{ name: string; state: string } | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isChangeSeatModalOpen, setIsChangeSeatModalOpen] = useState(false);
  const [seatSearchInput, setSeatSearchInput] = useState('');
  const [pollSearchQuery, setPollSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [cachedTalliesByPoll, setCachedTalliesByPoll] = useState<Record<string, any[]>>({});
  const [flippedOverrides, setFlippedOverrides] = useState<Record<string, boolean>>({});
  const [sessionBallotChoices, setSessionBallotChoices] = useState<Record<string, number>>({});
  const [votedCycleKeys, setVotedCycleKeys] = useState<string[]>([]);
  const [voteTimestamps, setVoteTimestamps] = useState<Record<string, string>>({});

  const showPointerToast = (msg: string, e?: React.MouseEvent | React.TouchEvent) => {
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 360;
    let x = screenW / 2;
    let y = 140;
    if (e) {
      if ('clientX' in e && e.clientX) {
        x = Math.max(20, Math.min(e.clientX, screenW - 20));
        y = e.clientY - 40;
      } else if ('touches' in e && e.touches[0]) {
        x = Math.max(20, Math.min(e.touches[0].clientX, screenW - 20));
        y = e.touches[0].clientY - 40;
      }
    }
    setToast({ msg, x, y: Math.max(y, 60) });
    setTimeout(() => setToast(null), 3200);
  };

  const triggerInfoPopup = (title: string, desc: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (infoPopupTimeoutRef.current) clearTimeout(infoPopupTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 360;
    const clampedX = Math.max(14, Math.min(rect.left - 70, screenW - 215));
    const clampedY = Math.max(65, rect.bottom + 8);
    setActiveTooltip({ title, desc, x: clampedX, y: clampedY });
    infoPopupTimeoutRef.current = setTimeout(() => {
      setActiveTooltip(null);
    }, 3500);
  };

  const handleBrandReset = () => {
    setExpandedPoll(null);
    setActiveTab('vote');
    setPillarFilter('ALL');
    setPollSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadPolls();
  };

  useEffect(() => {
    if (activeTab === 'search') {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      setExpandedPoll(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openExpandedView = async (poll: Poll) => {
    try {
      const { data } = await supabase
        .from('constituency_tallies')
        .select('*')
        .eq('poll_id', poll.id);
      if (data) {
        setCachedTalliesByPoll((prev) => ({ ...prev, [poll.id]: data }));
      }
    } catch (e) {}
    window.history.pushState({ modal: 'expanded' }, '');
    setExpandedPoll(poll);
  };

  const closeExpandedView = () => {
    if (window.history.state?.modal === 'expanded') {
      window.history.back();
    } else {
      setExpandedPoll(null);
    }
  };

  async function syncWallet(token: string) {
    try {
      const activeToken = token || safeStorage.getItem('bhumat_voter_token') || getOrCreateVoterToken();
      
      let localTotal = 0;
      let localJanMat = 0;
      let localLokMat = 0;
      try {
        const storedCyclesRaw = safeStorage.getItem('bhumat_voted_cycles');
        const storedCycles: string[] = storedCyclesRaw ? JSON.parse(storedCyclesRaw) : [];
        localTotal = storedCycles.length;
        storedCycles.forEach((cycleKey) => {
          const pollId = cycleKey.split('___')[0];
          const matchedPoll = polls.find((p) => p.id === pollId);
          if (matchedPoll?.category === 'JanMat') localJanMat += 1;
          else if (matchedPoll?.category === 'LokMat') localLokMat += 1;
        });
      } catch (err) {}

      const { data, error } = await supabase.rpc('get_or_create_voter_wallet', {
        p_voter_token: activeToken
      });
      if (data && !error && data.success) {
        const verifiedDbg = data.dbg_balance !== undefined ? data.dbg_balance : 1;
        setDbgPoints(verifiedDbg);
        try {
          safeStorage.setItem('bhumat_dbg_balance', String(verifiedDbg));
        } catch (e) {}
        setReferralCode(data.referral_code ?? 'BM78491');
        
        const verifiedTotal = Math.max(Number(data.total_votes) || 0, localTotal);
        const verifiedJanMat = Math.max(Number(data.janmat_votes) || 0, localJanMat);
        const verifiedLokMat = Math.max(Number(data.lokmat_votes) || 0, localLokMat);
        setTotalVotesCount(verifiedTotal);
        setJanmatAuditsCount(verifiedJanMat);
        setLokmatPollsCount(verifiedLokMat);
        setMonthlyVotesCount(verifiedTotal);
        if (data.voting_since) setVotingSinceDate(data.voting_since);
      } else {
        if (localTotal > 0) {
          setTotalVotesCount(localTotal);
          setJanmatAuditsCount(localJanMat);
          setLokmatPollsCount(localLokMat);
          setMonthlyVotesCount(localTotal);
        }
      }

      const { data: mData } = await supabase.rpc('check_monthly_milestone', {
        p_voter_token: activeToken
      });
      if (mData?.success) {
        setMonthlyVotesCount(mData.monthly_votes ?? 0);
        setPrevMonthVotesCount(mData.prev_month_votes ?? 0);
        if (mData.earned_bonus) {
          alert(lang === 'HI' ? '🎉 बधाई! आपने 15 मत पूरे किए और +1 DBG अनलॉक किया!' : '🎉 Congratulations! You reached 15 votes this month and unlocked +1 DBG!');
        }
      }
    } catch (e) {
      console.warn('Wallet fetch error:', e);
    }
  }

  useEffect(() => {
    setMounted(true);
    const token = getOrCreateVoterToken();
    setDeviceHash(token);
    syncWallet(token);

    // Auto-Capture ?ref= from WhatsApp / Peer links
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const refParam = urlParams.get('ref');
      if (refParam && refParam.trim()) {
        const cleanRef = refParam.trim().toUpperCase();
        safeStorage.setItem('bhumat_pending_ref_code', cleanRef);
        supabase.rpc('bind_invite_code', {
          p_invited_token: token,
          p_code: cleanRef
        }).then(({ data }) => {
          if (data?.success) {
            console.log(`Bound to inviter code: ${cleanRef}`);
          }
        });
      }
    }

    try {
      const savedSeat = safeStorage.getItem('bhumat_user_seat');
      const savedState = safeStorage.getItem('bhumat_user_state');
      const savedCycles = safeStorage.getItem('bhumat_voted_cycles');
      const savedChoices = safeStorage.getItem('bhumat_voted_polls');
      const savedTimestamps = safeStorage.getItem('bhumat_vote_timestamps');
      const hasSeenGuide = safeStorage.getItem('bhumat_seen_onboarding_guide');

      if (savedSeat && savedState) {
        setSelectedSeat({ name: savedSeat, state: savedState });
        setIsConfirmed(true);
      } else if (!hasSeenGuide) {
        setShowOnboardingGuide(true);
      }

      if (savedCycles) setVotedCycleKeys(JSON.parse(savedCycles));
      if (savedChoices) setSessionBallotChoices(JSON.parse(savedChoices));
      if (savedTimestamps) setVoteTimestamps(JSON.parse(savedTimestamps));
    } catch (e) {}

    // Register PWA Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration skipped:', err);
      });
    }
  }, []);

  async function loadPolls() {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('starts_at', { ascending: false });
      if (data && data.length > 0 && !error) {
        const formatted = data.map((d: any) => ({
          id: d.id,
          category: d.category || 'JanMat',
          title_en: d.title_en,
          title_hi: d.title_hi,
          target_region_type: d.target_region_type || 'PAN_INDIA',
          target_seats: d.target_seats || [],
          blackout_seats: d.blackout_seats || [],
          starts_at: d.starts_at || new Date().toISOString(),
          participation_mode: d.participation_mode || 'recurring',
          current_cycle: d.current_cycle || getCurrentCycleId('monthly'),
          recurrence: d.recurrence || 'monthly',
          is_active: d.is_active !== false,
          options: d.options || [
            { id: 0, text_en: 'Option 1', text_hi: 'विकल्प 1' },
            { id: 1, text_en: 'Option 2', text_hi: 'विकल्प 2' }
          ]
        }));
        setPolls(formatted);
      }
    } catch (err) {}
  }

  useEffect(() => {
    loadPolls();
  }, []);

  const handleConfirmSeat = async () => {
    const seatToConfirm = tentativeSeat || selectedSeat;
    if (!seatToConfirm) return;
    if (typeof document !== 'undefined' && document.activeElement) {
      (document.activeElement as HTMLElement)?.blur();
    }
    if (isConfirmed && selectedSeat && selectedSeat.name !== seatToConfirm.name) {
      const activeToken = deviceHash || safeStorage.getItem('bhumat_voter_token') || getOrCreateVoterToken();
      const { data, error } = await supabase.rpc('deduct_seat_change_fee', {
        p_voter_token: activeToken,
        p_from_seat: selectedSeat.name,
        p_to_seat: seatToConfirm.name,
        p_from_state: selectedSeat.state,
        p_to_state: seatToConfirm.state
      });
      if (error || !data?.success) {
        const errMsg = error?.message || data?.error || (lang === 'HI' ? 'अंक शेष नहीं है' : 'Insufficient DBG balance');
        alert(lang === 'HI' ? `सीट बदलाव त्रुटि: ${errMsg}` : `Seat shift error: ${errMsg}`);
        return;
      }
      if (data?.new_balance !== undefined) {
        setDbgPoints(data.new_balance);
        try {
          safeStorage.setItem('bhumat_dbg_balance', String(data.new_balance));
        } catch (e) {}
      }
      setFlippedOverrides({});
    }
    setSelectedSeat(seatToConfirm);
    setIsConfirmed(true);
    setIsChangeSeatModalOpen(false);
    setTentativeSeat(null);
    setSeatSearchInput('');
    try {
      safeStorage.setItem('bhumat_user_seat', seatToConfirm.name);
      safeStorage.setItem('bhumat_user_state', seatToConfirm.state);
      safeStorage.setItem('bhumat_seen_onboarding_guide', 'true');
    } catch (e) {}
    setShowOnboardingGuide(false);
    syncWallet(deviceHash);
  };

  const getFrequencyRevoteMessage = (recurrence?: string) => {
    const rec = (recurrence || 'monthly').toLowerCase();
    if (rec.includes('day')) return lang === 'HI' ? 'आप इस सीट पर मतदान कर चुके हैं। कल पुनः प्रयास करें।' : 'You already voted for this seat. You can re-vote tomorrow.';
    if (rec.includes('week')) return lang === 'HI' ? 'आप इस सीट पर मतदान कर चुके हैं। अगले सप्ताह पुनः प्रयास करें।' : 'You already voted for this seat. You can re-vote next week.';
    if (rec.includes('month')) return lang === 'HI' ? 'आप इस सीट पर मतदान कर चुके हैं। अगले महीने पुनः प्रयास करें।' : 'You already voted for this seat. You can re-vote next month.';
    return lang === 'HI' ? 'आप इस संसदीय क्षेत्र में पहले ही मतदान कर चुके हैं।' : 'You already voted in this constituency.';
  };

  const handleCastVote = async (poll: Poll, optionIdx: number, e?: React.MouseEvent | React.TouchEvent) => {
    if (!selectedSeat) return;
    
    // Synchronous Guest Verification Check
    const rawPhone = safeStorage.getItem('bhumat_user_phone');
    const isUserVerified = Boolean(
      (linkedPhone && linkedPhone.trim() !== '' && linkedPhone !== 'null' && linkedPhone !== 'undefined') ||
      (rawPhone && rawPhone.trim() !== '' && rawPhone !== 'null' && rawPhone !== 'undefined')
    );
    const storedCountRaw = safeStorage.getItem('bhumat_guest_vote_count');
    const currentCount = storedCountRaw ? parseInt(storedCountRaw, 10) : guestVotesCast;

    if (!isUserVerified && currentCount >= 3) {
      showPointerToast(lang === 'HI' ? '🔒 अतिथि सीमा पूरी (3/3)। जारी रखने हेतु साइन अप करें।' : '🔒 Guest runway finished (3/3). SignUp to continue.', e);
      setIsAuthModalOpen(true);
      return;
    }

    const dynamicCycle = poll.participation_mode === 'recurring' ? getCurrentCycleId(poll.recurrence) : 'lifetime';
    const cycleVoteKey = `${poll.id}___${dynamicCycle}`;
    const choiceKey = `${poll.id}___${dynamicCycle}`;
    
    if (votedCycleKeys.includes(cycleVoteKey)) {
      showPointerToast(getFrequencyRevoteMessage(poll.recurrence), e);
      return;
    }

    const updatedKeys = [...votedCycleKeys, cycleVoteKey];
    setVotedCycleKeys(updatedKeys);
    const updatedChoices = { ...sessionBallotChoices, [choiceKey]: optionIdx };
    setSessionBallotChoices(updatedChoices);
    const nowIso = new Date().toISOString();
    const updatedTimestamps = { ...voteTimestamps, [choiceKey]: nowIso };
    setVoteTimestamps(updatedTimestamps);
    setTotalVotesCount((prev) => prev + 1);
    setMonthlyVotesCount((prev) => prev + 1);

    if (poll.category === 'JanMat') {
      setJanmatAuditsCount((prev) => prev + 1);
    } else {
      setLokmatPollsCount((prev) => prev + 1);
    }
    setFlippedOverrides((prev) => ({ ...prev, [poll.id]: true }));

    if (!isUserVerified) {
      const nextCount = currentCount + 1;
      setGuestVotesCast(nextCount);
      safeStorage.setItem('bhumat_guest_vote_count', String(nextCount));
      const xpGained = poll.category === 'JanMat' ? '+40 XP' : '+30 XP';
      if (nextCount < 3) {
        showPointerToast(lang === 'HI' ? `✓ मत दर्ज! ${xpGained} • अतिथि ${nextCount} / 3` : `✓ Ballot logged! ${xpGained} • Guest ${nextCount} of 3`, e);
      } else {
        showPointerToast(lang === 'HI' ? `✓ तीसरा अतिथि मत दर्ज! अंक सुरक्षित करने हेतु साइन अप करें।` : `✓ 3rd Guest Ballot Cast! SignUp to lock points.`, e);
      }
    } else {
      const xpGained = poll.category === 'JanMat' ? '+40 XP' : '+30 XP';
      showPointerToast(lang === 'HI' ? `✓ ${selectedSeat.name} हेतु मत दर्ज! ${xpGained}` : `✓ Ballot logged for ${selectedSeat.name}! ${xpGained}`, e);
    }

    try {
      safeStorage.setItem('bhumat_voted_cycles', JSON.stringify(updatedKeys));
      safeStorage.setItem('bhumat_vote_timestamps', JSON.stringify(updatedTimestamps));
      safeStorage.setItem('bhumat_voted_polls', JSON.stringify(updatedChoices));
    } catch (err) {}

    // Dynamic Season ID for Gamification
    const currentDynamicSeason = getCurrentCycleId('monthly');
    try {
      await supabase.rpc('record_vote_gamification', {
        p_voter_token: deviceHash,
        p_category: poll.category,
        p_state_name: selectedSeat.state,
        p_constituency_name: selectedSeat.name,
        p_season_id: currentDynamicSeason
      });
      setProfileRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.warn('Gamification XP logging error:', err);
    }

    // 1. Fetch challenge invisibly in background
let challengeId: string | null = null;
let solvedNonce: string | null = null;

try {
  const { data: challengeData } = await supabase.rpc('get_ballot_challenge', {
    p_voter_token: deviceHash,
    p_poll_id: poll.id
  });

  if (challengeData?.success) {
    challengeId = challengeData.challenge_id;
    // Solves in ~30ms in modern browsers
    solvedNonce = await solvePoWChallenge(
      challengeData.salt,
      poll.id,
      deviceHash,
      challengeData.difficulty
    );
  }
} catch (powErr) {
  console.warn('PoW pre-flight skipped or failed:', powErr);
}

// 2. Dispatch ballot with solved PoW
await supabase.rpc('cast_ballot_transaction', {
  p_poll_id: poll.id,
  p_cycle_id: dynamicCycle,
  p_voter_token: deviceHash,
  p_state_name: selectedSeat.state,
  p_constituency_name: selectedSeat.name,
  p_selected_option: optionIdx,
  p_challenge_id: challengeId,
  p_nonce: solvedNonce
});

    try {
      const { data: refReward } = await supabase.rpc('check_and_reward_referral', {
        p_voter_token: deviceHash,
        p_category: poll.category
      });
      if (refReward?.rewarded) {
        setDbgPoints(refReward.new_balance);
        safeStorage.setItem('bhumat_dbg_balance', String(refReward.new_balance));
        showPointerToast(`🎉 +${refReward.bonus} DBG Referral Milestone Unlocked!`, e);
      }
    } catch (err) {
      console.warn('Referral milestone trigger error:', err);
    }

    syncWallet(deviceHash);
  };

  const liveAccessiblePolls = useMemo(() => {
    return polls.filter((p) => p.is_active && (pillarFilter === 'ALL' || p.category === pillarFilter));
  }, [polls, pillarFilter]);

  const currentSeasonFuturePolls = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return polls
      .filter((p) => {
        if (!p.starts_at) return false;
        const d = new Date(p.starts_at);
        const isCurrentSeason = d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        return isCurrentSeason && d.getTime() > now.getTime();
      })
      .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime());
  }, [polls]);

  const allFlattenedSeats = useMemo(() => {
    const list: Array<{ name: string; state: string }> = [];
    Object.entries(GROUPED_PARLIAMENTARY_SEATS).forEach(([state, seats]) => {
      seats.forEach((seat) => list.push({ name: seat, state }));
    });
    return list;
  }, []);

  const searchPollMatches = useMemo(() => {
    let list = polls;
    if (pillarFilter !== 'ALL') {
      list = list.filter((p) => p.category === pillarFilter);
    }
    if (!pollSearchQuery.trim()) return list;
    const q = pollSearchQuery.toLowerCase().trim();
    return list.filter((p) =>
      p.title_en.toLowerCase().includes(q) ||
      p.title_hi.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [pollSearchQuery, polls, pillarFilter]);

  const filteredDropdownSeats = useMemo(() => {
    if (!seatSearchInput.trim()) return GROUPED_PARLIAMENTARY_SEATS;
    const q = seatSearchInput.toLowerCase().trim();
    const out: Record<string, string[]> = {};
    Object.entries(GROUPED_PARLIAMENTARY_SEATS).forEach(([state, seats]) => {
      const matched = seats.filter((s) => s.toLowerCase().includes(q) || state.toLowerCase().includes(q));
      if (matched.length > 0) out[state] = matched;
    });
    return out;
  }, [seatSearchInput]);

  const quickSeatMatches = useMemo(() => {
    if (!seatSearchInput.trim() || tentativeSeat) return [];
    const q = seatSearchInput.toLowerCase().trim();
    return allFlattenedSeats
      .filter((s) => s.name.toLowerCase().includes(q) || s.state.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? -1 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? -1 : 1;
        return aStarts - bStarts;
      })
      .slice(0, 5);
  }, [seatSearchInput, allFlattenedSeats, tentativeSeat]);

  const recognitionTier = resolveCivicRecognitionTier(prevMonthVotesCount);
  const displayMonthlyVotes = Math.max(monthlyVotesCount, totalVotesCount);

  if (!mounted) return null;

  if (expandedPoll) {
    const dynamicCycle = expandedPoll.participation_mode === 'recurring' ? getCurrentCycleId(expandedPoll.recurrence) : 'lifetime';
    const scopedUserChoice = sessionBallotChoices[`${expandedPoll.id}___${dynamicCycle}`] ?? null;
    return (
      <PollExpandedView
        poll={expandedPoll}
        userSeatName={selectedSeat?.name}
        userState={selectedSeat?.state}
        userVotedOptionIdx={scopedUserChoice}
        lang={lang}
        onBack={closeExpandedView}
        initialTallies={cachedTalliesByPoll[expandedPoll.id] || []}
      />
    );
  }

  return (
    <div
      onClick={() => setActiveTooltip(null)}
      style={{ minHeight: '100dvh', backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <Head>
        <title>{lang === 'HI' ? 'भूमत — भारत का संप्रभु जनमत ग्रिड' : "BhuMat — Bharat's Sovereign Public Opinion Grid"}</title>
        <meta name="description" content="Sovereign consensus grid across 543 Lok Sabha seats. Vote on daily civic audits and cultural pulses." />
        <meta property="og:title" content="BhuMat — Bharat's Sovereign Public Opinion Engine" />
        <meta property="og:description" content="Cast your vote on today's national JanMat audit and LokMat pulse across all 543 parliamentary seats." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://vote.bhumat.com" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <style>{`
        @keyframes gentleLiveBlink {
          0% { opacity: 0.35; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0.35; transform: scale(0.92); }
        }
        .live-dot-animated {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #ef4444;
          display: inline-block;
          animation: gentleLiveBlink 2.4s infinite ease-in-out;
        }
        @keyframes drishtiActiveBlink {
          0% { opacity: 0.65; transform: scale(0.96); }
          50% { opacity: 1; transform: scale(1.04); }
          100% { opacity: 0.65; transform: scale(0.96); }
        }
        .drishti-active-chip {
          animation: drishtiActiveBlink 2.6s infinite ease-in-out;
        }
        @keyframes headerRadarWave {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .header-radar-beacon-container {
          position: relative;
          width: 10px;
          height: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .header-radar-ping {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background-color: #10b981;
          animation: headerRadarWave 2.4s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        .header-radar-core {
          position: relative;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #059669;
          z-index: 2;
        }
      `}</style>

      {/* Floating Pointer-Attached Toast */}
      {toast && (
        <div style={{ position: 'fixed', left: `${toast.x}px`, top: `${toast.y}px`, transform: 'translate(-50%, -100%)', zIndex: 120, backgroundColor: '#0f172a', color: '#ffffff', padding: '8px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, pointerEvents: 'none' }}>
          {toast.msg}
        </div>
      )}

      {/* Compact Info Popup */}
      {activeTooltip && (
        <div
          onClick={() => setActiveTooltip(null)}
          style={{
            position: 'fixed',
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
            zIndex: 140,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '10px 12px',
            borderRadius: '10px',
            maxWidth: '220px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            border: '1px solid #334155',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#38bdf8', marginBottom: '3px' }}>
            {activeTooltip.title}
          </div>
          <div style={{ fontSize: '10.5px', color: '#cbd5e1', lineHeight: 1.4 }}>
            {activeTooltip.desc}
          </div>
        </div>
      )}

      {/* Onboarding Guide Overlay */}
      {showOnboardingGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 900, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px' }}>
                {lang === 'HI' ? `नागरिक मार्गदर्शन • चरण ${onboardingStep} / 3` : `CITIZEN ONBOARDING • STEP ${onboardingStep} OF 3`}
              </span>
              <button
                onClick={() => {
                  setShowOnboardingGuide(false);
                  safeStorage.setItem('bhumat_seen_onboarding_guide', 'true');
                }}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 800, color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {onboardingStep === 1 && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 900, margin: '4px 0 6px 0', color: '#0f172a' }}>
                  {lang === 'HI' ? '1. आपकी संसदीय सीट, आपकी आवाज' : '1. Your Lok Sabha Seat Is Your Voice'}
                </h3>
                <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                  {lang === 'HI' 
                    ? 'भूमत सभी 543 संसदीय क्षेत्रों में लोकमत दर्ज करता है। अपने मत को स्थानीय समुदाय से जोड़ने हेतु अपनी सीट चुनें।'
                    : 'BhuMat maps opinion across all 543 parliamentary constituencies. Choose your home seat once to anchor your votes to your local community.'}
                </p>
              </div>
            )}

            {onboardingStep === 2 && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 900, margin: '4px 0 6px 0', color: '#d97706' }}>
                  {lang === 'HI' ? '2. लोकमत: सांस्कृतिक एवं क्षेत्रीय पल्स' : '2. LokMat: Cultural & Regional Pulse'}
                </h3>
                <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                  {lang === 'HI' 
                    ? 'प्रतिदिन सुबह 8:00 बजे जारी। सामाजिक विमर्श, क्षेत्रीय मुद्दों व परंपराओं पर अपना खुला मत व्यक्त करें।'
                    : 'Published daily at 8:00 AM. Cast your voice on public culture, regional debates, and national trends. Unmasks local consensus trends.'}
                </p>
              </div>
            )}

            {onboardingStep === 3 && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 900, margin: '4px 0 6px 0', color: '#059669' }}>
                  {lang === 'HI' ? '3. जनमत: गोपनीय नागरिक ऑडिट' : '3. JanMat: Cryptographic Secret Audit'}
                </h3>
                <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                  {lang === 'HI' 
                    ? 'प्रतिदिन शाम 8:00 बजे जारी। 100% गोपनीय मतपेटी: आपके मत के साथ कोई व्यक्तिगत पहचान या टोकन दर्ज नहीं होता।'
                    : 'Published daily at 8:00 PM. High-integrity governance audits. 100% blind ballot: zero voter tokens or IPs are recorded on your ballot.'}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3].map((step) => (
                  <span
                    key={step}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: onboardingStep === step ? '#0284c7' : '#cbd5e1'
                    }}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  if (onboardingStep < 3) {
                    setOnboardingStep((prev) => (prev + 1) as any);
                  } else {
                    setShowOnboardingGuide(false);
                    safeStorage.setItem('bhumat_seen_onboarding_guide', 'true');
                  }
                }}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {onboardingStep < 3 ? (lang === 'HI' ? 'आगे ❯' : 'Next ❯') : (lang === 'HI' ? 'प्रारंभ करें ✓' : 'Get Started ✓')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Top Header */}
      <header style={{ height: '56px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 40, width: '100%' }}>
        <div style={{ maxWidth: '460px', margin: '0 auto', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' }}>
            <span 
              onClick={handleBrandReset} 
              style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7', cursor: 'pointer' }}
              title={lang === 'HI' ? 'वोट फीड पर वापस जाएं' : 'Reset & Go to Poll Feed'}
            >
              BhuMat
            </span>
            <span style={{ fontSize: '9px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, cursor: 'default' }}>
              {lang === 'HI' ? 'प्रारंभिक' : 'EARLY ACCESS'}
            </span>
            {selectedSeat && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '999px', fontSize: '11px', cursor: 'default' }}>
                <div className="header-radar-beacon-container">
                  <div className="header-radar-ping" />
                  <div className="header-radar-core" />
                </div>
                <span style={{ color: '#065f46', fontWeight: 700 }}>{selectedSeat.name}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              onClick={(e) => triggerInfoPopup(
                lang === 'HI' ? 'नागरिक DBG क्रेडिट' : 'Civic DBG Balance',
                lang === 'HI'
                  ? 'आपके संप्रभु क्रेडिट। भागीदारी निरंतरता एवं सहभागिता से अर्जित। सीट परिवर्तन शुल्क 1 DBG है।'
                  : 'Your sovereign credits. Earned by participation consistency & verified peer referrals. Used for constituency seat shifts.',
                e
              )}
              style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, color: '#b45309', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <span>⚡ {dbgPoints} DBG</span>
              <span style={{ fontSize: '10px', opacity: 0.6 }}>ⓘ</span>
            </div>
            <button onClick={() => setLang(lang === 'EN' ? 'HI' : 'EN')} style={{ border: 'none', backgroundColor: '#f1f5f9', fontWeight: 700, fontSize: '10px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}>
              {lang === 'EN' ? 'हिन्दी' : 'EN'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 14px 120px 14px' }}>
        
        {/* TAB 1: VOTE FEED */}
        {activeTab === 'vote' && (
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Guest Runway Indicator Meter */}
            {!linkedPhone && isConfirmed && (
              <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '16px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>
                    {lang === 'HI' ? `अतिथि रनवे: ${guestVotesCast} / 3 मत प्रयुक्त` : `Guest Runway: ${guestVotesCast} of 3 Ballots Cast`}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#475569', marginTop: '2px' }}>
                    {guestVotesCast >= 3 
                      ? (lang === 'HI' ? 'रनवे पूर्ण! मतदान जारी रखने हेतु साइन अप करें।' : 'Runway complete! SignUp to keep voting.')
                      : (lang === 'HI' ? `OTP सत्यापन से पूर्व ${3 - guestVotesCast} मत शेष।` : `${3 - guestVotesCast} ballot${3 - guestVotesCast === 1 ? '' : 's'} remaining before OTP registration.`)}
                  </div>
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  style={{ padding: '6px 12px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                >
                  {lang === 'HI' ? 'साइन अप करें' : 'SignUp'}
                </button>
              </div>
            )}

            {!isConfirmed ? (
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '28px 20px', width: '100%', boxSizing: 'border-box' }}>
                <span style={{ backgroundColor: '#fef3c7', color: '#d97706', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px' }}>
                  {lang === 'HI' ? 'भूमत नागरिक नामांकन' : 'BHUMAT CITIZEN ENROLLMENT'}
                </span>
                <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '10px 0 4px 0' }}>
                  {lang === 'HI' ? 'अपनी संसदीय सीट का चयन करें' : 'Select Your Parliamentary Seat'}
                </h1>
                <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 16px 0' }}>
                  {lang === 'HI'
                    ? 'अपने संप्रभु मत को अनलॉक करने के लिए 543 सीटों में से अपनी लोकसभा सीट चुनें:'
                    : 'Select your Lok Sabha constituency across all 543 seats to unlock your sovereign ballot:'}
                </p>
                <div style={{ position: 'relative', width: '100%', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder={lang === 'HI' ? "🔍 सीट खोजें (उदा. दरभंगा, नागपुर, बांका)..." : "🔍 Search seat (e.g. Nagpur, Banka, Buxar)..."}
                    value={seatSearchInput}
                    onChange={(e) => setSeatSearchInput(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 36px 10px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px' }}
                  />
                  {seatSearchInput && (
                    <button
                      onClick={() => setSeatSearchInput('')}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', fontWeight: 800 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {quickSeatMatches.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                    {quickSeatMatches.map((m) => (
                      <span
                        key={m.name}
                        onClick={() => {
                          setTentativeSeat({ name: m.name, state: m.state });
                          setSeatSearchInput(m.name);
                          if (typeof document !== 'undefined' && document.activeElement) {
                            (document.activeElement as HTMLElement)?.blur();
                          }
                        }}
                        style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        📍 {m.name} ({m.state})
                      </span>
                    ))}
                  </div>
                )}
                <select
                  value={tentativeSeat ? `${tentativeSeat.name}|||${tentativeSeat.state}` : ''}
                  onChange={(e) => {
                    if (!e.target.value) return setTentativeSeat(null);
                    const [name, state] = e.target.value.split('|||');
                    setTentativeSeat({ name, state });
                    if (typeof document !== 'undefined' && document.activeElement) {
                      (document.activeElement as HTMLElement)?.blur();
                    }
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1.5px solid #0284c7', fontSize: '13px', fontWeight: 700, marginBottom: '14px', backgroundColor: '#f0f9ff' }}
                >
                  <option value="">{lang === 'HI' ? '-- संसदीय सीट चुनें (543) --' : '-- Choose Parliamentary Seat (543) --'}</option>
                  {Object.entries(filteredDropdownSeats).map(([state, seats]) => (
                    <optgroup key={state} label={`──────── 📍 ${state.toUpperCase()} ────────`}>
                      {seats.map((seat) => (
                        <option key={seat} value={`${seat}|||${state}`}>
                          {seat} ({state})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  disabled={!tentativeSeat}
                  onClick={handleConfirmSeat}
                  style={{ width: '100%', padding: '14px', backgroundColor: tentativeSeat ? '#10b981' : '#cbd5e1', color: '#ffffff', fontWeight: 800, borderRadius: '12px', border: 'none', cursor: tentativeSeat ? 'pointer' : 'not-allowed' }}
                >
                  {lang === 'HI' ? `पुष्टि करें एवं ${tentativeSeat?.name || ''} में प्रवेश करें` : `Confirm & Enter ${tentativeSeat?.name || ''}`}
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '14px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#059669', fontWeight: 800 }}>
                      {lang === 'HI' ? '● सत्यापित लोकसभा' : '● Verified Lok Sabha'}
                    </span>
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>{selectedSeat?.name} <span style={{ fontSize: '12px', color: '#475569' }}>({selectedSeat?.state})</span></div>
                  </div>
                  <button
                    onClick={() => {
                      setTentativeSeat(null);
                      setSeatSearchInput('');
                      setIsChangeSeatModalOpen(true);
                    }}
                    style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', fontSize: '11px', padding: '6px 12px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {lang === 'HI' ? `सीट बदलें (${SEAT_CHANGE_COST_DBG} DBG)` : `Change Seat (${SEAT_CHANGE_COST_DBG} DBG)`}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '4px', borderRadius: '12px' }}>
                  <button onClick={() => setPillarFilter('ALL')} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: pillarFilter === 'ALL' ? '#0f172a' : 'transparent', color: pillarFilter === 'ALL' ? '#ffffff' : '#64748b', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>{lang === 'HI' ? 'सभी फीड' : 'All Feeds'}</button>
                  <button onClick={() => setPillarFilter('JanMat')} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: pillarFilter === 'JanMat' ? '#059669' : 'transparent', color: pillarFilter === 'JanMat' ? '#ffffff' : '#059669', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>JanMat</button>
                  <button onClick={() => setPillarFilter('LokMat')} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: pillarFilter === 'LokMat' ? '#d97706' : 'transparent', color: pillarFilter === 'LokMat' ? '#ffffff' : '#d97706', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>LokMat</button>
                </div>

                {liveAccessiblePolls.map((poll) => {
                  const isJanMat = poll.category === 'JanMat';
                  const dynamicCycle = poll.participation_mode === 'recurring' ? getCurrentCycleId(poll.recurrence) : 'lifetime';
                  const cycleVoteKey = `${poll.id}___${dynamicCycle}`;
                  const choiceKey = `${poll.id}___${dynamicCycle}`;
                  const hasVotedThisCycle = votedCycleKeys.includes(cycleVoteKey);
                  const isFlipped = flippedOverrides[poll.id] !== undefined ? flippedOverrides[poll.id] : hasVotedThisCycle;
                  const userChoiceIdx = sessionBallotChoices[choiceKey];
                  const optionCount = poll.options.length;

                  // 3D Perspective Card Container with Dynamic Heights
                  const computedCardHeight = isFlipped
                    ? Math.max(680, 520 + optionCount * 44)
                    : Math.max(540, 380 + optionCount * 70);

                  return (
                    <div
                      key={poll.id}
                      style={{
                        perspective: '1200px',
                        width: '100%',
                        height: `${computedCardHeight}px`,
                        marginBottom: '8px'
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '100%',
                          transition: 'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
                          transformStyle: 'preserve-3d',
                          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                        }}
                      >
                        {/* FRONT CARD: BALLOT VIEW */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backfaceVisibility: 'hidden',
                            backgroundColor: '#ffffff',
                            border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                            borderRadius: '24px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxSizing: 'border-box',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '28px', marginBottom: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="live-dot-animated" />
                                <span style={{ fontSize: '11px', fontWeight: 900, color: '#ef4444', letterSpacing: '0.04em', lineHeight: 1 }}>LIVE</span>
                                <span
                                  onClick={(e) => triggerInfoPopup(
                                    isJanMat ? (lang === 'HI' ? 'जनमत नागरिक ऑडिट' : 'JanMat Civic Audit') : (lang === 'HI' ? 'लोकमत सांस्कृतिक पल्स' : 'LokMat Cultural Pulse'),
                                    isJanMat
                                      ? (lang === 'HI' ? 'गोपनीय मतपेटी। पहचान विहीन, शून्य टोकन संकलित।' : 'Cryptographic Secret Ballot. Decoupled from your identity, zero voter tokens stored on your ballot.')
                                      : (lang === 'HI' ? 'खुला सांस्कृतिक मत। स्थानीय रुझानों को उजागर करने हेतु प्रोफाइल से संबद्ध।' : 'Open Civic Pulse. Choice attributed to your voter profile to reveal community cultural trends.'),
                                    e
                                  )}
                                  style={{
                                    backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb',
                                    color: isJanMat ? '#059669' : '#d97706',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    padding: '3px 8px',
                                    borderRadius: '999px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    lineHeight: 1
                                  }}
                                >
                                  <span>{poll.category}</span>
                                  <span style={{ fontSize: '9px', opacity: 0.6 }}>ⓘ</span>
                                </span>
                              </div>
                              {hasVotedThisCycle && (
                                <button
                                  onClick={() => setFlippedOverrides((prev) => ({ ...prev, [poll.id]: true }))}
                                  style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
                                >
                                  {lang === 'HI' ? 'दृष्टि देखें ↺' : 'View Drishti ↺'}
                                </button>
                              )}
                            </div>

                            {/* Standardized Primary Question Typography */}
                            <div style={{ marginBottom: '12px' }}>
                              <h2 style={{ fontSize: '17px', fontWeight: 850, color: '#0f172a', lineHeight: 1.35, letterSpacing: '-0.015em', margin: '0 0 6px 0', wordBreak: 'break-word' }}>
                                {lang === 'EN' ? poll.title_en : poll.title_hi}
                              </h2>
                              <p style={{ fontSize: '13px', fontWeight: 500, color: '#475569', lineHeight: 1.45, margin: 0, wordBreak: 'break-word' }}>
                                {lang === 'EN' ? poll.title_hi : poll.title_en}
                              </p>
                            </div>

                            <div style={{ margin: '0 0 14px 0', maxWidth: '100%', boxSizing: 'border-box' }}>
                              <TickerTape activePoll={poll} lang={lang} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                              {poll.options.map((opt, idx) => {
                                const optColor = OPTION_PALETTE[idx % OPTION_PALETTE.length];
                                const isUserChoice = userChoiceIdx === idx;
                                const showChoiceTag = !isJanMat && isUserChoice && hasVotedThisCycle;
                                return (
                                  <button
                                    key={opt.id}
                                    onClick={(e) => handleCastVote(poll, idx, e)}
                                    style={{
                                      padding: '14px 16px',
                                      minHeight: '48px',
                                      borderRadius: '13px',
                                      backgroundColor: showChoiceTag ? '#ecfdf5' : '#ffffff',
                                      border: showChoiceTag ? `2px solid ${optColor}` : `1.5px solid ${optColor}`,
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      width: '100%',
                                      boxSizing: 'border-box',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '4px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
                                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', flex: 1, wordBreak: 'break-word', lineHeight: 1.3 }}>
                                        {lang === 'EN' ? opt.text_en : opt.text_hi}
                                      </div>
                                      {showChoiceTag && (
                                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', backgroundColor: '#d1fae5', border: '1px solid #a7f3d0', padding: '2px 7px', borderRadius: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                          {lang === 'HI' ? '✓ आपका मत' : '✓ Your Vote'}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '11.5px', color: '#475569', wordBreak: 'break-word', lineHeight: 1.3, fontWeight: 500 }}>
                                      {lang === 'EN' ? opt.text_hi : opt.text_en}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: 'auto' }}>
                            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                              {isJanMat 
                                ? (lang === 'HI' ? '🔒 गोपनीय गुप्त मतपेटी' : '🔒 Cryptographic Secret Ballot')
                                : (lang === 'HI' ? '🗳️ खुला सार्वजनिक मत' : '🗳️ Open Public Mat')}
                            </span>
                            {hasVotedThisCycle && (
                              <button
                                onClick={() => openExpandedView(poll)}
                                style={{ background: isJanMat ? '#ecfdf5' : '#fffbeb', color: isJanMat ? '#059669' : '#d97706', border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`, padding: '7px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                              >
                                {lang === 'HI' ? 'पूर्ण दृष्टि देखें ↗' : 'Explore Full Drishti ↗'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* BACK CARD: DRISHTI STATE VIEW (SINGLE PRIMARY LANGUAGE ONLY) */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                            backgroundColor: '#ffffff',
                            border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                            borderRadius: '24px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxSizing: 'border-box',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '28px', marginBottom: '8px' }}>
                              <span className="drishti-active-chip" style={{ backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb', color: isJanMat ? '#059669' : '#d97706', fontSize: '10.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '999px', lineHeight: 1 }}>
                                {lang === 'HI' ? '✓ दृष्टि मत सक्रिय' : '✓ DRISHTI MAT ACTIVE'}
                              </span>
                              <button
                                onClick={() => setFlippedOverrides((prev) => ({ ...prev, [poll.id]: false }))}
                                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '11px', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
                              >
                                {lang === 'HI' ? 'मतपत्र देखें ↻' : 'View Ballot ↻'}
                              </button>
                            </div>

                            {/* Strictly Single Language on State Drishti Header */}
                            <div style={{ marginBottom: '10px' }}>
                              <h2 style={{ fontSize: '17px', fontWeight: 850, margin: 0, color: '#0f172a', lineHeight: 1.35, letterSpacing: '-0.015em' }}>
                                {lang === 'EN' ? poll.title_en : poll.title_hi}
                              </h2>
                            </div>

                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: poll.options.length <= 2 ? '1fr 1fr' : 'repeat(auto-fit, minmax(160px, 1fr))',
                                gap: '8px 10px',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                padding: '10px 12px',
                                marginBottom: '10px',
                                boxSizing: 'border-box',
                                width: '100%'
                              }}
                            >
                              {poll.options.map((opt, idx) => {
                                const optColor = OPTION_PALETTE[idx % OPTION_PALETTE.length];
                                const optText = lang === 'EN' ? opt.text_en : opt.text_hi;
                                return (
                                  <div
                                    key={opt.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      color: '#1e293b',
                                      lineHeight: 1.2
                                    }}
                                  >
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: optColor, flexShrink: 0 }} />
                                    <span style={{ wordBreak: 'break-word', flex: 1 }}>{optText}</span>
                                  </div>
                                );
                              })}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                                <span>⚖️</span>
                                <span>{lang === 'HI' ? 'खंडित मत (टाई)' : 'Split Mat (Tie)'}</span>
                              </div>
                            </div>

                            {/* Embedded State Drishti SVG Map */}
                            <div style={{ width: '100%' }}>
                              <DrishtiMap
                                selectedConstituencyName={selectedSeat?.name}
                                selectedState={selectedSeat?.state}
                                pollId={poll.id}
                                userVotedOptionIdx={userChoiceIdx ?? null}
                                options={poll.options}
                                optimisticLocalVote={hasVotedThisCycle}
                                lang={lang}             // <--- Add this prop
                                verifiedOnly={false}     // <--- Add this prop (default to verified consensus)
                              />
                            </div>
                          </div>

                          {/* Inside-Container Anchored Drishti Button */}
                          <div style={{ width: '100%', marginTop: 'auto', paddingTop: '10px' }}>
                            <button
                              type="button"
                              onClick={() => openExpandedView(poll)}
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '13px 16px',
                                backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb',
                                border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                                borderRadius: '12px',
                                color: isJanMat ? '#059669' : '#d97706',
                                fontSize: '12.5px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                              }}
                            >
                              <span>{lang === 'HI' ? 'पूर्ण दृष्टि देखें (543 सीटें)' : 'Explore Full Drishti (543 Seats)'}</span>
                              <span>🔓</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* TAB 2: DEDICATED POLL SEARCH & EXPLORER */}
        {activeTab === 'search' && (
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Search Header Container */}
            <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.04em' }}>
                  {lang === 'EN' ? 'SOVEREIGN ARCHIVE' : 'संप्रभु संग्रह'}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>
                  ● {polls.filter(p => p.is_active).length} {lang === 'EN' ? 'Active Polls' : 'सक्रिय मत'}
                </span>
              </div>

              <h2 style={{ fontSize: '18px', fontWeight: 850, margin: '6px 0 4px 0', color: '#0f172a', letterSpacing: '-0.015em' }}>
                {lang === 'EN' ? 'Search Public Opinion Polls' : 'सार्वजनिक जनमत खोजें'}
              </h2>
              <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 14px 0', lineHeight: 1.45 }}>
                {lang === 'EN' 
                  ? 'Explore questions, governance audits, and cultural consensus across Bharat:' 
                  : 'भारत भर के प्रशासनिक ऑडिट और सांस्कृतिक मतों को खोजें:'}
              </p>

              {/* High-Contrast Search Input */}
              <div style={{ position: 'relative', width: '100%', marginBottom: '12px' }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={lang === 'EN' ? "🔍 Search by topic, keyword, or issue..." : "🔍 विषय, मुद्दा या शब्द खोजें..."}
                  value={pollSearchQuery}
                  onChange={(e) => setPollSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 36px 12px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 600,
                    outline: 'none',
                    backgroundColor: '#f8fafc',
                    color: '#0f172a'
                  }}
                />
                {pollSearchQuery && (
                  <button
                    onClick={() => setPollSearchQuery('')}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', fontWeight: 800 }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Pillar Filter Chips */}
              <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPillarFilter('ALL')}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: '7px',
                    border: 'none',
                    backgroundColor: pillarFilter === 'ALL' ? '#0f172a' : 'transparent',
                    color: pillarFilter === 'ALL' ? '#ffffff' : '#64748b',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {lang === 'EN' ? 'All (543)' : 'सभी (543)'}
                </button>
                <button
                  type="button"
                  onClick={() => setPillarFilter('JanMat')}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: '7px',
                    border: 'none',
                    backgroundColor: pillarFilter === 'JanMat' ? '#059669' : 'transparent',
                    color: pillarFilter === 'JanMat' ? '#ffffff' : '#059669',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  JanMat
                </button>
                <button
                  type="button"
                  onClick={() => setPillarFilter('LokMat')}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: '7px',
                    border: 'none',
                    backgroundColor: pillarFilter === 'LokMat' ? '#d97706' : 'transparent',
                    color: pillarFilter === 'LokMat' ? '#ffffff' : '#d97706',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  LokMat
                </button>
              </div>
            </div>

            {/* Results Stream */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {searchPollMatches.length === 0 ? (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '32px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔎</div>
                  <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                    {lang === 'EN' ? 'No matching polls found' : 'कोई प्रश्न नहीं मिला'}
                  </div>
                  <div style={{ fontSize: '12px' }}>
                    {lang === 'EN' 
                      ? `Try searching with different keywords or switch filters.` 
                      : `कृपया अन्य शब्दों से खोजें या फ़िल्टर बदलें।`}
                  </div>
                </div>
              ) : (
                searchPollMatches.map((poll) => {
                  const isJanMat = poll.category === 'JanMat';
                  return (
                    <div
                      key={poll.id}
                      onClick={() => openExpandedView(poll)}
                      style={{
                        backgroundColor: '#ffffff',
                        border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                        borderRadius: '16px',
                        padding: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                        transition: 'transform 0.1s ease, border-color 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              color: isJanMat ? '#059669' : '#d97706',
                              backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb',
                              border: `1px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                              padding: '2px 8px',
                              borderRadius: '999px'
                            }}
                          >
                            ● {poll.category}
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                            {poll.recurrence ? `${poll.recurrence.toUpperCase()}` : 'MONTHLY'}
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7' }}>
                          {lang === 'EN' ? 'View Drishti ❯' : 'दृष्टि देखें ❯'}
                        </span>
                      </div>

                      {/* Primary Title */}
                      <div style={{ fontSize: '15.5px', fontWeight: 850, color: '#0f172a', lineHeight: 1.35 }}>
                        {lang === 'EN' ? poll.title_en : poll.title_hi}
                      </div>

                      {/* Clean Subtitle */}
                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#475569', lineHeight: 1.4 }}>
                        {lang === 'EN' ? poll.title_hi : poll.title_en}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SCHEDULE & CADENCE */}
        {activeTab === 'schedule' && (() => {
          const now = new Date();
          const currentMonthIdx = now.getMonth();
          const currentYear = now.getFullYear();
          const seasonNumber = currentMonthIdx + 1;

          const activeMonthName = now.toLocaleString(lang === 'HI' ? 'hi-IN' : 'en-US', { month: 'long' });
          const seasonTitleText = lang === 'HI'
            ? `${activeMonthName} सत्र (सत्र ${seasonNumber} • ${currentYear})`
            : `${activeMonthName} Season (Season ${seasonNumber} • ${currentYear})`;

          return (
            <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Dynamic Season Banner */}
              <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.04em' }}>
                    {lang === 'EN' ? `SEASON ${seasonNumber} • ACTIVE CYCLE` : `सत्र ${seasonNumber} • सक्रिय चक्र`}
                  </span>
                  <span
                    onClick={(e) => triggerInfoPopup(
                      lang === 'EN' ? '12 Sovereign Seasons' : '12 संप्रभु सत्र',
                      lang === 'EN'
                        ? 'BhuMat operates in 12 monthly consensus cycles per year. At the end of each season, final constituency tallies are archived.'
                        : 'भूमत प्रति वर्ष 12 मासिक चक्रों में संचालित होता है। प्रत्येक सत्र के अंत में संसदीय क्षेत्रों के अंतिम मत संकलित किए जाते हैं।',
                      e
                    )}
                    style={{ fontSize: '11px', fontWeight: 700, color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>● {lang === 'EN' ? '12 Seasons / Year' : '12 सत्र / वर्ष'}</span>
                    <span style={{ fontSize: '10px', opacity: 0.6 }}>ⓘ</span>
                  </span>
                </div>

               <h2 style={{ fontSize: '18px', fontWeight: 850, margin: '4px 0 3px 0', color: '#0f172a', letterSpacing: '-0.015em' }}>
                  {seasonTitleText}
                </h2>
                <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.45 }}>
                  {lang === 'EN'
                    ? 'National ballots follow scheduled drops. Once cast, your vote is recorded in your Lok Sabha seat\'s tally for this cycle.'
                    : 'राष्ट्रीय मत निर्धारित समय पर जारी होते हैं। मतदान के बाद आपका मत आपके संसदीय क्षेत्र के आंकड़े में सुरक्षित जुड़ जाता है।'}
                </p>
              </div>

              {/* Daily Drop Rhythm Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '2px 4px' }}>
                  {lang === 'EN' ? 'Daily Drop Rhythm' : 'दैनिक मतदान समय'}
                </div>

                

                {/* LokMat Morning Drop */}
                <div
                  onClick={(e) => triggerInfoPopup(
                    lang === 'EN' ? 'LokMat Drop Rationale' : 'लोकमत समय का उद्देश्य',
                    lang === 'EN'
                      ? 'Published every morning at 8:00 AM. Covers public debates and sports/culture topics with transparent community profiles.'
                      : 'प्रतिदिन सुबह 8:00 बजे प्रकाशित। सामाजिक विमर्श, खेल व संस्कृति पर खुला सांस्कृतिक मत।',
                    e
                  )}
                  style={{ backgroundColor: '#ffffff', border: '1.5px solid #fde68a', borderRadius: '16px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                      🌅
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#92400e' }}>
                        {lang === 'EN' ? '08:00 AM Morning Drop' : 'सुबह 08:00 बजे'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#d97706', fontWeight: 600 }}>
                        {lang === 'EN' ? 'LokMat Cultural Pulse • Public Mat' : 'लोकमत सांस्कृतिक पल्स • खुला मत'}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#f59e0b', fontWeight: 800 }}>
                    {lang === 'EN' ? 'Active ❯' : 'सक्रिय ❯'}
                  </span>
                </div>
{/* JanMat Evening Drop */}
                <div
                  onClick={(e) => triggerInfoPopup(
                    lang === 'EN' ? 'JanMat Drop Rationale' : 'जनमत समय का उद्देश्य',
                    lang === 'EN'
                      ? 'Published every evening at 8:00 PM. Features critical civic and policy audits using anonymous secret ballots.'
                      : 'प्रतिदिन शाम 8:00 बजे प्रकाशित। प्रशासनिक और नीतिगत ऑडिट हेतु 100% गोपनीय मतपेटी।',
                    e
                  )}
                  style={{ backgroundColor: '#ffffff', border: '1.5px solid #a7f3d0', borderRadius: '16px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                      🌆
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#064e3b' }}>
                        {lang === 'EN' ? '08:00 PM Evening Drop' : 'शाम 08:00 बजे'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600 }}>
                        {lang === 'EN' ? 'JanMat Civic Audit • Secret Ballot' : 'जनमत नागरिक ऑडिट • गोपनीय मतपेटी'}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#10b981', fontWeight: 800 }}>
                    {lang === 'EN' ? 'Active ❯' : 'सक्रिय ❯'}
                  </span>
                </div>

              </div>

              {/* Cadence & Revoting Rules */}
              <div style={{ backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>
                    {lang === 'EN' ? 'HOW CADENCE & REVOTING WORK' : 'चक्र एवं पुनर्मतदान के नियम'}
                  </span>
                  <span
                    onClick={(e) => triggerInfoPopup(
                      lang === 'EN' ? 'Cadence Rules' : 'मतदान नियम',
                      lang === 'EN'
                        ? 'Recurring polls refresh every day, week, or month. Re-voting allows you to update your position as real-world developments unfold.'
                        : 'आवर्ती प्रश्न नियत अवधि में नवीनीकृत होते हैं। नए घटनाक्रमों के अनुसार आप अपना मत अद्यतन कर सकते हैं।',
                      e
                    )}
                    style={{ fontSize: '11px', color: '#0284c7', cursor: 'pointer', fontWeight: 700 }}
                  >
                    ⓘ {lang === 'EN' ? 'Info' : 'विवरण'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: '#475569', lineHeight: 1.45 }}>
                  <div>• <strong>{lang === 'EN' ? 'Daily Mat:' : 'दैनिक मत:'}</strong> {lang === 'EN' ? 'Re-vote unlocks every 24 hours at 8:00 AM / 8:00 PM.' : 'पुनर्मतदान हर 24 घंटे में सुबह 8:00 / शाम 8:00 बजे खुलता है।'}</div>
                  <div>• <strong>{lang === 'EN' ? 'Monthly Audits:' : 'मासिक ऑडिट:'}</strong> {lang === 'EN' ? 'Persist throughout the active season with historical trend preservation.' : 'पूरे सक्रिय सत्र तक खुले रहते हैं और ऐतिहासिक रुझान सुरक्षित रखते हैं।'}</div>
                  <div>• <strong>{lang === 'EN' ? 'One-Ballot Lock:' : 'एक मत सुरक्षा:'}</strong> {lang === 'EN' ? 'One vote per poll cycle. Shifting your seat locks previous cycle votes and new region applies only to future ballots.' : 'प्रति चक्र एक मत। सीट बदलने पर पुराने मत सुरक्षित रहते हैं और केवल आगामी मत नई सीट में जुड़ते हैं।'}</div>
                </div>
              </div>

              {/* Upcoming Queue */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '2px 4px' }}>
                  {lang === 'EN' ? `Upcoming Queue (${currentSeasonFuturePolls.length})` : `आगामी सूची (${currentSeasonFuturePolls.length})`}
                </div>
                {currentSeasonFuturePolls.length === 0 ? (
                  <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
                    {lang === 'EN'
                      ? '✓ All scheduled drops for this cycle are live in your Vote feed.'
                      : '✓ इस चक्र के सभी निर्धारित प्रश्न आपके वोट फीड में सक्रिय हैं।'}
                  </div>
                ) : (
                  currentSeasonFuturePolls.map((item) => (
                    <div key={item.id} style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 800, color: item.category === 'JanMat' ? '#059669' : '#d97706', backgroundColor: item.category === 'JanMat' ? '#ecfdf5' : '#fffbeb', padding: '2px 8px', borderRadius: '999px', border: `1px solid ${item.category === 'JanMat' ? '#a7f3d0' : '#fde68a'}` }}>
                          ● {item.category}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', backgroundColor: '#f0f9ff', padding: '2px 8px', borderRadius: '6px' }}>
                          📅 {format3LetterDate(item.starts_at, lang)}
                        </span>
                      </div>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', lineHeight: 1.35 }}>
                        {lang === 'EN' ? item.title_en : item.title_hi}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>
                        {lang === 'EN' ? item.title_hi : item.title_en}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}

        {/* TAB 4: CITIZEN PASSPORT & CIVIC XP */}
        {activeTab === 'profile' && (() => {
          const now = new Date();
          const activeMonthLabel = now.toLocaleString(lang === 'HI' ? 'hi-IN' : 'en-US', { month: 'long' });
          // Header renders:
// "October Season (Season 10 • 2026)" or "अक्टूबर सत्र (सत्र 10 • 2026)"

          return (
            <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '22px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                
                {/* Citizen Passport Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '19px', fontWeight: 900, color: '#0f172a' }}>{username}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 800, color: recognitionTier.color }}>
                        {recognitionTier.title}
                      </span>
                      <span
                        onClick={(e) => triggerInfoPopup(
                          lang === 'EN' ? 'Civic Recognition' : 'नागरिक सम्मान स्तर',
                          lang === 'EN'
                            ? 'Your tier upgrades as you cast ballots consistently across monthly cycles. Higher tiers represent seasoned civic contributors.'
                            : 'मासिक चक्रों में नियमित मतदान करने पर आपका स्तर बढ़ता है। उच्च स्तर सक्रिय एवं जागरूक नागरिकों की पहचान हैं।',
                          e
                        )}
                        style={{ fontSize: '10px', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        ⓘ
                      </span>
                    </div>
                  </div>
                  <span style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: '10.5px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px' }}>
                    {linkedPhone 
                      ? (lang === 'EN' ? '✓ Verified Citizen' : '✓ सत्यापित नागरिक')
                      : (lang === 'EN' ? '● Guest Session' : '● अतिथि सत्र')}
                  </span>
                </div>

                {/* Mobile Link / Verified Passport Banner */}
                <div style={{ marginTop: '12px', padding: '12px 14px', borderRadius: '14px', backgroundColor: linkedPhone ? '#f0fdf4' : '#fffbeb', border: `1px solid ${linkedPhone ? '#bbf7d0' : '#fde68a'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11.5px', fontWeight: 800, color: linkedPhone ? '#166534' : '#92400e' }}>
                      {linkedPhone 
                        ? (lang === 'EN' ? `📱 Linked Mobile: +91 ******${linkedPhone.slice(-4)}` : `📱 संबद्ध मोबाइल: +91 ******${linkedPhone.slice(-4)}`)
                        : (lang === 'EN' ? `⚠️ Guest Citizen (${guestVotesCast}/3 Ballots Used)` : `⚠️ अतिथि नागरिक (${guestVotesCast}/3 मत प्रयुक्त)`)}
                    </span>
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                      {linkedPhone 
                        ? (lang === 'EN' ? 'Passport sync active across devices' : 'सभी उपकरणों पर पासपोर्ट सिंक सक्रिय') 
                        : guestVotesCast >= 3 
                          ? (lang === 'EN' ? 'Guest quota reached! SignUp to continue voting' : 'अतिथि सीमा समाप्त! मतदान जारी रखने हेतु साइन अप करें') 
                          : (lang === 'EN' ? `${3 - guestVotesCast} guest ballot${3 - guestVotesCast === 1 ? '' : 's'} remaining before OTP registration` : `OTP सत्यापन से पूर्व ${3 - guestVotesCast} अतिथि मत शेष`)}
                    </div>
                  </div>
                  {!linkedPhone && (
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      style={{ padding: '7px 14px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      {lang === 'EN' ? 'Link Phone' : 'मोबाइल जोड़ें'}
                    </button>
                  )}
                </div>

                {/* DBG Civic Balance Card (1 DBG Standardized) */}
                <div style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '16px', padding: '16px', marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em' }}>
                        {lang === 'EN' ? 'CIVIC CREDITS' : 'नागरिक क्रेडिट'}
                      </span>
                      <span
                        onClick={(e) => triggerInfoPopup(
                          lang === 'EN' ? 'Civic DBG Credits' : 'नागरिक DBG क्रेडिट',
                          lang === 'EN'
                            ? `DBG points are sovereign civic credits. They cannot be bought with money; they are earned by participation and peer invites. Shifting your parliamentary seat costs ${SEAT_CHANGE_COST_DBG} DBG.`
                            : `DBG अंक संप्रभु नागरिक क्रेडिट हैं। इन्हें खरीदा नहीं जा सकता; ये केवल भागीदारी और सहभागिता से अर्जित होते हैं। सीट बदलने का शुल्क ${SEAT_CHANGE_COST_DBG} DBG है।`,
                          e
                        )}
                        style={{ fontSize: '10px', color: '#38bdf8', cursor: 'pointer' }}
                      >
                        ⓘ
                      </span>
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 900, color: '#f59e0b', marginTop: '2px' }}>
                      {dbgPoints} DBG
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                      {lang === 'EN' ? 'Constituency Shift Fee' : 'सीट परिवर्तन शुल्क'}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                      {SEAT_CHANGE_COST_DBG} DBG / {lang === 'EN' ? 'Shift' : 'बदलाव'}
                    </div>
                  </div>
                </div>

                {/* Itemized Civic Ledger Drawer */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px', marginTop: '12px' }}>
                  <div 
                    onClick={() => {
                      const nextState = !isLedgerOpen;
                      setIsLedgerOpen(nextState);
                      if (nextState) fetchLedger(deviceHash);
                    }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px' }}>📜</span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                        {lang === 'EN' ? 'Audit Ledger & DBG Receipts' : 'ऑडिट लेज़र एवं क्रेडिट विवरण'}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7' }}>
                      {isLedgerOpen ? (lang === 'EN' ? 'Hide ▲' : 'छुपाएं ▲') : (lang === 'EN' ? 'View History ▼' : 'इतिहास देखें ▼')}
                    </span>
                  </div>
                  {isLedgerOpen && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                      {ledgerEntries.length === 0 ? (
                        <div style={{ fontSize: '11.5px', color: '#64748b', textAlign: 'center', padding: '12px 0' }}>
                          {lang === 'EN' ? 'No transactions recorded yet.' : 'अभी तक कोई लेन-देन दर्ज नहीं है।'}
                        </div>
                      ) : (
                        ledgerEntries.map((tx) => (
                          <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#1e293b' }}>
                                {tx.description}
                              </span>
                              <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                                {new Date(tx.created_at).toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 900, color: tx.delta < 0 ? '#ef4444' : '#10b981', flexShrink: 0 }}>
                              {tx.delta > 0 ? `+${tx.delta}` : tx.delta} DBG
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Seasonal Leaderboard Engine */}
                <div style={{ marginTop: '14px' }}>
                  <LeaderboardView
                    userState={selectedSeat?.state || 'Bihar'}
                    userSeat={selectedSeat?.name || 'Karakat'}
                    voterToken={deviceHash}
                    refreshTrigger={profileRefreshKey}
                  />
                </div>

                {/* Monthly Season Dynamic Progress Bar (+1 DBG Goal) */}
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '12px 14px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800 }}>
                    <span style={{ color: '#475569' }}>
                      {lang === 'EN' ? `${activeMonthLabel} Goal (15 Ballots):` : `${activeMonthLabel} लक्ष्य (15 मत):`}
                    </span>
                    <span style={{ color: displayMonthlyVotes >= 15 ? '#059669' : '#0284c7' }}>
                      {displayMonthlyVotes} / 15 ({displayMonthlyVotes >= 15 
                        ? (lang === 'EN' ? '✓ +1 DBG Claimed' : '✓ +1 DBG प्राप्त') 
                        : (lang === 'EN' ? `${15 - displayMonthlyVotes} more to +1 DBG` : `+1 DBG हेतु ${15 - displayMonthlyVotes} और मत`)})
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '999px', marginTop: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.round((displayMonthlyVotes / 15) * 100))}%`, height: '100%', backgroundColor: displayMonthlyVotes >= 15 ? '#10b981' : '#0284c7', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {/* Sovereign Referral Card (Max 2 DBG Reward) */}
                <div style={{ backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '16px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>
                      {lang === 'EN' ? 'INVITE CITIZENS TO BHUMAT' : 'नागरिकों को आमंत्रित करें'}
                    </span>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#059669' }}>
                      +2 DBG / {lang === 'EN' ? 'Verified Invite' : 'सत्यापित आमंत्रण'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7', letterSpacing: '0.08em' }}>{referralCode}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(referralCode);
                          alert(lang === 'EN' ? 'Referral code copied to clipboard!' : 'रेफरल कोड कॉपी हो गया!');
                        }}
                        style={{ padding: '7px 14px', backgroundColor: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        {lang === 'EN' ? 'Copy' : 'कॉपी'}
                      </button>
                      <button
                        onClick={() => {
                          const msg = lang === 'EN'
                            ? `🇮🇳 Join me on BhuMat — Bharat's Sovereign Public Opinion Grid! Use my code *${referralCode}* to claim 1 DBG credit:\nhttps://vote.bhumat.com?ref=${referralCode}`
                            : `🇮🇳 भूमत से जुड़ें — भारत का संप्रभु जनमत ग्रिड! 1 DBG क्रेडिट पाने हेतु मेरा कोड *${referralCode}* उपयोग करें:\nhttps://vote.bhumat.com?ref=${referralCode}`;
                          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                        style={{ padding: '7px 14px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        {lang === 'EN' ? 'Share' : 'शेयर'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ballot Box Ledger Split */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                  <div
                    onClick={(e) => triggerInfoPopup(
                      lang === 'EN' ? 'JanMat Audits' : 'जनमत ऑडिट',
                      lang === 'EN'
                        ? 'Your total votes cast in anonymous cryptographic secret ballots.'
                        : 'गोपनीय मतपेटी में आपके द्वारा दिए गए कुल मत।',
                      e
                    )}
                    style={{ backgroundColor: '#ecfdf5', border: '1.5px solid #a7f3d0', padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#059669' }}>
                      {lang === 'EN' ? 'JanMat Audits ⓘ' : 'जनमत ऑडिट ⓘ'}
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#064e3b', marginTop: '2px' }}>{janmatAuditsCount}</div>
                  </div>
                  <div
                    onClick={(e) => triggerInfoPopup(
                      lang === 'EN' ? 'LokMat Pulses' : 'लोकमत पल्स',
                      lang === 'EN'
                        ? 'Your total votes cast in open cultural and public sentiment polls.'
                        : 'खुले सांस्कृतिक एवं सामाजिक पल्स में आपके द्वारा दिए गए कुल मत।',
                      e
                    )}
                    style={{ backgroundColor: '#fffbeb', border: '1.5px solid #fde68a', padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#d97706' }}>
                      {lang === 'EN' ? 'LokMat Polls ⓘ' : 'लोकमत पल्स ⓘ'}
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#92400e', marginTop: '2px' }}>{lokmatPollsCount}</div>
                  </div>
                </div>

                {/* Seat Details & Shift Trigger */}
                <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '14px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#475569' }}>{lang === 'EN' ? 'Active Lok Sabha Seat:' : 'सक्रिय संसदीय क्षेत्र:'}</span>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{selectedSeat?.name || (lang === 'EN' ? 'Unclaimed' : 'अचयनित')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#475569' }}>{lang === 'EN' ? 'State Jurisdiction:' : 'राज्य क्षेत्राधिकार:'}</span>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{selectedSeat?.state || 'Bharat'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#475569' }}>{lang === 'EN' ? 'Citizen Since:' : 'नागरिक प्रारंभ:'}</span>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatVotingSince(votingSinceDate, lang)}</span>
                  </div>
                </div>

                {/* Change Constituency Button */}
                <button
                  onClick={() => {
                    setTentativeSeat(null);
                    setSeatSearchInput('');
                    setIsChangeSeatModalOpen(true);
                  }}
                  style={{
                    width: '100%',
                    marginTop: '14px',
                    padding: '13px',
                    borderRadius: '12px',
                    border: '1.5px solid #0284c7',
                    backgroundColor: '#f0f9ff',
                    color: '#0369a1',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  🔄 {lang === 'EN' ? `Shift Parliamentary Seat (Costs ${SEAT_CHANGE_COST_DBG} DBG)` : `संसदीय सीट बदलें (${SEAT_CHANGE_COST_DBG} DBG शुल्क)`}
                </button>
              </div>
            </div>
          );
        })()}
      </main>

      {/* Change Seat Modal */}
      {isChangeSeatModalOpen && (
        <div
          onClick={() => setIsChangeSeatModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 200,
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
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ backgroundColor: '#fef3c7', color: '#d97706', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                {lang === 'HI' ? 'संप्रभु पुनर्नामांकन' : 'SOVEREIGN RE-ENROLLMENT'}
              </span>
              <button
                onClick={() => setIsChangeSeatModalOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  fontWeight: 800,
                  color: '#64748b'
                }}
              >
                ✕
              </button>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0' }}>
              {lang === 'HI' ? 'संसदीय सीट बदलें' : 'Change Lok Sabha Seat'}
            </h3>
            <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 14px 0' }}>
              {lang === 'HI' 
                ? `संसदीय सीट बदलने का शुल्क ${SEAT_CHANGE_COST_DBG} DBG है। नीचे अपना नया क्षेत्र चुनें:` 
                : `Changing your parliamentary seat costs ${SEAT_CHANGE_COST_DBG} DBG. Choose your new constituency below:`}
            </p>
            <div style={{ position: 'relative', width: '100%', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder={lang === 'HI' ? "🔍 सीट खोजें (उदा. नागपुर, दरभंगा, बांका)..." : "🔍 Search seat (e.g. Nagpur, Banka, Buxar)..."}
                value={seatSearchInput}
                onChange={(e) => setSeatSearchInput(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 36px 10px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px' }}
              />
              {seatSearchInput && (
                <button
                  onClick={() => setSeatSearchInput('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', fontWeight: 800 }}
                >
                  ✕
                </button>
              )}
            </div>
            {quickSeatMatches.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {quickSeatMatches.map((m) => (
                  <span
                    key={m.name}
                    onClick={() => {
                      setTentativeSeat({ name: m.name, state: m.state });
                      setSeatSearchInput(m.name);
                      if (typeof document !== 'undefined' && document.activeElement) {
                        (document.activeElement as HTMLElement)?.blur();
                      }
                    }}
                    style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    📍 {m.name} ({m.state})
                  </span>
                ))}
              </div>
            )}
            <select
              value={tentativeSeat ? `${tentativeSeat.name}|||${tentativeSeat.state}` : ''}
              onChange={(e) => {
                if (!e.target.value) return setTentativeSeat(null);
                const [name, state] = e.target.value.split('|||');
                setTentativeSeat({ name, state });
                if (typeof document !== 'undefined' && document.activeElement) {
                  (document.activeElement as HTMLElement)?.blur();
                }
              }}
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1.5px solid #0284c7', fontSize: '13px', fontWeight: 700, marginBottom: '14px', backgroundColor: '#f0f9ff' }}
            >
              <option value="">{lang === 'HI' ? '-- नई संसदीय सीट चुनें (543) --' : '-- Choose New Parliamentary Seat (543) --'}</option>
              {Object.entries(filteredDropdownSeats).map(([state, seats]) => (
                <optgroup key={state} label={`──────── 📍 ${state.toUpperCase()} ────────`}>
                  {seats.map((seat) => (
                    <option key={seat} value={`${seat}|||${state}`}>
                      {seat} ({state})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setIsChangeSeatModalOpen(false)}
                style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 800, borderRadius: '10px', border: 'none', cursor: 'pointer' }}
              >
                {lang === 'HI' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                disabled={!tentativeSeat || tentativeSeat.name === selectedSeat?.name}
                onClick={handleConfirmSeat}
                style={{ flex: 2, padding: '12px', backgroundColor: tentativeSeat && tentativeSeat.name !== selectedSeat?.name ? '#10b981' : '#cbd5e1', color: '#ffffff', fontWeight: 800, borderRadius: '10px', border: 'none', cursor: tentativeSeat && tentativeSeat.name !== selectedSeat?.name ? 'pointer' : 'not-allowed' }}
              >
                {lang === 'HI' ? `बदलाव की पुष्टि करें (${SEAT_CHANGE_COST_DBG} DBG)` : `Confirm Shift (${SEAT_CHANGE_COST_DBG} DBG)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4-Tab Bottom Dock Navigation */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '62px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          zIndex: 99,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          paddingBottom: 'env(safe-area-inset-bottom, 6px)',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.04)'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            boxSizing: 'border-box'
          }}
        >
          <button
            onClick={() => setActiveTab('search')}
            style={{ flex: 1, background: 'none', border: 'none', color: activeTab === 'search' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>🔍</span>
            <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'search' ? 800 : 600, marginTop: '3px' }}>{lang === 'HI' ? 'खोजें' : 'Search'}</span>
          </button>
          <button
            onClick={() => setActiveTab('vote')}
            style={{ flex: 1, background: 'none', border: 'none', color: activeTab === 'vote' ? '#10b981' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '19px', lineHeight: 1 }}>🗳️</span>
            <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'vote' ? 800 : 600, marginTop: '3px' }}>{lang === 'HI' ? 'मतदान' : 'Vote'}</span>
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            style={{ flex: 1, background: 'none', border: 'none', color: activeTab === 'schedule' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>📅</span>
            <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'schedule' ? 800 : 600, marginTop: '3px' }}>{lang === 'HI' ? 'समय-सारणी' : 'Schedule'}</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('profile');
              syncWallet(deviceHash);
            }}
            style={{ flex: 1, background: 'none', border: 'none', color: activeTab === 'profile' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>👤</span>
            <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'profile' ? 800 : 600, marginTop: '3px' }}>{lang === 'HI' ? 'प्रोफ़ाइल' : 'Profile'}</span>
          </button>
        </div>
      </nav>

      <PhoneAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        guestToken={deviceHash}
        userState={selectedSeat?.state || 'Bihar'}
        userSeat={selectedSeat?.name || 'Karakat'}
        onAuthSuccess={(newToken) => {
          setDeviceHash(newToken);
          setLinkedPhone(safeStorage.getItem('bhumat_user_phone'));
          syncWallet(newToken);
          setProfileRefreshKey((prev) => prev + 1);
        }}
      />
    </div>
  );
}