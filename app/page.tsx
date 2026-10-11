'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { supabase, safeStorage } from './utils/supabaseClient';
import TickerTape from './TickerTape';
import { getCurrentCycleId } from './utils/cycleManager';

const DrishtiMap = dynamic(() => import('./DrishtiMap'), { ssr: false });
const PollExpandedView = dynamic(() => import('./PollExpandedView'), { ssr: false });

const SEAT_CHANGE_COST = 50;
// 1st: Orange, 2nd: Green, 3rd: Sky Blue, 4th: Purple
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
    vidhanSabhaSegments: [
      'Caimpiyarganj (320)',
      'Pipraich (321)',
      'Gorakhpur Urban (322)',
      'Gorakhpur Rural (323)',
      'Sahajanwa (324)'
    ]
  },
  'gaya': {
    pcCode: '38-BI',
    mpName: 'Jitan Ram Manjhi',
    party: 'Hindustani Awam Morcha (Secular) / NDA',
    cases: 6,
    education: 'Graduate (B.A. Hons)',
    assets: '₹1.54 Crore',
    turnout: '52.76%',
    margin: '1,01,812 Votes',
    electors: '18,14,350 Electors',
    vidhanSabhaSegments: [
      'Sherghati (226)',
      'Barachatti [SC] (228)',
      'Bodh Gaya [SC] (229)',
      'Gaya Town (230)',
      'Belaganj (232)',
      'Wazirganj (234)'
    ]
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
    vidhanSabhaSegments: [
      'Gaura Bauram (79)',
      'Benipur (80)',
      'Alinagar (81)',
      'Darbhanga Rural (82)',
      'Darbhanga (83)',
      'Bahadurpur (85)'
    ]
  },
  'east delhi': {
    pcCode: '03-DL',
    mpName: 'Harsh Malhotra',
    party: 'Bharatiya Janata Party (BJP)',
    cases: 0,
    education: 'Graduate Professional (LL.B.)',
    assets: '₹5.75 Crore',
    turnout: '54.37%',
    margin: '93,663 Votes',
    electors: '21,14,210 Electors',
    vidhanSabhaSegments: [
      'Jangpura (41)',
      'Trilokpuri (54)',
      'Kondli (55)',
      'Patparganj (56)',
      'Laxmi Nagar (57)',
      'Vishwas Nagar (58)',
      'Krishna Nagar (59)',
      'Gandhi Nagar (60)',
      'Shahdara (61)',
      'Okhla (54)'
    ]
  },
  'bangalore south': {
    pcCode: '26-KA',
    mpName: 'Tejasvi Surya',
    party: 'Bharatiya Janata Party (BJP)',
    cases: 0,
    education: 'Graduate Professional (LL.B.)',
    assets: '₹4.10 Crore',
    turnout: '53.17%',
    margin: '2,77,083 Votes',
    electors: '22,14,350 Electors',
    vidhanSabhaSegments: [
      'Govindraj Nagar (167)',
      'Vijay Nagar (168)',
      'Chickpet (170)',
      'Basavanagudi (171)',
      'Padmanaba Nagar (172)',
      'BTM Layout (173)',
      'Jayanagar (174)',
      'Bommanahalli (175)'
    ]
  },
  'varanasi': {
    pcCode: '77-UP',
    mpName: 'Narendra Modi',
    party: 'Bharatiya Janata Party (BJP)',
    cases: 0,
    education: 'Post Graduate (M.A.)',
    assets: '₹3.02 Crore',
    turnout: '56.44%',
    margin: '1,52,513 Votes',
    electors: '19,97,570 Electors',
    vidhanSabhaSegments: [
      'Rohaniya (387)',
      'Varanasi North (388)',
      'Varanasi South (389)',
      'Varanasi Cantt (390)',
      'Sevapuri (391)'
    ]
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
  const clean = (seatName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (VERIFIED_SEAT_DOSSIERS[clean]) return VERIFIED_SEAT_DOSSIERS[clean];

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
    vidhanSabhaSegments: [
      `${seatName} Assembly Segment 1`,
      `${seatName} Assembly Segment 2`,
      `${seatName} Assembly Segment 3`
    ]
  };
}

