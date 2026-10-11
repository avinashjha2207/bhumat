'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { supabase, safeStorage } from './utils/supabaseClient';
import TickerTape from './TickerTape';
import { getCurrentCycleId } from './utils/cycleManager';

const DrishtiMap = dynamic(() => import('./DrishtiMap'), { ssr: false });
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

const VERIFIED_SEAT_DOSSIERS: Record<string, any> = {
  'banka': {
    pcCode: '27-BI',
    mpName: 'Giridhari Yadav',
    party: 'Janata Dal (United) / NDA',
    cases: 0,
    education: 'Post Graduate (M.A., LL.B.)',
    assets: '₹4.12 Crore',
    turnout: '54.48%',
    margin: '1,03,844 Votes',
    electors: '17,82,310 Electors',
    vidhanSabhaSegments: ['Sultanganj (157)', 'Amarpur (159)', 'Dhoraiya [SC] (160)', 'Banka (161)', 'Katoria [ST] (162)', 'Belhar (163)']
  },
  'buxar': {
    pcCode: '33-BI',
    mpName: 'Sudhakar Singh',
    party: 'Rashtriya Janata Dal (RJD)',
    cases: 2,
    education: 'Graduate (B.A.)',
    assets: '₹8.4 Crore',
    turnout: '57.2%',
    margin: '30,091 Votes',
    electors: '18,72,110 Electors',
    vidhanSabhaSegments: ['Brahmpur (199)', 'Buxar (200)', 'Dumraon (201)', 'Rajpur (202)', 'Ramgarh (203)', 'Dinara (210)']
  },
  'darbhanga': {
    pcCode: '14-BI',
    mpName: 'Gopal Jee Thakur',
    party: 'Bharatiya Janata Party (BJP)',
    cases: 0,
    education: 'Post Graduate (M.A.)',
    assets: '₹3.42 Crore',
    turnout: '58.31%',
    margin: '1,78,156 Votes',
    electors: '17,45,210 Electors',
    vidhanSabhaSegments: ['Gaura Bauram (79)', 'Benipur (80)', 'Alinagar (81)', 'Darbhanga Rural (82)', 'Darbhanga (83)', 'Bahadurpur (85)']
  },
  'muzaffarpur': {
    pcCode: '15-BI',
    mpName: 'Raj Bhushan Choudhary',
    party: 'Bharatiya Janata Party (BJP)',
    cases: 0,
    education: 'Post Graduate (M.D.)',
    assets: '₹9.82 Crore',
    turnout: '56.92%',
    margin: '2,34,927 Votes',
    electors: '18,45,210 Electors',
    vidhanSabhaSegments: ['Gaighat (88)', 'Aurai (89)', 'Bochahan (91)', 'Sakra (92)', 'Kurhani (93)', 'Muzaffarpur (94)']
  },
  'nagpur': {
    pcCode: '10-MH',
    mpName: 'Nitin Jairam Gadkari',
    party: 'Bharatiya Janata Party (BJP)',
    cases: 0,
    education: 'Post Graduate (M.Com, LL.B.)',
    assets: '₹28.0 Crore',
    turnout: '54.11%',
    margin: '1,37,603 Votes',
    electors: '22,23,550 Electors',
    vidhanSabhaSegments: ['Nagpur South West (52)', 'Nagpur South (53)', 'Nagpur East (54)', 'Nagpur Central (55)', 'Nagpur West (56)', 'Nagpur North [SC] (57)']
  },
  'gorakhpur': {
    pcCode: '64-UP',
    mpName: 'Ravi Kishan (Ravindra Shukla)',
    party: 'Bharatiya Janata Party (BJP)',
    cases: 1,
    education: 'Intermediate (12th Pass)',
    assets: '₹34.5 Crore',
    turnout: '54.98%',
    margin: '1,03,526 Votes',
    electors: '20,41,830 Electors',
    vidhanSabhaSegments: ['Caimpiyarganj (320)', 'Pipraich (321)', 'Gorakhpur Urban (322)', 'Gorakhpur Rural (323)', 'Sahajanwa (324)']
  }
};

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

