'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { supabase, safeStorage } from './utils/supabaseClient';
import TickerTape from './TickerTape';
import { getCurrentCycleId } from './utils/cycleManager';

const DrishtiMap = dynamic(() => import('./DrishtiMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '260px', backgroundColor: '#f1f5f9', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
      Loading sovereign map vector...
    </div>
  )
});

const PollExpandedView = dynamic(() => import('./PollExpandedView'), { ssr: false });

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
  const [expandedPoll, setExpandedPoll] = useState<Poll | null>(null);

  const [username] = useState('CitizenBharat');
  const [dbgPoints, setDbgPoints] = useState(100);
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
    const rect = e.currentTarget.getBoundingClientRect();
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 360;
    const clampedX = Math.max(16, Math.min(rect.left - 80, screenW - 250));
    const clampedY = Math.max(70, rect.bottom + 8);

    setActiveTooltip({ title, desc, x: clampedX, y: clampedY });
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
      const { data, error } = await supabase.rpc('get_or_create_voter_wallet', {
        p_voter_token: token
      });
      if (data && !error && data.success) {
        setDbgPoints(data.dbg_balance ?? 100);
        setReferralCode(data.referral_code ?? 'BM78491');
        setTotalVotesCount(data.total_votes ?? 0);
        setJanmatAuditsCount(data.janmat_votes ?? 0);
        setLokmatPollsCount(data.lokmat_votes ?? 0);
        if (data.voting_since) setVotingSinceDate(data.voting_since);
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
      const { data, error } = await supabase.rpc('deduct_seat_change_fee', {
        p_voter_token: deviceHash
      });

      if (error || !data?.success) {
        alert(lang === 'HI' ? 'अंक कटौती विफल रही।' : 'Failed to deduct DBG points.');
        return;
      }
      setDbgPoints(data.new_balance ?? Math.max(0, dbgPoints - SEAT_CHANGE_COST_DBG));
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

  const handleCastVote = async (poll: Poll, optionIdx: number, e?: React.MouseEvent | React.TouchEvent) => {
    if (!selectedSeat) return;

    const dynamicCycle = poll.participation_mode === 'recurring' ? getCurrentCycleId(poll.recurrence) : 'lifetime';
    const seatSlug = selectedSeat.name.toLowerCase().trim();
    
    const scopedCycleVoteKey = `${poll.id}___${dynamicCycle}___${seatSlug}`;
    const scopedChoiceKey = `${poll.id}___${seatSlug}`;

    if (votedCycleKeys.includes(scopedCycleVoteKey)) {
      showPointerToast(getFrequencyRevoteMessage(poll.recurrence), e);
      return;
    }

    const updatedKeys = [...votedCycleKeys, scopedCycleVoteKey];
    setVotedCycleKeys(updatedKeys);

    const updatedChoices = { ...sessionBallotChoices, [scopedChoiceKey]: optionIdx };
    setSessionBallotChoices(updatedChoices);

    const nowIso = new Date().toISOString();
    const updatedTimestamps = { ...voteTimestamps, [scopedChoiceKey]: nowIso };
    setVoteTimestamps(updatedTimestamps);

    setTotalVotesCount((prev) => prev + 1);
    setMonthlyVotesCount((prev) => prev + 1);
    if (poll.category === 'JanMat') {
      setJanmatAuditsCount((prev) => prev + 1);
    } else {
      setLokmatPollsCount((prev) => prev + 1);
    }

    setFlippedOverrides((prev) => ({ ...prev, [poll.id]: true }));

    try {
      safeStorage.setItem('bhumat_voted_cycles', JSON.stringify(updatedKeys));
      safeStorage.setItem('bhumat_vote_timestamps', JSON.stringify(updatedTimestamps));
      safeStorage.setItem('bhumat_voted_polls', JSON.stringify(updatedChoices));
    } catch (err) {}

    await supabase.rpc('cast_ballot_transaction', {
      p_poll_id: poll.id,
      p_cycle_id: dynamicCycle,
      p_voter_token: deviceHash,
      p_state_name: selectedSeat.state,
      p_constituency_name: selectedSeat.name,
      p_selected_option: optionIdx
    });

    syncWallet(deviceHash);
  };

  const liveAccessiblePolls = useMemo(() => {
    return polls.filter((p) => p.is_active && (pillarFilter === 'ALL' || p.category === pillarFilter));
  }, [polls, pillarFilter]);

  const currentSeasonFuturePolls = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return polls.filter((p) => {
      if (!p.starts_at) return false;
      const d = new Date(p.starts_at);
      const isCurrentSeason = d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      return isCurrentSeason && d.getTime() > now.getTime();
    });
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

  const formatRecurrenceBadge = (recurrence?: string) => {
    const r = (recurrence || 'monthly').toLowerCase();
    if (r === 'lifetime' || r === 'one_time') return 'One-time';
    if (r.includes('day')) return 'Daily';
    if (r.includes('week')) return 'Weekly';
    if (r.includes('quarter')) return 'Quarterly';
    if (r.includes('year')) return 'Yearly';
    return 'Monthly';
  };

  const recognitionTier = resolveCivicRecognitionTier(prevMonthVotesCount);
  const displayMonthlyVotes = Math.max(monthlyVotesCount, totalVotesCount);

  if (!mounted) return null;

  if (expandedPoll) {
    const currentSeatSlug = selectedSeat?.name.toLowerCase().trim() || '';
    const scopedUserChoice = sessionBallotChoices[`${expandedPoll.id}___${currentSeatSlug}`] ?? null;

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
        <title>BhuMat — Bharat's Sovereign Public Opinion Grid</title>
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

        @keyframes pulseBreathing {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
        .seat-beacon-glowing-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background-color: #10b981;
          display: inline-block;
          animation: pulseBreathing 2.2s infinite ease-in-out;
        }
      `}</style>

      {/* Floating Pointer-Attached Toast */}
      {toast && (
        <div style={{ position: 'fixed', left: `${toast.x}px`, top: `${toast.y}px`, transform: 'translate(-50%, -100%)', zIndex: 120, backgroundColor: '#0f172a', color: '#ffffff', padding: '8px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, pointerEvents: 'none' }}>
          {toast.msg}
        </div>
      )}

      {/* Explanation Popup */}
      {activeTooltip && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
            zIndex: 130,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '12px 14px',
            borderRadius: '12px',
            maxWidth: '240px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
            border: '1px solid #334155'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8', marginBottom: '4px' }}>
            {activeTooltip.title}
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.45 }}>
            {activeTooltip.desc}
          </div>
        </div>
      )}

      {/* Centered Top Header */}
      <header style={{ height: '56px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 12px' }}>
        <div style={{ width: '100%', maxWidth: '460px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            onClick={handleBrandReset}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}
            title="Reset & Go to Poll Feed"
          >
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7' }}>BhuMat</span>
            <span style={{ fontSize: '9px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>EARLY ACCESS</span>
            {selectedSeat && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '999px', fontSize: '11px' }}>
                <span className="seat-beacon-glowing-dot" />
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
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 14px 110px 14px' }}>
        
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
                  
                  const currentSeatSlug = (selectedSeat?.name || '').toLowerCase().trim();
                  const scopedVoteCycleKey = `${poll.id}___${dynamicCycle}___${currentSeatSlug}`;
                  const scopedChoiceKey = `${poll.id}___${currentSeatSlug}`;

                  const hasVotedThisCycle = votedCycleKeys.includes(scopedVoteCycleKey);
                  const isFlipped = flippedOverrides[poll.id] !== undefined ? flippedOverrides[poll.id] : hasVotedThisCycle;
                  const userChoiceIdx = sessionBallotChoices[scopedChoiceKey];

                  const optionCount = poll.options.length;
                  const computedCardHeight = Math.max(590, 420 + optionCount * 62);

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
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxSizing: 'border-box'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="live-dot-animated" />
                                <span style={{ fontSize: '11px', fontWeight: 900, color: '#ef4444', letterSpacing: '0.04em' }}>LIVE</span>
                                <span
                                  onClick={(e) => triggerInfoPopup(
                                    isJanMat ? 'JanMat Civic Audit' : 'LokMat Cultural Pulse',
                                    isJanMat
                                      ? 'Cryptographic Secret Ballot. Decoupled from your identity, zero voter tokens stored on your ballot.'
                                      : 'Open Civic Pulse. Choice attributed to your voter profile to reveal community cultural trends.',
                                    e
                                  )}
                                  style={{ backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb', color: isJanMat ? '#059669' : '#d97706', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <span>{poll.category}</span>
                                  <span style={{ fontSize: '9px', opacity: 0.6 }}>ⓘ</span>
                                </span>
                              </div>
                              {hasVotedThisCycle && (
                                <button onClick={() => setFlippedOverrides((prev) => ({ ...prev, [poll.id]: true }))} style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                  View Drishti ↺
                                </button>
                              )}
                            </div>

                            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 6px 0', lineHeight: 1.45, wordBreak: 'break-word' }}>
                              {lang === 'EN' ? poll.title_en : poll.title_hi}
                            </h3>
                            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px 0', lineHeight: 1.5, wordBreak: 'break-word' }}>
                              {lang === 'EN' ? poll.title_hi : poll.title_en}
                            </p>

                            <div style={{ margin: '4px 0 14px 0', maxWidth: '100%', boxSizing: 'border-box' }}>
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
                                      borderRadius: '14px',
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
                                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', flex: 1, wordBreak: 'break-word', lineHeight: 1.35 }}>
                                        {lang === 'EN' ? opt.text_en : opt.text_hi}
                                      </div>
                                      {showChoiceTag && (
                                        <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#059669', backgroundColor: '#d1fae5', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                          ✓ Your Vote
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '11.5px', color: '#64748b', wordBreak: 'break-word', lineHeight: 1.4 }}>
                                      {lang === 'EN' ? opt.text_hi : opt.text_en}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>{isJanMat ? '🔒 Cryptographic Secret Ballot' : '🗳️ Open Public Mat'}</span>
                            {hasVotedThisCycle && (
                              <button onClick={() => openExpandedView(poll)} style={{ background: isJanMat ? '#ecfdf5' : '#fffbeb', color: isJanMat ? '#059669' : '#d97706', border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`, padding: '8px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}>
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
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxSizing: 'border-box',
                            overflow: 'hidden'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span className="drishti-active-chip" style={{ backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb', color: isJanMat ? '#059669' : '#d97706', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '999px' }}>
                                ✓ DRISHTI MAT ACTIVE
                              </span>
                              <button onClick={() => setFlippedOverrides((prev) => ({ ...prev, [poll.id]: false }))} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '11px', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                                View Ballot ↻
                              </button>
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

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                            <button onClick={() => openExpandedView(poll)} style={{ width: '100%', height: '44px', backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb', border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`, borderRadius: '12px', color: isJanMat ? '#059669' : '#d97706', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
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

            {/* Poll Results List */}
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
            <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #0284c7', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 12px rgba(2,132,199,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px' }}>
                  SEASON 10 • ACTIVE CYCLE
                </span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>● 12 Sovereign Seasons / Year</span>
              </div>
              <h2 style={{ fontSize: '19px', fontWeight: 900, margin: '8px 0 4px 0', color: '#0f172a' }}>Ashwin Mat Cycle (October 2026)</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0' }}>
                Upcoming public opinion drops for the current month. Recurring polls unlock daily/weekly rhythms across all 543 seats.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ backgroundColor: '#ecfdf5', padding: '12px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>🌆 08:00 PM Daily</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#064e3b' }}>JanMat Audit Drop</div>
                </div>
                <div style={{ backgroundColor: '#fffbeb', padding: '12px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#d97706' }}>🌅 08:00 AM Daily</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#92400e' }}>LokMat Debate Drop</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', margin: '4px 2px' }}>
                Scheduled Drops This Season ({currentSeasonFuturePolls.length}):
              </div>

              {currentSeasonFuturePolls.length === 0 ? (
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  All scheduled drops for this season are currently live in the ballot feed!
                </div>
              ) : (
                currentSeasonFuturePolls.map((item) => (
                  <div key={item.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: item.category === 'JanMat' ? '#059669' : '#d97706' }}>
                        ● {item.category}
                      </span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '6px' }}>
                          📅 {format3LetterDate(item.starts_at)}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                          {formatRecurrenceBadge(item.recurrence)}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginTop: '6px', lineHeight: 1.4 }}>
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
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '24px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{username}</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: recognitionTier.color, marginTop: '2px' }}>
                    {recognitionTier.title}
                  </div>
                </div>
                <span style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px' }}>
                  Verified Citizen
                </span>
              </div>

              {/* Monthly Season Progress Bar */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '12px 14px', marginTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800 }}>
                  <span style={{ color: '#475569' }}>October Civic Goal (15 Votes Milestone):</span>
                  <span style={{ color: displayMonthlyVotes >= 15 ? '#059669' : '#0284c7' }}>
                    {displayMonthlyVotes} / 15 Votes ({displayMonthlyVotes >= 15 ? '✓ Unlocked +100 DBG' : `${15 - displayMonthlyVotes} to +100 DBG`})
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '999px', marginTop: '8px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.round((displayMonthlyVotes / 15) * 100))}%`, height: '100%', backgroundColor: displayMonthlyVotes >= 15 ? '#10b981' : '#0284c7', transition: 'width 0.4s ease' }} />
                </div>
              </div>

              {/* DBG Wallet Card */}
              <div style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '16px', padding: '16px', marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>Civic Balance</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#f59e0b' }}>{dbgPoints} DBG</div>
                </div>
                <div style={{ fontSize: '11px', color: '#38bdf8' }}>Seat Change: {SEAT_CHANGE_COST_DBG} DBG</div>
              </div>

              {/* Referral Code */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px', marginTop: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Your Sovereign Referral Code</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: '#0284c7', letterSpacing: '0.08em' }}>{referralCode}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(referralCode);
                        alert('Referral code copied!');
                      }}
                      style={{ padding: '6px 12px', backgroundColor: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => {
                        const msg = `🇮🇳 Join me on BhuMat — Bharat's Sovereign Public Opinion Grid! Use my referral code *${referralCode}* to claim your first 100 DBG points:\nhttps://vote.bhumat.com?ref=${referralCode}`;
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      style={{ padding: '6px 12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Share
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
                  Earn up to 100 DBG per friend (50 DBG on their 1st LokMat vote + 50 DBG on their 1st JanMat vote).
                </div>
              </div>

              {/* Account Ledger */}
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '14px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Voting Since:</span>
                  <span style={{ fontWeight: 800 }}>{formatVotingSince(votingSinceDate)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Total Ballots Cast:</span>
                  <span style={{ fontWeight: 900, color: '#0284c7' }}>{totalVotesCount} Ballots</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                  <span style={{ color: '#64748b' }}>Claimed Constituency:</span>
                  <span style={{ fontWeight: 800 }}>{selectedSeat?.name || 'Unclaimed'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>State Jurisdiction:</span>
                  <span style={{ fontWeight: 800 }}>{selectedSeat?.state || 'Bharat'}</span>
                </div>
              </div>

              {/* Counts */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '14px' }}>
                <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#059669' }}>JanMat Audits</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#064e3b', marginTop: '2px' }}>{janmatAuditsCount}</div>
                </div>
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#d97706' }}>LokMat Polls</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#92400e', marginTop: '2px' }}>{lokmatPollsCount}</div>
                </div>
              </div>

              <button
                onClick={() => {
                  setTentativeSeat(null);
                  setSeatSearchInput('');
                  setIsChangeSeatModalOpen(true);
                }}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1.5px solid #0284c7',
                  backgroundColor: '#f0f9ff',
                  color: '#0369a1',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                🔄 Change Lok Sabha Constituency ({SEAT_CHANGE_COST_DBG} DBG)
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

      {/* Centered Bottom Dock Navigation */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '62px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 50,
          padding: '0 8px',
          paddingBottom: 'env(safe-area-inset-bottom, 6px)',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ width: '100%', maxWidth: '460px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            onClick={() => setActiveTab('profile')}
            style={{ flex: 1, background: 'none', border: 'none', color: activeTab === 'profile' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>👤</span>
            <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'profile' ? 800 : 600, marginTop: '3px' }}>Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}