'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { supabase, safeStorage } from './utils/supabaseClient';
import TickerTape from './TickerTape';
import { getCurrentCycleId } from './utils/cycleManager';

const PhoneAuthModal = dynamic(() => import('./PhoneAuthModal'), { ssr: false });
const DrishtiMap = dynamic(() => import('./DrishtiMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '260px', backgroundColor: '#f1f5f9', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
      Loading sovereign map vector...
    </div>
  )
});
const PollExpandedView = dynamic(() => import('./PollExpandedView'), { ssr: false });
const LeaderboardView = dynamic(() => import('./LeaderboardView'), { ssr: false });

const SEAT_CHANGE_COST_DBG = 100;
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
  'Uttar Pradesh': ['Agra', 'Aligarh', 'Allahabad', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Aonla', 'Azamgarh', 'Badaun', 'Baghpat', 'Bahraich', 'Ballia', 'Banda', 'Bansgaon', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Bulandshahr', 'Chandauli', 'Deoria', 'Dhaurahra', 'Domariyaganj', 'Etah', 'Etawah', 'Faizabad', 'Farrukhabad', 'Fatehpur', 'Fatehpur Sikri', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Ghosi', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kairana', 'Kaiserganj', 'Kannauj', 'Kanpur', 'Kaushambi', 'Kheri', 'Kushi Nagar', 'Lalganj', 'Lucknow', 'Machhlishahr', 'Maharajganj', 'Mainpuri', 'Mathura', 'Meerut', 'Mirzapur', 'Misrikh', 'Mohanlalganj', 'Moradabad', 'Muzaffarnagar', 'Nagina', 'Phulpur', 'Pilibhit', 'Pratapgarh', 'Rae Bareli', 'Rampur', 'Robertsganj', 'Saharanpur', 'Salempur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shrawasti', 'Siddharthnagar', 'Sitapur', 'Sultanpur', 'Unnao', 'Varanasi'],
  'Uttarakhand': ['Almora', 'Garhwal', 'Haridwar', 'Nainital-Udhamsingh Nagar', 'Tehri Garhwal'],
  'West Bengal': ['Alipurduars', 'Arambagh', 'Asansol', 'Baharampur', 'Balurghat', 'Bangaon', 'Bankura', 'Barasat', 'Bardhaman Durgapur', 'Bardhaman Purba', 'Barrackpore', 'Basirhat', 'Birbhum', 'Bishnupur', 'Bolpur', 'Cooch Behar', 'Darjeeling', 'Diamond Harbour', 'Dum Dum', 'Ghatal', 'Hooghly', 'Howrah', 'Jadavpur', 'Jalpaiguri', 'Jangipur', 'Jaynagar', 'Jhargram', 'Kanthi', 'Kolkata Dakshin', 'Kolkata Uttar', 'Krishnanagar', 'Maldaha Dakshin', 'Maldaha Uttar', 'Mathurapur', 'Medinipur', 'Murshidabad', 'Purulia', 'Raiganj', 'Ranaghat', 'Sreerampur', 'Tamluk', 'Uluberia']
};