function resolveConstituencyDossier(seatName: string, stateName: string) {
  const cleanKey = (seatName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (VERIFIED_SEAT_DOSSIERS[cleanKey]) return VERIFIED_SEAT_DOSSIERS[cleanKey];

  return {
    pcCode: `PC-${(stateName || 'IN').slice(0, 2).toUpperCase()}`,
    mpName: `Hon. Member of Parliament (${seatName})`,
    party: 'Electoral Commission of India Verified',
    cases: 0,
    education: 'Official Affidavit Record',
    assets: 'Affidavit Filed',
    turnout: 'Official Record',
    margin: 'Declared Margin',
    electors: 'Electors Enrolled',
    vidhanSabhaSegments: [`${seatName} Segment 1`, `${seatName} Segment 2`, `${seatName} Segment 3`]
  };
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
  const [activeTab, setActiveTab] = useState<'search' | 'dossier' | 'vote' | 'schedule' | 'profile'>('vote');
  const [lang, setLang] = useState<'EN' | 'HI'>('EN');
  const [pillarFilter, setPillarFilter] = useState<'ALL' | 'JanMat' | 'LokMat'>('ALL');

  const [toast, setToast] = useState<{ msg: string; x: number; y: number } | null>(null);
  const [expandedPoll, setExpandedPoll] = useState<Poll | null>(null);

  const [username] = useState('CitizenBharat');
  const [dbgPoints, setDbgPoints] = useState(100);
  const [referralCode, setReferralCode] = useState('BM78491');
  const [janmatAuditsCount, setJanmatAuditsCount] = useState(0);
  const [lokmatPollsCount, setLokmatPollsCount] = useState(0);
  const [totalVotesCount, setTotalVotesCount] = useState(0);
  const [deviceHash, setDeviceHash] = useState<string>('');
  const [votingSinceDate, setVotingSinceDate] = useState('11 Oct 2026');

  const [selectedSeat, setSelectedSeat] = useState<{ name: string; state: string } | null>(null);
  const [tentativeSeat, setTentativeSeat] = useState<{ name: string; state: string } | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [seatSearchInput, setSeatSearchInput] = useState('');

  const [inspectedSeatName, setInspectedSeatName] = useState('Banka');
  const [inspectedSeatState, setInspectedSeatState] = useState('Bihar');
  const [isInspectingFromSearch, setIsInspectingFromSearch] = useState(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [filterStatePill, setFilterStatePill] = useState<string>('ALL');

  const [polls, setPolls] = useState<Poll[]>([]);
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

  const handleBrandReset = () => {
    setExpandedPoll(null);
    setActiveTab('vote');
    setPillarFilter('ALL');
    setArchiveSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadPolls();
  };

  useEffect(() => {
    const handlePopState = () => {
      setExpandedPoll(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openExpandedView = (poll: Poll) => {
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
        setInspectedSeatName(savedSeat);
        setInspectedSeatState(savedState);
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

    if (isConfirmed && selectedSeat && selectedSeat.name !== seatToConfirm.name) {
      if (dbgPoints < SEAT_CHANGE_COST_DBG) {
        alert(lang === 'HI' ? `सीट बदलने के लिए ${SEAT_CHANGE_COST_DBG} DBG चाहिए। आपके पास ${dbgPoints} DBG हैं।` : `Changing seat costs ${SEAT_CHANGE_COST_DBG} DBG. You have ${dbgPoints} DBG.`);
        return;
      }

      const { data, error } = await supabase.rpc('deduct_seat_change_fee', {
        p_voter_token: deviceHash
      });

      if (error || !data?.success) {
        alert(lang === 'HI' ? 'अंक कटौती विफल रही।' : 'Failed to deduct DBG points.');
        return;
      }
      setDbgPoints(data.new_balance);
    }

    setSelectedSeat(seatToConfirm);
    setInspectedSeatName(seatToConfirm.name);
    setInspectedSeatState(seatToConfirm.state);
    setIsConfirmed(true);

    try {
      safeStorage.setItem('bhumat_user_seat', seatToConfirm.name);
      safeStorage.setItem('bhumat_user_state', seatToConfirm.state);
    } catch (e) {}
  };

  const getFrequencyRevoteMessage = (recurrence?: string) => {
    const rec = (recurrence || 'monthly').toLowerCase();
    if (rec.includes('day')) return 'You already voted. You can re-vote tomorrow.';
    if (rec.includes('week')) return 'You already voted. You can re-vote next week.';
    if (rec.includes('month')) return 'You already voted. You can re-vote next month.';
    return 'You already voted.';
  };

  const handleCastVote = async (poll: Poll, optionIdx: number, e?: React.MouseEvent | React.TouchEvent) => {
    if (!selectedSeat) return;

    const dynamicCycle = poll.participation_mode === 'recurring' ? getCurrentCycleId(poll.recurrence) : 'lifetime';
    const cycleVoteKey = `${poll.id}___${dynamicCycle}`;

    if (votedCycleKeys.includes(cycleVoteKey)) {
      showPointerToast(getFrequencyRevoteMessage(poll.recurrence), e);
      return;
    }

    const updatedKeys = [...votedCycleKeys, cycleVoteKey];
    setVotedCycleKeys(updatedKeys);

    const updatedChoices = { ...sessionBallotChoices, [poll.id]: optionIdx };
    setSessionBallotChoices(updatedChoices);

    const nowIso = new Date().toISOString();
    const updatedTimestamps = { ...voteTimestamps, [poll.id]: nowIso };
    setVoteTimestamps(updatedTimestamps);

    setTotalVotesCount((prev) => prev + 1);
    if (poll.category === 'JanMat') {
      setJanmatAuditsCount((prev) => prev + 1);
    } else {
      setLokmatPollsCount((prev) => prev + 1);
    }

    setFlippedOverrides((prev) => ({ ...prev, [poll.id]: true }));

    try {
      safeStorage.setItem('bhumat_voted_cycles', JSON.stringify(updatedKeys));
      safeStorage.setItem('bhumat_vote_timestamps', JSON.stringify(updatedTimestamps));
      if (poll.category === 'LokMat') {
        safeStorage.setItem('bhumat_voted_polls', JSON.stringify(updatedChoices));
      }
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

  const inspectedKyc = resolveConstituencyDossier(inspectedSeatName, inspectedSeatState);

  const liveAccessiblePolls = useMemo(() => {
    return polls.filter((p) => p.is_active && (pillarFilter === 'ALL' || p.category === pillarFilter));
  }, [polls, pillarFilter]);

  const allFlattenedSeats = useMemo(() => {
    const list: Array<{ name: string; state: string }> = [];
    Object.entries(GROUPED_PARLIAMENTARY_SEATS).forEach(([state, seats]) => {
      seats.forEach((seat) => list.push({ name: seat, state }));
    });
    return list;
  }, []);

  const searchResults = useMemo(() => {
    let list = allFlattenedSeats;
    if (filterStatePill !== 'ALL') {
      list = list.filter((s) => s.state.toLowerCase() === filterStatePill.toLowerCase());
    }
    if (!archiveSearchQuery.trim()) return list.slice(0, 35);
    const q = archiveSearchQuery.toLowerCase().trim();
    return list.filter((s) => s.name.toLowerCase().includes(q) || s.state.toLowerCase().includes(q)).slice(0, 40);
  }, [archiveSearchQuery, filterStatePill, allFlattenedSeats]);

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
    return allFlattenedSeats.filter((s) => s.name.toLowerCase().includes(q) || s.state.toLowerCase().includes(q)).slice(0, 5);
  }, [seatSearchInput, allFlattenedSeats, tentativeSeat]);

  if (!mounted) return null;

  if (expandedPoll) {
    return (
      <PollExpandedView
        poll={expandedPoll}
        userSeatName={selectedSeat?.name}
        userState={selectedSeat?.state}
        userVotedOptionIdx={sessionBallotChoices[expandedPoll.id] ?? null}
        lang={lang}
        onBack={closeExpandedView}
      />
    );
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
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

      {/* Header */}
      <header style={{ height: '56px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 40 }}>
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
          <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, color: '#b45309' }}>
            ⚡ {dbgPoints} DBG
          </div>
          <button onClick={() => setLang(lang === 'EN' ? 'HI' : 'EN')} style={{ border: 'none', backgroundColor: '#f1f5f9', fontWeight: 700, fontSize: '10px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}>
            {lang === 'EN' ? 'हिन्दी' : 'EN'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 14px 100px 14px' }}>
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

                <input
                  type="text"
                  placeholder="🔍 Search seat (e.g. Nagpur, Banka, Buxar)..."
                  value={seatSearchInput}
                  onChange={(e) => setSeatSearchInput(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px', marginBottom: '8px' }}
                />

                {quickSeatMatches.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                    {quickSeatMatches.map((m) => (
                      <span
                        key={m.name}
                        onClick={() => { setTentativeSeat({ name: m.name, state: m.state }); setSeatSearchInput(m.name); }}
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
                  <button onClick={() => setIsConfirmed(false)} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', fontSize: '11px', padding: '6px 12px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
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
                  const hasVotedThisCycle = votedCycleKeys.includes(`${poll.id}___${dynamicCycle}`);
                  const isFlipped = flippedOverrides[poll.id] !== undefined ? flippedOverrides[poll.id] : hasVotedThisCycle;
                  const userChoiceIdx = sessionBallotChoices[poll.id];

                  return (
                    <div key={poll.id} style={{ perspective: '1200px', width: '100%' }}>
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          transition: 'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
                          transformStyle: 'preserve-3d',
                          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                        }}
                      >
                        {/* Front: Ballot View */}
                        <div
                          style={{
                            backfaceVisibility: 'hidden',
                            backgroundColor: '#ffffff',
                            border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                            borderRadius: '24px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            boxSizing: 'border-box',
                            width: '100%'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="live-dot-animated" />
                              <span style={{ fontSize: '11px', fontWeight: 900, color: '#ef4444', letterSpacing: '0.04em' }}>LIVE</span>
                              <span style={{ backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb', color: isJanMat ? '#059669' : '#d97706', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px' }}>{poll.category}</span>
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

                          {/* Full Screen Bleed Sentimeter Ticker */}
                          <div style={{ margin: '4px 0 16px 0' }}>
                            <TickerTape activePoll={poll} lang={lang} />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
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
                            overflowY: 'auto'
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

                            <DrishtiMap
                              selectedConstituencyName={selectedSeat?.name}
                              selectedState={selectedSeat?.state}
                              pollId={poll.id}
                              userVotedOptionIdx={sessionBallotChoices[poll.id] ?? null}
                              options={poll.options}
                              optimisticLocalVote={hasVotedThisCycle}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                            <button onClick={() => openExpandedView(poll)} style={{ width: '100%', height: '46px', backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb', border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`, borderRadius: '12px', color: isJanMat ? '#059669' : '#d97706', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
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

        {/* TAB 2: SEARCH ARCHIVE */}
        {activeTab === 'search' && (
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px' }}>543 CONSTITUENCY ARCHIVE</span>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '8px 0 4px 0' }}>Sovereign Public Opinion Index</h2>
              <input
                type="text"
                placeholder="🔍 Search seat (e.g. Nagpur, Banka, Buxar)..."
                value={archiveSearchQuery}
                onChange={(e) => setArchiveSearchQuery(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none', margin: '10px 0' }}
              />
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                {['ALL', 'Bihar', 'Maharashtra', 'Delhi', 'Uttar Pradesh', 'Karnataka'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatePill(st)}
                    style={{ padding: '4px 10px', borderRadius: '8px', border: 'none', backgroundColor: filterStatePill === st ? '#0f172a' : '#f1f5f9', color: filterStatePill === st ? '#ffffff' : '#64748b', fontSize: '11px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {st === 'ALL' ? 'Pan-Bharat' : st}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {searchResults.map((seat) => (
                <div
                  key={seat.name}
                  onClick={() => {
                    setInspectedSeatName(seat.name);
                    setInspectedSeatState(seat.state);
                    setIsInspectingFromSearch(true);
                    setActiveTab('dossier');
                  }}
                  style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{seat.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{seat.state} • Lok Sabha Seat</div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7' }}>View Dossier ❯</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DOSSIER */}
        {activeTab === 'dossier' && (
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {isInspectingFromSearch && (
              <button onClick={() => { setIsInspectingFromSearch(false); setActiveTab('search'); }} style={{ alignSelf: 'flex-start', background: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                ← Back to 543 Search Archive
              </button>
            )}

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px' }}>
                  PARLIAMENTARY DOSSIER: {inspectedKyc.pcCode}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>● 18th Lok Sabha Certified</span>
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '8px 0 2px 0' }}>{inspectedSeatName} Parliamentary Constituency</h2>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>{inspectedSeatState} State Jurisdiction</div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', marginBottom: '14px' }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{inspectedKyc.mpName}</div>
                <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: 700, marginTop: '2px' }}>{inspectedKyc.party}</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', fontSize: '11.5px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Winning Margin:</span>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{inspectedKyc.margin}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Voter Turnout:</span>
                    <div style={{ fontWeight: 800, color: '#059669' }}>{inspectedKyc.turnout}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Assets Declared:</span>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{inspectedKyc.assets}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Criminal Cases:</span>
                    <div style={{ fontWeight: 800, color: inspectedKyc.cases > 0 ? '#dc2626' : '#059669' }}>
                      {inspectedKyc.cases} Listed
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Assembly Segments (Vidhan Sabha):</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {inspectedKyc.vidhanSabhaSegments.map((seg: string) => (
                    <span key={seg} style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                      {seg}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SCHEDULE */}
        {activeTab === 'schedule' && (
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px' }}>EDITORIAL TIMETABLE</span>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '8px 0 12px 0' }}>Public Opinion Drop Schedule</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ backgroundColor: '#ecfdf5', padding: '12px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>🌆 08:00 PM Daily</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#064e3b' }}>JanMat Audit</div>
                </div>
                <div style={{ backgroundColor: '#fffbeb', padding: '12px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#d97706' }}>🌅 08:00 AM Daily</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#92400e' }}>LokMat Debate</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {polls.filter((p) => p.is_active).map((item) => (
                <div key={item.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: item.category === 'JanMat' ? '#059669' : '#d97706' }}>● LIVE IN BALLOT FEED</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>{item.recurrence === 'lifetime' ? 'One-time' : item.recurrence}</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{item.title_en}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: PROFILE */}
        {activeTab === 'profile' && (
          <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{username}</div>
                  <div style={{ fontSize: '12px', color: '#059669', fontWeight: 700, marginTop: '2px' }}>● Verified Sovereign Citizen</div>
                </div>
                <span style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px' }}>
                  Verified Citizen
                </span>
              </div>

              <div style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '16px', padding: '16px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>Civic Balance</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#f59e0b' }}>{dbgPoints} DBG</div>
                </div>
                <div style={{ fontSize: '11px', color: '#38bdf8' }}>Seat Change: {SEAT_CHANGE_COST_DBG} DBG</div>
              </div>

              {/* Referral Widget */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px', marginTop: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Your Referral Code</div>
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
                        const msg = `🇮🇳 Join me on BhuMat — Bharat's Sovereign Public Opinion Grid! Use my code *${referralCode}* to claim your first 100 DBG points:\nhttps://vote.bhumat.com?ref=${referralCode}`;
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 6px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#64748b' }}>Total Votes</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{totalVotesCount}</div>
                </div>
                <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '10px 6px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#059669' }}>JanMat Audits</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#064e3b', marginTop: '2px' }}>{janmatAuditsCount}</div>
                </div>
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '10px 6px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#d97706' }}>LokMat Polls</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#92400e', marginTop: '2px' }}>{lokmatPollsCount}</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '14px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Claimed Constituency:</span>
                  <span style={{ fontWeight: 800 }}>{selectedSeat?.name || 'Unclaimed'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>State Jurisdiction:</span>
                  <span style={{ fontWeight: 800 }}>{selectedSeat?.state || 'Bharat'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Voting Since:</span>
                  <span style={{ fontWeight: 800 }}>{votingSinceDate}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsConfirmed(false);
                  setActiveTab('vote');
                }}
                style={{ width: '100%', marginTop: '14px', padding: '12px', borderRadius: '12px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
              >
                Change Lok Sabha ({SEAT_CHANGE_COST_DBG} DBG)
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Dock Navigation */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '60px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 50 }}>
        <button onClick={() => setActiveTab('search')} style={{ background: 'none', border: 'none', color: activeTab === 'search' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: '18px' }}>🔍</span>
          <span style={{ fontSize: '10px', fontWeight: 700 }}>Search</span>
        </button>
        <button onClick={() => setActiveTab('dossier')} style={{ background: 'none', border: 'none', color: activeTab === 'dossier' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: '18px' }}>📋</span>
          <span style={{ fontSize: '10px', fontWeight: 700 }}>Dossier</span>
        </button>
        <button onClick={() => setActiveTab('vote')} style={{ background: 'none', border: 'none', color: activeTab === 'vote' ? '#10b981' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px' }}>🗳️</span>
          <span style={{ fontSize: '10px', fontWeight: 800 }}>Vote</span>
        </button>
        <button onClick={() => setActiveTab('schedule')} style={{ background: 'none', border: 'none', color: activeTab === 'schedule' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: '18px' }}>📅</span>
          <span style={{ fontSize: '10px', fontWeight: 700 }}>Schedule</span>
        </button>
        <button onClick={() => setActiveTab('profile')} style={{ background: 'none', border: 'none', color: activeTab === 'profile' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: '18px' }}>👤</span>
          <span style={{ fontSize: '10px', fontWeight: 700 }}>Profile</span>
        </button>
      </nav>
    </div>
  );
}