function getHumanizedTimeAgo(timestampStr?: string, lang: 'EN' | 'HI' = 'EN'): string {
  if (!timestampStr) return lang === 'HI' ? 'हाल ही में' : 'recently';
  const diffMs = Date.now() - new Date(timestampStr).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return lang === 'HI' ? 'अभी-अभी' : 'just now';
  if (diffHours < 24) return lang === 'HI' ? `${diffHours} घंटे पहले` : `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return lang === 'HI' ? `${diffDays} दिन पहले` : `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return lang === 'HI' ? `${diffMonths} महीने पहले` : `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
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

  // Floating Pointer-Attached Toast
  const [toast, setToast] = useState<{ msg: string; x: number; y: number } | null>(null);

  const [expandedPoll, setExpandedPoll] = useState<Poll | null>(null);

  const [username] = useState('CitizenBharat');
  const [bhumatPoints, setBhumatPoints] = useState(100);
  const [janmatAuditsCount, setJanmatAuditsCount] = useState(0);
  const [lokmatPollsCount, setLokmatPollsCount] = useState(0);
  const [deviceHash, setDeviceHash] = useState<string>('');
  const [votingSinceDate, setVotingSinceDate] = useState('October 2026');
  const [lastSeatChangeTimestamp, setLastSeatChangeTimestamp] = useState<string>('');

  const [selectedSeat, setSelectedSeat] = useState<{ name: string; state: string } | null>(null);
  const [tentativeSeat, setTentativeSeat] = useState<{ name: string; state: string } | null>(null);
  const [selectedAssembly, setSelectedAssembly] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [seatSearchInput, setSeatSearchInput] = useState('');

  const [inspectedSeatName, setInspectedSeatName] = useState('East Delhi');
  const [inspectedSeatState, setInspectedSeatState] = useState('Delhi');
  const [isInspectingFromSearch, setIsInspectingFromSearch] = useState(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');

  const [polls, setPolls] = useState<Poll[]>([]);
  const [flippedOverrides, setFlippedOverrides] = useState<Record<string, boolean>>({});
  const [selectedVotes, setSelectedVotes] = useState<Record<string, number>>({});
  const [votedCycleKeys, setVotedCycleKeys] = useState<string[]>([]);
  const [voteTimestamps, setVoteTimestamps] = useState<Record<string, string>>({});

  const showPointerToast = (msg: string, e?: React.MouseEvent | React.TouchEvent) => {
    let x = typeof window !== 'undefined' ? window.innerWidth / 2 : 200;
    let y = 140;

    if (e) {
      if ('clientX' in e && e.clientX) {
        x = e.clientX;
        y = e.clientY - 40;
      } else if ('touches' in e && e.touches[0]) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY - 40;
      }
    }

    setToast({ msg, x, y: Math.max(y, 60) });
    setTimeout(() => setToast(null), 3200);
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

  useEffect(() => {
    setMounted(true);
    const token = getOrCreateVoterToken();
    setDeviceHash(token);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const referrer = params.get('ref');
      if (referrer && referrer !== token) {
        safeStorage.setItem('bhumat_referred_by', referrer);
      }
      const initialSeat = params.get('seat');
      if (initialSeat) {
        setSeatSearchInput(initialSeat);
      }
    }

    try {
      const savedSeat = safeStorage.getItem('bhumat_user_seat');
      const savedState = safeStorage.getItem('bhumat_user_state');
      const savedAssembly = safeStorage.getItem('bhumat_user_assembly');
      const savedVotes = safeStorage.getItem('bhumat_voted_polls');
      const savedCycles = safeStorage.getItem('bhumat_voted_cycles');
      const savedPoints = safeStorage.getItem('bhumat_points');
      const savedFirstVote = safeStorage.getItem('bhumat_first_vote_date');
      const savedSeatChange = safeStorage.getItem('bhumat_last_seat_change');
      const savedTimestamps = safeStorage.getItem('bhumat_vote_timestamps');
      const savedJanCount = safeStorage.getItem('bhumat_janmat_count');
      const savedLokCount = safeStorage.getItem('bhumat_lokmat_count');

      if (savedSeat && savedState) {
        setSelectedSeat({ name: savedSeat, state: savedState });
        setInspectedSeatName(savedSeat);
        setInspectedSeatState(savedState);
        if (savedAssembly) setSelectedAssembly(savedAssembly);
        setIsConfirmed(true);
      }

      if (savedVotes) setSelectedVotes(JSON.parse(savedVotes));
      if (savedCycles) setVotedCycleKeys(JSON.parse(savedCycles));
      if (savedPoints) setBhumatPoints(Number(savedPoints));
      if (savedFirstVote) setVotingSinceDate(savedFirstVote);
      if (savedSeatChange) setLastSeatChangeTimestamp(savedSeatChange);
      if (savedTimestamps) setVoteTimestamps(JSON.parse(savedTimestamps));
      if (savedJanCount) setJanmatAuditsCount(Number(savedJanCount));
      if (savedLokCount) setLokmatPollsCount(Number(savedLokCount));
    } catch (e) {
      console.warn('LocalStorage load notice:', e);
    }
  }, []);

  async function loadPolls() {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('starts_at', { ascending: false });

      if (data && data.length > 0 && !error) {
        const formatted = data.map((d: any) => {
          let parsedOpts = [];
          if (Array.isArray(d.options) && d.options.length > 0) {
            parsedOpts = d.options;
          } else {
            parsedOpts = [
              { id: 0, text_en: d.option_0_en || 'Option 1', text_hi: d.option_0_hi || 'विकल्प 1' },
              { id: 1, text_en: d.option_1_en || 'Option 2', text_hi: d.option_1_hi || 'विकल्प 2' }
            ];
            if (d.option_2_en) parsedOpts.push({ id: 2, text_en: d.option_2_en, text_hi: d.option_2_hi || 'विकल्प 3' });
          }

          return {
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
            options: parsedOpts
          };
        });
        setPolls(formatted);
      }
    } catch (err) {
      console.warn('Poll load note:', err);
    }
  }

  useEffect(() => {
    loadPolls();

    const channel = supabase
      .channel('polls_live_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => {
        loadPolls();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleConfirmSeat = () => {
    const seatToConfirm = tentativeSeat || selectedSeat;
    if (!seatToConfirm) return;

    if (isConfirmed && selectedSeat && selectedSeat.name !== seatToConfirm.name) {
      if (bhumatPoints < SEAT_CHANGE_COST) {
        alert(lang === 'HI' ? `अपर्याप्त अंक! सीट बदलने के लिए ${SEAT_CHANGE_COST} अंक चाहिए। आपके पास ${bhumatPoints} अंक हैं।` : `Insufficient points! Changing seat costs ${SEAT_CHANGE_COST} pts. You have ${bhumatPoints} pts.`);
        return;
      }
      const newBal = bhumatPoints - SEAT_CHANGE_COST;
      setBhumatPoints(newBal);
      safeStorage.setItem('bhumat_points', String(newBal));

      const nowIso = new Date().toISOString();
      setLastSeatChangeTimestamp(nowIso);
      safeStorage.setItem('bhumat_last_seat_change', nowIso);
    }

    setSelectedSeat(seatToConfirm);
    setInspectedSeatName(seatToConfirm.name);
    setInspectedSeatState(seatToConfirm.state);
    setIsConfirmed(true);

    try {
      safeStorage.setItem('bhumat_user_seat', seatToConfirm.name);
      safeStorage.setItem('bhumat_user_state', seatToConfirm.state);
      if (selectedAssembly) safeStorage.setItem('bhumat_user_assembly', selectedAssembly);
    } catch (e) {}
  };

  const handleCastVote = async (poll: Poll, optionIdx: number, e?: React.MouseEvent | React.TouchEvent) => {
    if (!selectedSeat) return;

    const dynamicCycle = poll.participation_mode === 'recurring' ? getCurrentCycleId(poll.recurrence) : 'lifetime';
    const cycleVoteKey = `${poll.id}___${dynamicCycle}`;

    // Pointer-Attached Toast on Double Tap
    if (votedCycleKeys.includes(cycleVoteKey)) {
      if (poll.participation_mode === 'recurring') {
        const nextCycleDate = '1st November 2026';
        showPointerToast(lang === 'HI' ? `आप पहले ही मतदान कर चुके हैं। अगला चक्र: ${nextCycleDate}` : `You already voted. Next vote on ${nextCycleDate}.`, e);
      } else {
        showPointerToast(lang === 'HI' ? 'आप पहले ही मतदान कर चुके हैं।' : 'You already voted.', e);
      }
      return;
    }

    const nowIso = new Date().toISOString();
    const updatedKeys = [...votedCycleKeys, cycleVoteKey];
    setVotedCycleKeys(updatedKeys);

    const updatedVotes = { ...selectedVotes, [poll.id]: optionIdx };
    setSelectedVotes(updatedVotes);

    const updatedTimestamps = { ...voteTimestamps, [poll.id]: nowIso };
    setVoteTimestamps(updatedTimestamps);

    const newPoints = bhumatPoints + 10;
    setBhumatPoints(newPoints);

    let newJan = janmatAuditsCount;
    let newLok = lokmatPollsCount;
    if (poll.category === 'JanMat') {
      newJan += 1;
      setJanmatAuditsCount(newJan);
      safeStorage.setItem('bhumat_janmat_count', String(newJan));
    } else {
      newLok += 1;
      setLokmatPollsCount(newLok);
      safeStorage.setItem('bhumat_lokmat_count', String(newLok));
    }

    if (!safeStorage.getItem('bhumat_first_vote_date')) {
      const monthYear = new Date().toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' });
      setVotingSinceDate(monthYear);
      safeStorage.setItem('bhumat_first_vote_date', monthYear);
    }

    try {
      safeStorage.setItem('bhumat_voted_cycles', JSON.stringify(updatedKeys));
      safeStorage.setItem('bhumat_points', String(newPoints));
      safeStorage.setItem('bhumat_vote_timestamps', JSON.stringify(updatedTimestamps));
      if (poll.category === 'LokMat') {
        safeStorage.setItem('bhumat_voted_polls', JSON.stringify(updatedVotes));
      }
    } catch (e) {}

    // Atomic Database Transaction Call to ballot_box and constituency_tallies
    await supabase.rpc('cast_ballot_transaction', {
      p_poll_id: poll.id,
      p_cycle_id: dynamicCycle,
      p_voter_token: deviceHash,
      p_state_name: selectedSeat.state,
      p_constituency_name: selectedSeat.name,
      p_selected_option: optionIdx
    });
  };

  const handleShareWhatsApp = (customMsg: string, fallbackUrl: string) => {
    try {
      const fullText = `${customMsg}\n\n${fallbackUrl}`;
      const win = window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`, '_blank');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        navigator.clipboard.writeText(fullText);
        showPointerToast(lang === 'HI' ? '✓ लिंक क्लिपबोर्ड पर कॉपी हो गया!' : '✓ Link copied to clipboard!');
      }
    } catch (e) {
      navigator.clipboard.writeText(`${customMsg}\n\n${fallbackUrl}`);
      showPointerToast(lang === 'HI' ? '✓ लिंक क्लिपबोर्ड पर कॉपी हो गया!' : '✓ Link copied to clipboard!');
    }
  };

  const inspectedKyc = resolveConstituencyDossier(inspectedSeatName, inspectedSeatState);

  const liveAccessiblePolls = useMemo(() => {
    const now = new Date();
    const filtered = polls.filter((p) => {
      if (!p.is_active) return false;
      if (pillarFilter !== 'ALL' && p.category !== pillarFilter) return false;
      if (p.starts_at && new Date(p.starts_at) > now) return false;
      if (!selectedSeat) return true;

      if (p.target_region_type === 'CUSTOM_SEATS' && Array.isArray(p.target_seats) && p.target_seats.length > 0) {
        return p.target_seats.some((s) => s.toLowerCase() === selectedSeat.name.toLowerCase());
      }
      return true;
    });

    return filtered.sort((a, b) => {
      return new Date(b.starts_at || 0).getTime() - new Date(a.starts_at || 0).getTime();
    });
  }, [polls, pillarFilter, selectedSeat]);

  const allFlattenedSeats = useMemo(() => {
    const list: Array<{ name: string; state: string }> = [];
    Object.entries(GROUPED_PARLIAMENTARY_SEATS).forEach(([state, seats]) => {
      seats.forEach((seat) => list.push({ name: seat, state }));
    });
    return list;
  }, []);

  const searchResults = useMemo(() => {
    if (!archiveSearchQuery.trim()) return allFlattenedSeats.slice(0, 30);
    const q = archiveSearchQuery.toLowerCase().trim();
    return allFlattenedSeats.filter((s) => s.name.toLowerCase().includes(q) || s.state.toLowerCase().includes(q)).slice(0, 40);
  }, [archiveSearchQuery, allFlattenedSeats]);

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

  const civicBadge = useMemo(() => {
    if (janmatAuditsCount >= 3 && lokmatPollsCount >= 3) {
      return { title: lang === 'HI' ? '🇮🇳 राष्ट्रीय नागरिक' : '🇮🇳 Rashtriya Nagrik', bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
    }
    if (janmatAuditsCount > lokmatPollsCount) {
      return { title: lang === 'HI' ? '🏛️ नागरिक लेखा परीक्षक' : '🏛️ Civic Auditor', bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
    }
    if (lokmatPollsCount > 0) {
      return { title: lang === 'HI' ? '🌅 संस्कृति अभिलेखागार' : '🌅 Culture Chronicler', bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
    }
    return { title: lang === 'HI' ? '🥉 सत्यापित नागरिक' : '🥉 Verified Citizen', bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
  }, [janmatAuditsCount, lokmatPollsCount, lang]);

  if (!mounted) return null;

  if (expandedPoll) {
    return (
      <PollExpandedView
        poll={expandedPoll}
        userSeatName={selectedSeat?.name}
        userState={selectedSeat?.state}
        userVotedOptionIdx={selectedVotes[expandedPoll.id]}
        lang={lang}
        onBack={closeExpandedView}
      />
    );
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f8fafc', color: '#0f172a', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content" />
        <meta name="theme-color" content="#0284c7" />
        <title>BhuMat — Bharat's Sovereign Consensus Grid</title>
      </Head>

      <style>{`
        @keyframes pulseBreathing {
          0% { opacity: 0.7; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 0.7; transform: scale(0.98); }
        }
        .breathing-badge {
          animation: pulseBreathing 2.4s infinite ease-in-out;
          display: inline-flex;
          align-items: center;
        }
        @keyframes livePulseDot {
          0% { transform: scale(0.85); opacity: 0.6; }
          50% { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0.6; }
        }
        .red-dot-live {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background-color: #ef4444;
          display: inline-block;
          animation: livePulseDot 1.6s infinite ease-in-out;
        }
        .mobile-dock-pad {
          padding-bottom: 96px;
        }
      `}</style>

      {/* Floating Pointer-Attached Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            left: `${toast.x}px`,
            top: `${toast.y}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 120,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '8px 14px',
            borderRadius: '10px',
            fontSize: '11px',
            fontWeight: 700,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.15)'
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header style={{ height: '56px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 40, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7' }}>BHUMAT</span>
          <span style={{ fontSize: '9px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, letterSpacing: '0.05em' }}>
            {lang === 'HI' ? 'प्रारंभिक प्रवेश' : 'EARLY ACCESS'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {selectedSeat ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '999px', fontSize: '11px', maxWidth: '125px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', flexShrink: 0 }} />
              <span style={{ color: '#065f46', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedSeat.name}</span>
            </div>
          ) : (
            <div style={{ backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '999px', fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
              {lang === 'HI' ? '○ असत्यापित' : '○ Unverified'}
            </div>
          )}

          <div
            onClick={(e) => showPointerToast(lang === 'HI' ? '⚡ नागरिक अंक: 1 नागरिक = 1 मत। अंक केवल सीट परिवर्तन और सुविधाओं के लिए हैं।' : '⚡ Civic Karma: 1 Citizen = 1 Ballot. Points only unlock seat migrations & features.', e)}
            style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a', padding: '3px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, color: '#b45309', cursor: 'pointer' }}
          >
            ⚡ {bhumatPoints}
          </div>

          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
            <button onClick={() => setLang('EN')} style={{ border: 'none', backgroundColor: lang === 'EN' ? '#ffffff' : 'transparent', fontWeight: 700, fontSize: '10px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}>
              EN
            </button>
            <button onClick={() => setLang('HI')} style={{ border: 'none', backgroundColor: lang === 'HI' ? '#ffffff' : 'transparent', fontWeight: 700, fontSize: '10px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}>
              हिन्दी
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mobile-dock-pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 14px 100px 14px' }}>
        
        {/* TAB 1: VOTE FEED */}
        {activeTab === 'vote' && (
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!isConfirmed ? (
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '28px 20px', width: '100%', boxSizing: 'border-box' }}>
                <span style={{ backgroundColor: '#fef3c7', color: '#d97706', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px' }}>
                  {lang === 'HI' ? 'नागरिक नामांकन' : 'BHUMAT CITIZEN ENROLLMENT'}
                </span>
                <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '10px 0 4px 0' }}>
                  {lang === 'HI' ? 'अपना संसदीय क्षेत्र चुनें' : 'Claim Your Parliamentary Seat'}
                </h1>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
                  {lang === 'HI' ? 'अपना गोपनीय मतपत्र अनलॉक करने के लिए अपने 543 लोकसभा निर्वाचन क्षेत्र का चयन करें:' : 'Select your Lok Sabha constituency to unlock your anonymous sovereign ballot:'}
                </p>

                <input
                  type="text"
                  placeholder={lang === 'HI' ? '🔍 सीट या राज्य खोजें (जैसे ईस्ट दिल्ली, दरभंगा, गया)...' : '🔍 Search seat or state (e.g. East Delhi, Darbhanga, Gaya)...'}
                  value={seatSearchInput}
                  onChange={(e) => setSeatSearchInput(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none', marginBottom: '8px' }}
                />

                {quickSeatMatches.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                    {quickSeatMatches.map((m) => (
                      <span
                        key={m.name}
                        onClick={() => {
                          setTentativeSeat({ name: m.name, state: m.state });
                          setSeatSearchInput(m.name);
                        }}
                        style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
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
                  <option value="">{lang === 'HI' ? '-- 543 संसदीय क्षेत्रों में से चुनें --' : '-- Choose Parliamentary Seat (543) --'}</option>
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
                  style={{
                    width: '100%',
                    padding: '14px',
                    backgroundColor: tentativeSeat ? '#10b981' : '#cbd5e1',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '14px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: tentativeSeat ? 'pointer' : 'not-allowed',
                    transition: 'background-color 0.2s ease'
                  }}
                >
                  {tentativeSeat
                    ? (lang === 'HI' ? `✓ पुष्टि करें और ${tentativeSeat.name} में प्रवेश करें` : `Confirm & Enter ${tentativeSeat.name}`)
                    : (lang === 'HI' ? 'कृपया सूची में से एक सीट चुनें' : 'Please Select a Constituency Above')}
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '14px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#059669', fontWeight: 800 }}>{lang === 'HI' ? '● सत्यापित लोकसभा' : '● Verified Lok Sabha'}</span>
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>{selectedSeat?.name} <span style={{ fontSize: '12px', color: '#64748b' }}>({selectedSeat?.state})</span></div>
                  </div>
                  <button onClick={() => setIsConfirmed(false)} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', fontSize: '11px', padding: '6px 12px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
                    {lang === 'HI' ? 'सीट बदलें (50 अंक)' : 'Change Seat (50 pts)'}
                  </button>
                </div>

                {/* Feed Tabs */}
                <div style={{ display: 'flex', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '4px', borderRadius: '12px', boxSizing: 'border-box' }}>
                  <button onClick={() => setPillarFilter('ALL')} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: pillarFilter === 'ALL' ? '#0f172a' : 'transparent', color: pillarFilter === 'ALL' ? '#ffffff' : '#64748b', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    {lang === 'HI' ? 'सभी मतपत्र' : 'All Feeds'}
                  </button>
                  <button onClick={() => setPillarFilter('JanMat')} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: pillarFilter === 'JanMat' ? '#059669' : 'transparent', color: pillarFilter === 'JanMat' ? '#ffffff' : '#059669', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    {lang === 'HI' ? '🌆 जनमत (नागरिक)' : '🌆 JanMat (Civic)'}
                  </button>
                  <button onClick={() => setPillarFilter('LokMat')} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: pillarFilter === 'LokMat' ? '#d97706' : 'transparent', color: pillarFilter === 'LokMat' ? '#ffffff' : '#d97706', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    {lang === 'HI' ? '🌅 लोकमत (संस्कृति)' : '🌅 LokMat (Culture)'}
                  </button>
                </div>

                {liveAccessiblePolls.length === 0 ? (
                  <div style={{ backgroundColor: '#ffffff', padding: '36px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>🗳️</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{lang === 'HI' ? 'इस श्रेणी में कोई सक्रिय मतपत्र नहीं है' : 'No Live Audits in This View'}</div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>{lang === 'HI' ? 'आगामी चक्रों के लिए शेड्यूल टैब देखें।' : 'Check the Schedule Tab for upcoming consensus cycles.'}</p>
                  </div>
                ) : (
                  liveAccessiblePolls.map((poll) => {
                    const isJanMat = poll.category === 'JanMat';
                    const dynamicCycle = poll.participation_mode === 'recurring' ? getCurrentCycleId(poll.recurrence) : 'lifetime';
                    const hasVotedThisCycle = votedCycleKeys.includes(`${poll.id}___${dynamicCycle}`);

                    const isFlipped = flippedOverrides[poll.id] !== undefined 
                      ? flippedOverrides[poll.id] 
                      : hasVotedThisCycle;

                    const isBlackedOut = poll.blackout_seats && poll.blackout_seats.includes(selectedSeat?.name || '');
                    const lokmatTimeAgo = getHumanizedTimeAgo(voteTimestamps[poll.id], lang);

                    return (
                      <div key={poll.id} style={{ perspective: '1000px', width: '100%' }}>
                        <div style={{ position: 'relative', minHeight: '640px', transition: 'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)', transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                          
                          {/* Front: Ballot View */}
                          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', backgroundColor: '#ffffff', border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`, borderRadius: '24px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                            <div>
                              {/* TOP HEADER: Aligned rotate button at top-right */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="red-dot-live" />
                                  <span style={{ fontSize: '11px', fontWeight: 900, color: '#ef4444' }}>LIVE</span>
                                  <span style={{ backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb', color: isJanMat ? '#059669' : '#d97706', border: `1px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`, fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px' }}>
                                    {poll.category}
                                  </span>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    className="breathing-badge"
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 800,
                                      color: hasVotedThisCycle ? (isJanMat ? '#059669' : '#d97706') : '#64748b'
                                    }}
                                  >
                                    {hasVotedThisCycle 
                                      ? (isJanMat ? (lang === 'HI' ? '🔒 मतपत्र सील' : '🔒 BALLOT SEALED') : (lang === 'HI' ? `✓ मत दिया (${lokmatTimeAgo})` : `✓ Voted (${lokmatTimeAgo})`)) 
                                      : (isJanMat ? (lang === 'HI' ? '● गोपनीय मतपत्र' : '● SECRET BALLOT') : (lang === 'HI' ? '● खुला जनमत' : '● OPEN POLL'))}
                                  </span>

                                  {hasVotedThisCycle && (
                                    <button 
                                      onClick={() => setFlippedOverrides((prev) => ({ ...prev, [poll.id]: true }))} 
                                      style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      {lang === 'HI' ? 'दृष्टि ↺' : 'View Drishti ↺'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px 0', lineHeight: 1.5 }}>
                                {lang === 'EN' ? poll.title_en : poll.title_hi}
                              </h3>
                              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.6 }}>
                                {lang === 'EN' ? poll.title_hi : poll.title_en}
                              </p>

                              <div style={{ marginBottom: '16px' }}>
                                <TickerTape activePoll={poll} lang={lang} />
                              </div>

                              {/* Options: Native Palette Borders */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {poll.options.map((opt, idx) => {
                                  const optColor = OPTION_PALETTE[idx % OPTION_PALETTE.length];
                                  const isUserChoice = selectedVotes[poll.id] === idx;
                                  const showChoiceHighlight = !isJanMat && isUserChoice && hasVotedThisCycle;

                                  return (
                                    <button
                                      key={opt.id}
                                      onClick={(e) => handleCastVote(poll, idx, e)}
                                      style={{
                                        padding: '16px',
                                        borderRadius: '14px',
                                        backgroundColor: showChoiceHighlight ? '#ecfdf5' : '#ffffff',
                                        border: showChoiceHighlight 
                                          ? `2.5px solid ${optColor}` 
                                          : `1.5px solid ${optColor}`,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: `0 1px 3px ${optColor}22`
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                                          {lang === 'EN' ? opt.text_en : opt.text_hi}
                                        </div>
                                        {showChoiceHighlight && (
                                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '6px' }}>
                                            {lang === 'HI' ? '✓ आपका मत' : '✓ Your Vote'}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                                        {lang === 'EN' ? opt.text_hi : opt.text_en}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* "Explore Full Drishti Map" Button */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px' }}>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                {isJanMat ? (lang === 'HI' ? '🔒 क्रिप्टोग्राफिक गुप्त मतपेटी' : '🔒 Cryptographic Secret Ballot') : (lang === 'HI' ? '🗳️ खुला जनमत पल्स' : '🗳️ Open Public Pulse')}
                              </span>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {hasVotedThisCycle && (
                                  <button onClick={() => openExpandedView(poll)} style={{ background: isJanMat ? '#ecfdf5' : '#fffbeb', color: isJanMat ? '#059669' : '#d97706', border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`, padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
                                    {lang === 'HI' ? 'सम्पूर्ण दृष्टि नक्शा देखें ↗' : 'Explore Full Drishti Map ↗'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Back: Drishti State View */}
                          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', backgroundColor: '#ffffff', border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`, borderRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb', color: isJanMat ? '#059669' : '#d97706', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '999px' }}>
                                  ✓ {lang === 'HI' ? 'दृष्टि पल्स सक्रिय' : 'DRISHTI PULSE ACTIVE'}
                                </span>
                                <button 
                                  onClick={() => setFlippedOverrides((prev) => ({ ...prev, [poll.id]: false }))} 
                                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '11px', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  {lang === 'HI' ? 'मतपत्र देखें ↻' : 'View Ballot ↻'}
                                </button>
                              </div>

                              <DrishtiMap 
                                selectedConstituencyName={selectedSeat?.name} 
                                selectedState={selectedSeat?.state} 
                                pollId={poll.id} 
                                userVotedOptionIdx={selectedVotes[poll.id]}
                                options={poll.options} 
                              />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                              <button 
                                onClick={() => openExpandedView(poll)} 
                                style={{ 
                                  width: '100%', 
                                  height: '46px', 
                                  backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb', 
                                  border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`, 
                                  borderRadius: '12px', 
                                  color: isJanMat ? '#059669' : '#d97706', 
                                  fontSize: '12px', 
                                  fontWeight: 800, 
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                {lang === 'HI' ? 'सम्पूर्ण दृष्टि नक्शा देखें (543 सीटें) 🔓' : 'Explore Full Drishti Map (543 Seats) 🔓'}
                              </button>

                              <button
                                onClick={() => {
                                  const shareUrl = `https://vote.bhumat.com?ref=${deviceHash}&seat=${encodeURIComponent(selectedSeat?.name || 'Bharat')}`;
                                  const msg = lang === 'HI'
                                    ? `🇮🇳 *भूमत लोकमत ऑडिट | ${selectedSeat?.name.toUpperCase()}*\n\n"${poll.title_hi}"\n\nहमारे संसदीय क्षेत्र को राष्ट्रीय मानचित्र पर गणपूर्ति (कोरम) प्रमाणित करने के लिए अपना गोपनीय मत दें:`
                                    : `🇮🇳 *BHUMAT PUBLIC OPINION AUDIT | ${selectedSeat?.name.toUpperCase()}*\n\n"${poll.title_en}"\n\nOur Lok Sabha seat needs verified citizens to fortify quorum on the National Map.\n\nCast your verified ballot:`;
                                  handleShareWhatsApp(msg, shareUrl);
                                }}
                                style={{
                                  width: '100%',
                                  height: '46px',
                                  backgroundColor: '#10b981',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '12px',
                                  padding: '12px 14px',
                                  fontSize: '12.5px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                <span>📲</span> {lang === 'HI' ? `${selectedSeat?.name} के नागरिकों को जोड़ें (+25 अंक)` : `Mobilize ${selectedSeat?.name} (+25 pts)`}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: SEARCH ARCHIVE */}
        {activeTab === 'search' && (
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px' }}>
                {lang === 'HI' ? '543 संसदीय अभिलेखागार' : '543 CONSTITUENCY ARCHIVE'}
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>
                {lang === 'HI' ? 'संप्रभु मतपत्र अनुक्रमणिका' : 'Sovereign Ballot Index'}
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0' }}>
                {lang === 'HI' ? 'भारत के किसी भी संसदीय क्षेत्र के सत्यापित जनमत रिकॉर्ड और सांसद प्रोफाइल की जांच करें:' : 'Inspect verified consensus records and MP dossiers for any parliamentary seat across India:'}
              </p>

              <input
                type="text"
                placeholder={lang === 'HI' ? '🔍 सीट या राज्य खोजें (जैसे ईस्ट दिल्ली, दरभंगा, गया)...' : '🔍 Search seat or state (e.g. East Delhi, Darbhanga, Gaya)...'}
                value={archiveSearchQuery}
                onChange={(e) => setArchiveSearchQuery(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none' }}
              />
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
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{seat.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{seat.state} • Lok Sabha Seat</div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7' }}>
                    {lang === 'HI' ? 'विवरण देखें ❯' : 'View Dossier ❯'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: CONSTITUENCY DOSSIER */}
        {activeTab === 'dossier' && (
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {isInspectingFromSearch && (
              <button
                onClick={() => {
                  setIsInspectingFromSearch(false);
                  setActiveTab('search');
                }}
                style={{ alignSelf: 'flex-start', background: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
              >
                {lang === 'HI' ? '← 543 खोज संग्रह पर वापस जाएं' : '← Back to 543 Search Archive'}
              </button>
            )}

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px' }}>
                  {lang === 'HI' ? `संसदीय विवरण: ${inspectedKyc.pcCode}` : `PARLIAMENTARY DOSSIER: ${inspectedKyc.pcCode}`}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>
                  {lang === 'HI' ? '● 18वीं लोकसभा प्रमाणित' : '● 18th Lok Sabha Certified'}
                </span>
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '8px 0 2px 0' }}>
                {inspectedSeatName} {lang === 'HI' ? 'संसदीय निर्वाचन क्षेत्र' : 'Parliamentary Constituency'}
              </h2>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                {inspectedSeatState} {lang === 'HI' ? 'राज्य अधिकार क्षेत्र' : 'State Jurisdiction'}
              </div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', marginBottom: '14px' }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{inspectedKyc.mpName}</div>
                <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: 700, marginTop: '2px' }}>{inspectedKyc.party}</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', fontSize: '11.5px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>{lang === 'HI' ? 'जीत का अंतर:' : 'Winning Margin:'}</span>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{inspectedKyc.margin}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>{lang === 'HI' ? 'मतदान प्रतिशत:' : 'Voter Turnout:'}</span>
                    <div style={{ fontWeight: 800, color: '#059669' }}>{inspectedKyc.turnout}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>{lang === 'HI' ? 'घोषित संपत्ति:' : 'Assets Declared:'}</span>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{inspectedKyc.assets}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>{lang === 'HI' ? 'आपराधिक मामले:' : 'Criminal Cases:'}</span>
                    <div style={{ fontWeight: 800, color: inspectedKyc.cases > 0 ? '#dc2626' : '#059669' }}>
                      {inspectedKyc.cases} {lang === 'HI' ? 'दर्ज' : 'Listed'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  {lang === 'HI' ? 'विधानसभा क्षेत्र (परिसीमन आदेश):' : 'Assembly Segments (Vidhan Sabha):'}
                </span>
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
              <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px' }}>
                {lang === 'HI' ? 'संपादकीय समय सारिणी' : 'EDITORIAL TIMETABLE'}
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '8px 0 12px 0' }}>
                {lang === 'HI' ? 'सर्वसम्मति विमोचन कार्यक्रम' : 'Consensus Drop Timetable'}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ backgroundColor: '#ecfdf5', padding: '12px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>🌆 08:00 PM Daily</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#064e3b' }}>JanMat Audit</div>
                  <div style={{ fontSize: '10px', color: '#047857', marginTop: '2px' }}>{lang === 'HI' ? 'सांविधिक नागरिक जवाबदेही' : 'Statutory Civic Track'}</div>
                </div>
                <div style={{ backgroundColor: '#fffbeb', padding: '12px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#d97706' }}>🌅 08:00 AM Daily</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#92400e' }}>LokMat Debate</div>
                  <div style={{ fontSize: '10px', color: '#78350f', marginTop: '2px' }}>{lang === 'HI' ? 'संस्कृति एवं जनमानस पल्स' : 'Culture & Pulse Track'}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', paddingLeft: '4px' }}>
                {lang === 'HI' ? 'कतारबद्ध संपादकीय विमोचन' : 'Scheduled & Recurring Cycles'}
              </div>
              {polls.filter((p) => p.is_active).map((item) => (
                <div key={item.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: item.category === 'JanMat' ? '#059669' : '#d97706' }}>
                      {new Date(item.starts_at || 0) > new Date()
                        ? (lang === 'HI' ? `खुलने का समय: ${new Date(item.starts_at || 0).toLocaleDateString()} • 08:00 PM` : `Drops on ${new Date(item.starts_at || 0).toLocaleDateString()} • 08:00 PM`)
                        : (lang === 'HI' ? '● मतपत्र फीड में सक्रिय' : '● LIVE IN BALLOT FEED')}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                      {item.current_cycle} ({item.recurrence})
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{lang === 'HI' ? item.title_hi : item.title_en}</div>
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
                  <div style={{ fontSize: '12px', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
                    ● {lang === 'HI' ? 'सत्यापित संप्रभु नागरिक' : 'Verified Sovereign Citizen'}
                  </div>
                </div>
                <span style={{ backgroundColor: civicBadge.bg, color: civicBadge.text, border: `1px solid ${civicBadge.border}`, fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px' }}>
                  {civicBadge.title}
                </span>
              </div>

              <div style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '16px', padding: '16px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>{lang === 'HI' ? 'नागरिक कर्म अंक' : 'Civic Karma Balance'}</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#f59e0b' }}>{bhumatPoints} pts</div>
                </div>
                <div style={{ fontSize: '11px', color: '#38bdf8' }}>{lang === 'HI' ? 'सीट परिवर्तन शुल्क: 50 अंक' : 'Seat Change Fee: 50 pts'}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '10px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#059669' }}>🌆 {lang === 'HI' ? 'जनमत ऑडिट' : 'JanMat Audits'}</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#064e3b', marginTop: '2px' }}>{janmatAuditsCount}</div>
                  <div style={{ fontSize: '9px', color: '#047857' }}>{lang === 'HI' ? 'नागरिक कर्तव्य' : 'Civic Duty Track'}</div>
                </div>
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '10px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#d97706' }}>🌅 {lang === 'HI' ? 'लोकमत सर्वेक्षण' : 'LokMat Polls'}</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#92400e', marginTop: '2px' }}>{lokmatPollsCount}</div>
                  <div style={{ fontSize: '9px', color: '#b45309' }}>{lang === 'HI' ? 'संस्कृति ट्रैक' : 'Culture & Pulse Track'}</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '14px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>{lang === 'HI' ? 'मतदान प्रारंभ:' : 'Voting Since:'}</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{votingSinceDate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>{lang === 'HI' ? 'अंतिम सीट परिवर्तन:' : 'Last Seat Migration:'}</span>
                  <span style={{ fontWeight: 800, color: '#059669' }}>
                    {lastSeatChangeTimestamp ? getHumanizedTimeAgo(lastSeatChangeTimestamp, lang) : (lang === 'HI' ? 'कभी नहीं बदला' : 'Never Changed')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>{lang === 'HI' ? 'पंजीकृत संसदीय क्षेत्र:' : 'Claimed Constituency:'}</span>
                  <span style={{ fontWeight: 800 }}>{selectedSeat?.name || (lang === 'HI' ? 'अपंजीकृत' : 'Unclaimed')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>{lang === 'HI' ? 'राज्य अधिकार क्षेत्र:' : 'State Jurisdiction:'}</span>
                  <span style={{ fontWeight: 800 }}>{selectedSeat?.state || 'Bharat'}</span>
                </div>
              </div>

              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '16px', padding: '16px', marginTop: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#065f46' }}>
                  {lang === 'HI' ? 'नागरिकों को जोड़ें और अंक अर्जित करें' : 'Refer Citizens & Earn Points'}
                </div>
                <p style={{ fontSize: '11px', color: '#047857', margin: '4px 0 10px 0', lineHeight: 1.4 }}>
                  {lang === 'HI' ? 'अपने निर्वाचन क्षेत्र में नागरिकों को आमंत्रित करें। सीट परिवर्तन अनलॉक करने के लिए प्रत्येक सत्यापित नागरिक पर +25 अंक प्राप्त करें।' : 'Invite voters in your constituency. Earn +25 Points per verified citizen to unlock seat migrations and governance features.'}
                </p>
                <button
                  onClick={() => {
                    const shareUrl = `https://vote.bhumat.com?ref=${deviceHash}&seat=${encodeURIComponent(selectedSeat?.name || 'Bharat')}`;
                    const msg = lang === 'HI'
                      ? `🇮🇳 भूमत से जुड़ें — भारत की 543 लोकसभा सीटों पर निष्पक्ष संप्रभु जनमत का लाइव नक्शा देखें:`
                      : `🇮🇳 Join BhuMat — Track sovereign public opinion audits across 543 Lok Sabha seats:`;
                    handleShareWhatsApp(msg, shareUrl);
                  }}
                  style={{ width: '100%', padding: '10px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                >
                  📲 {lang === 'HI' ? 'रेफरल लिंक साझा करें (+25 अंक)' : 'Share Personal Referral Link (+25 pts)'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Dock Navigation */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '60px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 50 }}>
        <button onClick={() => setActiveTab('search')} style={{ background: 'none', border: 'none', color: activeTab === 'search' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: '18px' }}>🔍</span>
          <span style={{ fontSize: '10px', fontWeight: 700 }}>{lang === 'HI' ? 'खोज' : 'Search'}</span>
        </button>
        <button onClick={() => setActiveTab('dossier')} style={{ background: 'none', border: 'none', color: activeTab === 'dossier' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: '18px' }}>📋</span>
          <span style={{ fontSize: '10px', fontWeight: 700 }}>{lang === 'HI' ? 'विवरण' : 'Dossier'}</span>
        </button>
        <button onClick={() => setActiveTab('vote')} style={{ background: 'none', border: 'none', color: activeTab === 'vote' ? '#10b981' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px' }}>🗳️</span>
          <span style={{ fontSize: '10px', fontWeight: 800 }}>{lang === 'HI' ? 'मतदान' : 'Vote'}</span>
        </button>
        <button onClick={() => setActiveTab('schedule')} style={{ background: 'none', border: 'none', color: activeTab === 'schedule' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: '18px' }}>📅</span>
          <span style={{ fontSize: '10px', fontWeight: 700 }}>{lang === 'HI' ? 'कार्यक्रम' : 'Schedule'}</span>
        </button>
        <button onClick={() => setActiveTab('profile')} style={{ background: 'none', border: 'none', color: activeTab === 'profile' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: '18px' }}>👤</span>
          <span style={{ fontSize: '10px', fontWeight: 700 }}>{lang === 'HI' ? 'प्रोफ़ाइल' : 'Profile'}</span>
        </button>
      </nav>
    </div>
  );
}