function format3LetterDate(dateStr?: string): string {
  if (!dateStr) return 'TBA';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'TBA';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function formatVotingSince(dateStr?: string): string {
  if (!dateStr) return '11 Oct 2026';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '11 Oct 2026';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (diffMonths >= 11) {
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  return `${d.getDate()} ${months[d.getMonth()]}`;
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
  const [dbgPoints, setDbgPoints] = useState<number>(() => {
    try {
      const saved = safeStorage.getItem('bhumat_dbg_balance');
      return saved !== null && !isNaN(Number(saved)) ? Number(saved) : 100;
    } catch (e) {
      return 100;
    }
  });
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
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
  const [votingSinceDate, setVotingSinceDate] = useState('2026-10-11');
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
        const verifiedDbg = data.dbg_balance !== undefined ? data.dbg_balance : 100;
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
        p_voter_token: token
      });
      if (mData?.success) {
        setMonthlyVotesCount(mData.monthly_votes ?? 0);
        setPrevMonthVotesCount(mData.prev_month_votes ?? 0);
        if (mData.earned_bonus) {
          alert('🎉 Congratulations! You reached 15 votes this month and unlocked +100 DBG!');
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
  // ... existing local storage reads ...
    try {
      const savedSeat = safeStorage.getItem('bhumat_user_seat');
      const savedState = safeStorage.getItem('bhumat_user_state');
      const savedCycles = safeStorage.getItem('bhumat_voted_cycles');
      const savedChoices = safeStorage.getItem('bhumat_voted_polls');
      const savedTimestamps = safeStorage.getItem('bhumat_vote_timestamps');
      if (savedSeat && savedState) {
        setSelectedSeat({ name: savedSeat, state: savedState });
        setIsConfirmed(true);
      }
      if (savedCycles) setVotedCycleKeys(JSON.parse(savedCycles));
      if (savedChoices) setSessionBallotChoices(JSON.parse(savedChoices));
      if (savedTimestamps) setVoteTimestamps(JSON.parse(savedTimestamps));
    } catch (e) {}

    // Register PWA Service Worker for native mobile install prompt
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
          current_cycle: d.current_cycle || '2026-10',
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
        const errMsg = error?.message || data?.error || 'Insufficient DBG balance';
        alert(lang === 'HI' ? `अंक कटौती विफल रही: ${errMsg}` : `Seat shift error: ${errMsg}`);
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
    } catch (e) {}
    syncWallet(deviceHash);
  };

  const getFrequencyRevoteMessage = (recurrence?: string) => {
    const rec = (recurrence || 'monthly').toLowerCase();
    if (rec.includes('day')) return 'You already voted for this seat. You can re-vote tomorrow.';
    if (rec.includes('week')) return 'You already voted for this seat. You can re-vote next week.';
    if (rec.includes('month')) return 'You already voted for this seat. You can re-vote next month.';
    return 'You already voted in this constituency.';
  };

  // --- SINGLE, ROBUST handleCastVote ---
  const handleCastVote = async (poll: Poll, optionIdx: number, e?: React.MouseEvent | React.TouchEvent) => {
    if (!selectedSeat) return;

    // --- 1. DIRECT & SYNCHRONOUS GUEST VERIFICATION CHECK ---
    const rawPhone = safeStorage.getItem('bhumat_user_phone');
    const isUserVerified = Boolean(
      (linkedPhone && linkedPhone.trim() !== '' && linkedPhone !== 'null' && linkedPhone !== 'undefined') ||
      (rawPhone && rawPhone.trim() !== '' && rawPhone !== 'null' && rawPhone !== 'undefined')
    );

    // Read directly from storage to eliminate closure lag
    const storedCountRaw = safeStorage.getItem('bhumat_guest_vote_count');
    const currentCount = storedCountRaw ? parseInt(storedCountRaw, 10) : guestVotesCast;

    if (!isUserVerified && currentCount >= 3) {
      showPointerToast('🔒 Guest quota reached (3/3). Signup to continue.', e);
      setIsAuthModalOpen(true);
      return;
    }

    const dynamicCycle = poll.participation_mode === 'recurring' ? getCurrentCycleId(poll.recurrence) : 'lifetime';
    
    // Strict Lock: Tied strictly to user's ballot on this poll for this cycle
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

    // --- 2. SYNCHRONOUS INCREMENT & NOTIFICATION ---
    if (!isUserVerified) {
      const nextCount = currentCount + 1;
      setGuestVotesCast(nextCount);
      safeStorage.setItem('bhumat_guest_vote_count', String(nextCount));

      const xpGained = poll.category === 'JanMat' ? '+40 XP' : '+30 XP';
      if (nextCount < 3) {
        showPointerToast(`✓ Ballot logged! ${xpGained} • Guest Ballot ${nextCount} of 3`, e);
      } else {
        showPointerToast(`✓ 3rd Guest Ballot Cast! Signup to lock your votes.`, e);
      }
    } else {
      const xpGained = poll.category === 'JanMat' ? '+40 XP' : '+30 XP';
      showPointerToast(`✓ Ballot logged for ${selectedSeat.name}! ${xpGained}`, e);
    }

    try {
      safeStorage.setItem('bhumat_voted_cycles', JSON.stringify(updatedKeys));
      safeStorage.setItem('bhumat_vote_timestamps', JSON.stringify(updatedTimestamps));
      safeStorage.setItem('bhumat_voted_polls', JSON.stringify(updatedChoices));
    } catch (err) {}

    // Record Seasonal Civic XP Gamification
    try {
      await supabase.rpc('record_vote_gamification', {
        p_voter_token: deviceHash,
        p_category: poll.category,
        p_state_name: selectedSeat.state,
        p_constituency_name: selectedSeat.name,
        p_season_id: '2026-10'
      });
      setProfileRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.warn('Gamification XP logging error:', err);
    }

    await supabase.rpc('cast_ballot_transaction', {
      p_poll_id: poll.id,
      p_cycle_id: dynamicCycle,
      p_voter_token: deviceHash,
      p_state_name: selectedSeat.state,
      p_constituency_name: selectedSeat.name,
      p_selected_option: optionIdx
    });
    // Check and award two-step milestone bonus (+100 DBG each for 1st JanMat and 1st LokMat)
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
    if (!pollSearchQuery.trim()) return polls;
    const q = pollSearchQuery.toLowerCase().trim();
    return polls.filter((p) =>
      p.title_en.toLowerCase().includes(q) ||
      p.title_hi.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [pollSearchQuery, polls]);

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
  <title>BhuMat - Bharat's Sovereign Public Opinion </title>
  <meta name="description" content="Sovereign consensus grid across 543 Lok Sabha seats. Vote on daily civic audits and cultural pulses." />
  <meta property="og:title" content="BhuMat - Bharat's Sovereign Public Opinion Engine" />
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
            maxWidth: '200px',
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

      {/* Sticky Top Header */}
      <header style={{ height: '56px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 40, width: '100%' }}>
        <div style={{ maxWidth: '460px', margin: '0 auto', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' }}>
            <span 
              onClick={handleBrandReset} 
              style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7', cursor: 'pointer' }}
              title="Reset & Go to Poll Feed"
            >
              BhuMat
            </span>
            <span style={{ fontSize: '9px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, cursor: 'default' }}>
              EARLY ACCESS
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
              onClick={(e) => triggerInfoPopup('Civic DBG Balance', 'Your sovereign credits. Earned by participation consistency & verified peer referrals. Used for constituency seat shifts.', e)}
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
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 14px 150px 14px' }}>
        
        {/* TAB 1: VOTE FEED */}
        {activeTab === 'vote' && (
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!isConfirmed ? (
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '28px 20px', width: '100%', boxSizing: 'border-box' }}>
                <span style={{ backgroundColor: '#fef3c7', color: '#d97706', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px' }}>
                  BHUMAT CITIZEN ENROLLMENT
                </span>
                <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '10px 0 4px 0' }}>Select Your Parliamentary Seat</h1>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
                  Select your Lok Sabha constituency across all 543 seats to unlock your sovereign ballot:
                </p>
                <div style={{ position: 'relative', width: '100%', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="🔍 Search seat (e.g. Nagpur, Banka, Buxar)..."
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
                  <option value="">-- Choose Parliamentary Seat (543) --</option>
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
                  Confirm & Enter {tentativeSeat?.name || ''}
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '14px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#059669', fontWeight: 800 }}>● Verified Lok Sabha</span>
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>{selectedSeat?.name} <span style={{ fontSize: '12px', color: '#64748b' }}>({selectedSeat?.state})</span></div>
                  </div>
                  <button
                    onClick={() => {
                      setTentativeSeat(null);
                      setSeatSearchInput('');
                      setIsChangeSeatModalOpen(true);
                    }}
                    style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', fontSize: '11px', padding: '6px 12px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Change Seat ({SEAT_CHANGE_COST_DBG} DBG)
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '4px', borderRadius: '12px' }}>
                  <button onClick={() => setPillarFilter('ALL')} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: pillarFilter === 'ALL' ? '#0f172a' : 'transparent', color: pillarFilter === 'ALL' ? '#ffffff' : '#64748b', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>All Feeds</button>
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
                  
                  const computedCardHeight = isFlipped
                    ? Math.max(680, 500 + optionCount * 44)
                    : Math.max(540, 360 + optionCount * 70);
                  return (
                    <div key={poll.id} style={{ perspective: '1200px', width: '100%', minHeight: `${computedCardHeight}px` }}>
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          minHeight: `${computedCardHeight}px`,
                          transition: 'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
                          transformStyle: 'preserve-3d',
                          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                        }}
                      >
                        {/* Front: Ballot View */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backfaceVisibility: 'hidden',
                            backgroundColor: '#ffffff',
                            border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                            borderRadius: '24px',
                            padding: '18px 18px 14px 18px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxSizing: 'border-box'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '28px', marginBottom: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="live-dot-animated" />
                                <span style={{ fontSize: '11px', fontWeight: 900, color: '#ef4444', letterSpacing: '0.04em', lineHeight: 1 }}>LIVE</span>
                                <span
                                  onClick={(e) => triggerInfoPopup(
                                    isJanMat ? 'JanMat Civic Audit' : 'LokMat Cultural Pulse',
                                    isJanMat
                                      ? 'Cryptographic Secret Ballot. Decoupled from your identity, zero voter tokens stored on your ballot.'
                                      : 'Open Civic Pulse. Choice attributed to your voter profile to reveal community cultural trends.',
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
                                  style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
                                >
                                  View Drishti ↺
                                </button>
                              )}
                            </div>
                            <h3 style={{ fontSize: '16.5px', fontWeight: 900, margin: '0 0 4px 0', lineHeight: 1.4, wordBreak: 'break-word', color: '#0f172a' }}>
                              {lang === 'EN' ? poll.title_en : poll.title_hi}
                            </h3>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.4, wordBreak: 'break-word', fontWeight: 500 }}>
                              {lang === 'EN' ? poll.title_hi : poll.title_en}
                            </p>
                            <div style={{ margin: '0 0 12px 0', maxWidth: '100%', boxSizing: 'border-box' }}>
                              <TickerTape activePoll={poll} lang={lang} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '14px' }}>
                              {poll.options.map((opt, idx) => {
                                const optColor = OPTION_PALETTE[idx % OPTION_PALETTE.length];
                                const isUserChoice = userChoiceIdx === idx;
                                const showChoiceTag = !isJanMat && isUserChoice && hasVotedThisCycle;
                                return (
                                  <button
                                    key={opt.id}
                                    onClick={(e) => handleCastVote(poll, idx, e)}
                                    style={{
                                      padding: '12px 14px',
                                      borderRadius: '13px',
                                      backgroundColor: showChoiceTag ? '#ecfdf5' : '#ffffff',
                                      border: showChoiceTag ? `2px solid ${optColor}` : `1.5px solid ${optColor}`,
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      width: '100%',
                                      boxSizing: 'border-box',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '3px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
                                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', flex: 1, wordBreak: 'break-word', lineHeight: 1.3 }}>
                                        {lang === 'EN' ? opt.text_en : opt.text_hi}
                                      </div>
                                      {showChoiceTag && (
                                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', backgroundColor: '#d1fae5', border: '1px solid #a7f3d0', padding: '2px 7px', borderRadius: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                          ✓ Your Vote
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748b', wordBreak: 'break-word', lineHeight: 1.3, fontWeight: 500 }}>
                                      {lang === 'EN' ? opt.text_hi : opt.text_en}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: 'auto' }}>
                            <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>{isJanMat ? '🔒 Cryptographic Secret Ballot' : '🗳️ Open Public Mat'}</span>
                            {hasVotedThisCycle && (
                              <button onClick={() => openExpandedView(poll)} style={{ background: isJanMat ? '#ecfdf5' : '#fffbeb', color: isJanMat ? '#059669' : '#d97706', border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`, padding: '7px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                                Explore Full Drishti ↗
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Back: Drishti State View */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                            backgroundColor: '#ffffff',
                            border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                            borderRadius: '24px',
                            padding: '18px 18px 14px 18px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxSizing: 'border-box'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '28px', marginBottom: '8px' }}>
                              <span className="drishti-active-chip" style={{ backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb', color: isJanMat ? '#059669' : '#d97706', fontSize: '10.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '999px', lineHeight: 1 }}>
                                ✓ DRISHTI MAT ACTIVE
                              </span>
                              <button onClick={() => setFlippedOverrides((prev) => ({ ...prev, [poll.id]: false }))} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '10.5px', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>
                                View Ballot ↻
                              </button>
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                              <h4 style={{ fontSize: '14.5px', fontWeight: 800, margin: 0, color: '#0f172a', lineHeight: 1.35 }}>
                                {lang === 'EN' ? poll.title_en : poll.title_hi}
                              </h4>
                            </div>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: poll.options.length <= 2 ? '1fr 1fr' : 'repeat(auto-fit, minmax(160px, 1fr))',
                                gap: '8px 10px',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                padding: '9px 11px',
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
                                      fontSize: '10.5px',
                                      fontWeight: 700,
                                      color: '#1e293b',
                                      lineHeight: 1.2
                                    }}
                                  >
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: optColor, flexShrink: 0 }} />
                                    <span style={{ wordBreak: 'break-word', flex: 1 }}>{optText}</span>
                                  </div>
                                );
                              })}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                                <span>⚖️</span>
                                <span>Split Mat (Tie)</span>
                              </div>
                            </div>
                            {isFlipped && (
                              <DrishtiMap
                                selectedConstituencyName={selectedSeat?.name}
                                selectedState={selectedSeat?.state}
                                pollId={poll.id}
                                userVotedOptionIdx={userChoiceIdx ?? null}
                                options={poll.options}
                                optimisticLocalVote={hasVotedThisCycle}
                              />
                            )}
                          </div>
                          <div style={{ width: '100%', marginTop: 'auto', paddingTop: '10px' }}>
                            <button onClick={() => openExpandedView(poll)} style={{ width: '100%', height: '42px', backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb', border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`, borderRadius: '11px', color: isJanMat ? '#059669' : '#d97706', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              Explore Full Drishti (543 Seats) 🔓
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

        {/* TAB 2: DEDICATED POLL SEARCH */}
        {activeTab === 'search' && (
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px' }}>
                  SOVEREIGN OPINION ARCHIVE
                </span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>
                  ● Live Sovereign Consensus
                </span>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '6px 0 12px 0' }}>Search Public Opinion Polls</h2>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="🔍 Search questions by topic or keyword..."
                  value={pollSearchQuery}
                  onChange={(e) => setPollSearchQuery(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 36px 12px 14px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none' }}
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
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {searchPollMatches.length === 0 ? (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                  No public opinion polls matching "{pollSearchQuery}".
                </div>
              ) : (
                searchPollMatches.map((poll) => (
                  <div
                    key={poll.id}
                    onClick={() => openExpandedView(poll)}
                    style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', cursor: 'pointer', transition: 'transform 0.15s ease' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: poll.category === 'JanMat' ? '#059669' : '#d97706', backgroundColor: poll.category === 'JanMat' ? '#ecfdf5' : '#fffbeb', padding: '2px 8px', borderRadius: '999px' }}>
                        ● {poll.category}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7' }}>View Drishti ❯</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '6px', lineHeight: 1.4 }}>
                      {lang === 'EN' ? poll.title_en : poll.title_hi}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SCHEDULE */}
        {activeTab === 'schedule' && (
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px' }}>
                  SEASON 10 • ACTIVE CYCLE
                </span>
                <span
                  onClick={(e) => triggerInfoPopup('12 Sovereign Seasons', 'BhuMat operates in 12 monthly consensus cycles per year. At the end of each season, final constituency tallies are archived.', e)}
                  style={{ fontSize: '11px', fontWeight: 700, color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>● 12 Seasons / Year</span>
                  <span style={{ fontSize: '10px', opacity: 0.6 }}>ⓘ</span>
                </span>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 900, margin: '4px 0 2px 0', color: '#0f172a' }}>
                Ashwin Mat Cycle (October 2026)
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                National ballots follow scheduled drops. Once cast, your vote is recorded in your Lok Sabha seat's tally for this cycle.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '2px 4px' }}>
                Daily Drop Rhythm
              </div>
              <div
                onClick={(e) => triggerInfoPopup('JanMat Drop Rationale', 'Published every evening at 8:00 PM. Features critical civic and policy audits using anonymous secret ballots.', e)}
                style={{ backgroundColor: '#ffffff', border: '1.5px solid #a7f3d0', borderRadius: '16px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                    🌆
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#064e3b' }}>08:00 PM Daily Drop</div>
                    <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600 }}>JanMat Civic Audit • Secret Ballot</div>
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 800 }}>Active ❯</span>
              </div>
              <div
                onClick={(e) => triggerInfoPopup('LokMat Drop Rationale', 'Published every morning at 8:00 AM. Covers public debates and sports/culture topics with transparent community profiles.', e)}
                style={{ backgroundColor: '#ffffff', border: '1.5px solid #fde68a', borderRadius: '16px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                    🌅
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#92400e' }}>08:00 AM Daily Drop</div>
                    <div style={{ fontSize: '11.5px', color: '#d97706', fontWeight: 600 }}>LokMat Cultural Pulse • Public Mat</div>
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 800 }}>Active ❯</span>
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>HOW CADENCE & REVOTING WORK</span>
                <span
                  onClick={(e) => triggerInfoPopup('Cadence Rules', 'Recurring polls refresh every day, week, or month. Re-voting allows you to update your position as real-world developments unfold.', e)}
                  style={{ fontSize: '11px', color: '#0284c7', cursor: 'pointer' }}
                >
                  ⓘ Info
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: '#64748b', lineHeight: 1.45 }}>
                <div>• <strong>Daily Mat:</strong> Re-vote unlocks every 24 hours at 8:00 AM / 8:00 PM.</div>
                <div>• <strong>Monthly Audits:</strong> Persist throughout the active season with historical trend preservation.</div>
                <div>• <strong>One-Ballot Lock:</strong> One vote per poll cycle. Shifting your seat locks previous cycle votes and applies only to future ballots.</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '2px 4px' }}>
                Upcoming Queue ({currentSeasonFuturePolls.length})
              </div>
              {currentSeasonFuturePolls.length === 0 ? (
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
                  ✓ All scheduled drops for this cycle are live in your Vote feed.
                </div>
              ) : (
                currentSeasonFuturePolls.map((item) => (
                  <div key={item.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: item.category === 'JanMat' ? '#059669' : '#d97706' }}>
                        ● {item.category}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', backgroundColor: '#f0f9ff', padding: '2px 8px', borderRadius: '6px' }}>
                        📅 {format3LetterDate(item.starts_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                      {item.title_en}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PROFILE */}
        {activeTab === 'profile' && (
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '22px', padding: '20px' }}>
              
              {/* Citizen Passport Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '19px', fontWeight: 900, color: '#0f172a' }}>{username}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 800, color: recognitionTier.color }}>
                      {recognitionTier.title}
                    </span>
                    <span
                      onClick={(e) => triggerInfoPopup('Civic Recognition', 'Your tier upgrades as you cast ballots consistently across monthly cycles. Higher tiers represent seasoned civic contributors.', e)}
                      style={{ fontSize: '10px', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      ⓘ
                    </span>
                  </div>
                </div>
                <span style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: '10.5px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px' }}>
                  ✓ Verified Citizen
                </span>
              </div>

              {/* Mobile Link / Verified Passport Banner */}
              <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '12px', backgroundColor: linkedPhone ? '#f0fdf4' : '#fffbeb', border: `1px solid ${linkedPhone ? '#bbf7d0' : '#fde68a'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: linkedPhone ? '#166534' : '#92400e' }}>
                    {linkedPhone 
                      ? `📱 Linked Mobile: +91 ******${linkedPhone.slice(-4)}` 
                      : `⚠️ Guest Citizen (${guestVotesCast}/3 Ballots Used)`}
                  </span>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    {linkedPhone 
                      ? 'Passport sync active across devices' 
                      : guestVotesCast >= 3 
                        ? 'Guest quota reached! Signup to continue voting' 
                        : `${3 - guestVotesCast} guest ballot${3 - guestVotesCast === 1 ? '' : 's'} remaining before mobile verification`}
                  </div>
                </div>
                {!linkedPhone && (
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    style={{ padding: '6px 12px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Link Phone
                  </button>
                )}
              </div>

              {/* DBG Civic Balance Card */}
              <div style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '16px', padding: '16px', marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>CIVIC CREDITS</span>
                    <span
                      onClick={(e) => triggerInfoPopup('Civic DBG Credits', 'DBG points are sovereign civic credits. They cannot be bought with money; they are earned by participation and peer invites. Shifting your parliamentary seat costs 100 DBG.', e)}
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
                  <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>Constituency Shift Fee</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>100 DBG / Shift</div>
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
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>Audit Ledger & DBG Receipts</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7' }}>
                    {isLedgerOpen ? 'Hide ▲' : 'View History ▼'}
                  </span>
                </div>
                {isLedgerOpen && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                    {ledgerEntries.length === 0 ? (
                      <div style={{ fontSize: '11.5px', color: '#64748b', textAlign: 'center', padding: '12px 0' }}>
                        No seat shifts or deductions recorded yet.
                      </div>
                    ) : (
                      ledgerEntries.map((tx) => (
                        <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#1e293b' }}>
                              {tx.description}
                            </span>
                            <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                              {new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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

              {/* Seasonal Citizen Leaderboard & Gamification Engine */}
              <div style={{ marginTop: '14px' }}>
                <LeaderboardView
                  userState={selectedSeat?.state || 'Bihar'}
                  userSeat={selectedSeat?.name || 'Karakat'}
                  voterToken={deviceHash}
                  refreshTrigger={profileRefreshKey}
                />
              </div>

              {/* Monthly Season Progress Bar */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '12px 14px', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800 }}>
                  <span style={{ color: '#475569' }}>October Goal (15 Ballots):</span>
                  <span style={{ color: displayMonthlyVotes >= 15 ? '#059669' : '#0284c7' }}>
                    {displayMonthlyVotes} / 15 ({displayMonthlyVotes >= 15 ? '✓ +100 DBG Claimed' : `${15 - displayMonthlyVotes} more to +100 DBG`})
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '999px', marginTop: '8px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.round((displayMonthlyVotes / 15) * 100))}%`, height: '100%', backgroundColor: displayMonthlyVotes >= 15 ? '#10b981' : '#0284c7', transition: 'width 0.4s ease' }} />
                </div>
              </div>

              {/* Sovereign Referral Card */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>INVITE CITIZENS TO BHUMAT</span>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#059669' }}>+100 DBG / Invite</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <span style={{ fontSize: '17px', fontWeight: 900, color: '#0284c7', letterSpacing: '0.08em' }}>{referralCode}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(referralCode);
                        alert('Referral code copied to clipboard!');
                      }}
                      style={{ padding: '6px 12px', backgroundColor: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => {
                        const msg = `🇮🇳 Join me on BhuMat — Bharat's Sovereign Public Opinion Grid! Use my code *${referralCode}* to claim 100 DBG credits:\nhttps://vote.bhumat.com?ref=${referralCode}`;
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      style={{ padding: '6px 12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Share
                    </button>
                  </div>
                </div>
              </div>

              {/* Ballot Box Ledger */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <div
                  onClick={(e) => triggerInfoPopup('JanMat Audits', 'Your total votes cast in anonymous cryptographic secret ballots.', e)}
                  style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#059669' }}>JanMat Audits ⓘ</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#064e3b', marginTop: '2px' }}>{janmatAuditsCount}</div>
                </div>
                <div
                  onClick={(e) => triggerInfoPopup('LokMat Pulses', 'Your total votes cast in open cultural and public sentiment polls.', e)}
                  style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#d97706' }}>LokMat Polls ⓘ</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#92400e', marginTop: '2px' }}>{lokmatPollsCount}</div>
                </div>
              </div>

              {/* Seat Details & Shift Trigger */}
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '14px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Active Lok Sabha Seat:</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{selectedSeat?.name || 'Unclaimed'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>State Jurisdiction:</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{selectedSeat?.state || 'Bharat'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Citizen Since:</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatVotingSince(votingSinceDate)}</span>
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
                🔄 Shift Parliamentary Seat (Costs 100 DBG)
              </button>
            </div>
          </div>
        )}
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
                SOVEREIGN RE-ENROLLMENT
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
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0' }}>Change Lok Sabha Seat</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0' }}>
              Changing your parliamentary seat costs <strong>100 DBG</strong>. Choose your new constituency below:
            </p>
            <div style={{ position: 'relative', width: '100%', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="🔍 Search seat (e.g. Nagpur, Banka, Buxar)..."
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
              <option value="">-- Choose New Parliamentary Seat (543) --</option>
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
                Cancel
              </button>
              <button
                disabled={!tentativeSeat || tentativeSeat.name === selectedSeat?.name}
                onClick={handleConfirmSeat}
                style={{ flex: 2, padding: '12px', backgroundColor: tentativeSeat && tentativeSeat.name !== selectedSeat?.name ? '#10b981' : '#cbd5e1', color: '#ffffff', fontWeight: 800, borderRadius: '10px', border: 'none', cursor: tentativeSeat && tentativeSeat.name !== selectedSeat?.name ? 'pointer' : 'not-allowed' }}
              >
                Confirm Shift ({SEAT_CHANGE_COST_DBG} DBG)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4-Tab Dock Navigation */}
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
            <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'search' ? 800 : 600, marginTop: '3px' }}>Search</span>
          </button>
          <button
            onClick={() => setActiveTab('vote')}
            style={{ flex: 1, background: 'none', border: 'none', color: activeTab === 'vote' ? '#10b981' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '19px', lineHeight: 1 }}>🗳️</span>
            <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'vote' ? 800 : 600, marginTop: '3px' }}>Vote</span>
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            style={{ flex: 1, background: 'none', border: 'none', color: activeTab === 'schedule' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>📅</span>
            <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'schedule' ? 800 : 600, marginTop: '3px' }}>Schedule</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('profile');
              syncWallet(deviceHash);
            }}
            style={{ flex: 1, background: 'none', border: 'none', color: activeTab === 'profile' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>👤</span>
            <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'profile' ? 800 : 600, marginTop: '3px' }}>Profile</span>
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