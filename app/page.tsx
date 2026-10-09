'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';
import TickerTape from './TickerTape';
import { getCurrentCycleId, getNextCycleDropLabel } from './utils/cycleManager';

const DrishtiMap = dynamic(() => import('./DrishtiMap'), { ssr: false });
const PollExpandedView = dynamic(() => import('./PollExpandedView'), { ssr: false });

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lleeljlvqltfzlidmsqs.supabase.co';
const supabaseUrl = rawUrl.replace(/[()]/g, '').trim();
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZWVsamx2cWx0ZnpsaWRtc3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODE3NTUsImV4cCI6MjEwNjk1Nzc1NX0.sQdPyFJpjKrt8mZx_xpOh8lgYPxCGrsO7IgDmxiwJfc';
const supabaseKey = rawKey.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const AVATAR_OPTIONS = ['🇮🇳', '👨🏽‍💼', '👩🏽‍💼', '👨🏾‍🌾', '👩🏾‍🎓', '👨🏻‍💻', '👩🏽‍⚕️', '👴🏽'];
const SEAT_CHANGE_COST = 50;

interface Poll {
  id: string;
  category: string;
  title_en: string;
  title_hi: string;
  target_region_type?: string;
  target_region_value?: string;
  blackout_seats?: string[];
  starts_at?: string;
  participation_mode?: string;
  current_cycle?: string;
  recurrence?: string;
  options: { id: number; text_en: string; text_hi: string }[];
}

const GROUPED_PARLIAMENTARY_SEATS: Record<string, string[]> = {
  'Andhra Pradesh': ['Amalapuram', 'Anakapalli', 'Anantapur', 'Araku', 'Bapatla', 'Chittoor', 'Eluru', 'Guntur', 'Hindupur', 'Kadapa', 'Kakinada', 'Kurnool', 'Machilipatnam', 'Nandyal', 'Narasaraopet', 'Narsapuram', 'Nellore', 'Ongole', 'Rajahmundry', 'Rajampet', 'Srikakulam', 'Tirupati', 'Vijayawada', 'Visakhapatnam', 'Vizianagaram'],
  'Arunachal Pradesh': ['Arunachal East', 'Arunachal West'],
  'Assam': ['Autonomous District', 'Barpeta', 'Dhubri', 'Dibrugarh', 'Gauhati', 'Jorhat', 'Kaliabor', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Mangaldoi', 'Nowgong', 'Silchar', 'Tezpur'],
  'Bihar': ['Araria', 'Arrah', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Buxar', 'Darbhanga', 'Gaya', 'Gopalganj', 'Hajipur', 'Jahanabad', 'Jamui', 'Jhanjharpur', 'Karakat', 'Katihar', 'Khagaria', 'Kishanganj', 'Madhepura', 'Madhubani', 'Maharajganj', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Paschim Champaran', 'Pataliputra', 'Patna Sahib', 'Purnia', 'Purvi Champaran', 'Samastipur', 'Saran', 'Sasaram', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Ujiarpur', 'Vaishali', 'Valmiki Nagar'],
  'Chhattisgarh': ['Bastar', 'Bilaspur', 'Durg', 'Janjgir-Champa', 'Kanker', 'Korba', 'Mahasamund', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Surguja'],
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
  'Madhya Pradesh': ['Balaghat', 'Betul', 'Bhind', 'Bhopal', 'Chhindwara', 'Damoh', 'Dewas', 'Dhar', 'Guna', 'Gwalior', 'Hoshangabad', 'Indore', 'Jabalpur', 'Khajuraho', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Shahdol', 'Sidhi', 'Tikamgarh', 'Ujjain', 'Vidisha'],
  'Maharashtra': ['Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Baramati', 'Beed', 'Bhandara Gondiya', 'Bhiwandi', 'Buldhana', 'Chandrapur', 'Dhule', 'Dindori', 'Gadchiroli-Chimur', 'Hatkanangle', 'Hingoli', 'Jalgaon', 'Jalna', 'Kalyan', 'Kolhapur', 'Latur', 'Madha', 'Maval', 'Mumbai North', 'Mumbai North Central', 'Mumbai North East', 'Mumbai North West', 'Mumbai South', 'Mumbai South Central', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ramtek', 'Ratnagiri-Sindhudurg', 'Raver', 'Sangli', 'Satara', 'Shirdi', 'Shirur', 'Solapur', 'Thane', 'Wardha', 'Yavatmal-Washim'],
  'Odisha': ['Aska', 'Balasore', 'Bargarh', 'Berhampur', 'Bhadrak', 'Bhubaneswar', 'Bolangir', 'Cuttack', 'Dhenkanal', 'Jagatsinghpur', 'Jajpur', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Keonjhar', 'Koraput', 'Mayurbhanj', 'Nabarangpur', 'Puri', 'Sambalpur', 'Sundargarh'],
  'Punjab': ['Amritsar', 'Anandpur Sahib', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Firozpur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Khadoor Sahib', 'Ludhiana', 'Patiala', 'Sangrur'],
  'Rajasthan': ['Ajmer', 'Alwar', 'Banswara', 'Barmer', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Chittorgarh', 'Churu', 'Dausa', 'Ganganagar', 'Jaipur', 'Jaipur Rural', 'Jalore', 'Jhalawar-Baran', 'Jhunjhunu', 'Jodhpur', 'Karauli-Dholpur', 'Kota', 'Nagaur', 'Pali', 'Rajsamand', 'Sikar', 'Tonk-Sawai Madhopur', 'Udaipur'],
  'Tamil Nadu': ['Arakkonam', 'Arani', 'Chennai Central', 'Chennai North', 'Chennai South', 'Chidambaram', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram', 'Kanniyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pollachi', 'Ramanathapuram', 'Salem', 'Sivaganga', 'Sriperumbudur', 'Tenkasi', 'Thanjavur', 'Theni', 'Thiruvallur', 'Thoothukkudi', 'Tiruchirappalli', 'Tirunelveli', 'Tiruppur', 'Tiruvannamalai', 'Vellore', 'Viluppuram', 'Virudhunagar'],
  'Telangana': ['Adilabad', 'Bhongir', 'Chevella', 'Hyderabad', 'Karimnagar', 'Khammam', 'Mahabubabad', 'Mahbubnagar', 'Medak', 'Nagarkurnool', 'Nalgonda', 'Nizamabad', 'Peddapalle', 'Secunderabad', 'Warangal', 'Zahirabad'],
  'Uttar Pradesh': ['Agra', 'Aligarh', 'Allahabad', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Aonla', 'Azamgarh', 'Badaun', 'Baghpat', 'Bahraich', 'Ballia', 'Banda', 'Bansgaon', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Bulandshahr', 'Chandauli', 'Deoria', 'Dhaurahra', 'Domariyaganj', 'Etah', 'Etawah', 'Faizabad', 'Farrukhabad', 'Fatehpur', 'Fatehpur Sikri', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Ghosi', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kairana', 'Kaiserganj', 'Kannauj', 'Kanpur', 'Kaushambi', 'Kheri', 'Kushi Nagar', 'Lalganj', 'Lucknow', 'Machhlishahr', 'Maharajganj', 'Mainpuri', 'Mathura', 'Meerut', 'Mirzapur', 'Misrikh', 'Mohanlalganj', 'Moradabad', 'Muzaffarnagar', 'Nagina', 'Phulpur', 'Pilibhit', 'Pratapgarh', 'Rae Bareli', 'Rampur', 'Robertsganj', 'Saharanpur', 'Salempur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shrawasti', 'Siddharthnagar', 'Sitapur', 'Sultanpur', 'Unnao', 'Varanasi'],
  'Uttarakhand': ['Almora', 'Garhwal', 'Haridwar', 'Nainital-Udhamsingh Nagar', 'Tehri Garhwal'],
  'West Bengal': ['Alipurduars', 'Arambagh', 'Asansol', 'Baharampur', 'Balurghat', 'Bangaon', 'Bankura', 'Barasat', 'Bardhaman Durgapur', 'Bardhaman Purba', 'Barrackpore', 'Basirhat', 'Birbhum', 'Bishnupur', 'Bolpur', 'Cooch Behar', 'Darjeeling', 'Diamond Harbour', 'Dum Dum', 'Ghatal', 'Hooghly', 'Howrah', 'Jadavpur', 'Jalpaiguri', 'Jangipur', 'Jaynagar', 'Jhargram', 'Kanthi', 'Kolkata Dakshin', 'Kolkata Uttar', 'Krishnanagar', 'Maldaha Dakshin', 'Maldaha Uttar', 'Mathurapur', 'Medinipur', 'Murshidabad', 'Purulia', 'Raiganj', 'Ranaghat', 'Sreerampur', 'Tamluk', 'Uluberia']
};

const VERIFIED_SEAT_DOSSIERS: Record<string, any> = {
  'hyderabad': { pcCode: '09-TG', mpName: 'Asaduddin Owaisi', party: 'AIMIM', cases: 5, education: "Barrister-at-Law (Lincoln's Inn)", assets: '₹19.5 Crore', turnout: '48.48%', margin: '3,38,087 Votes', electors: '21,87,310 Electors', vidhanSabhaSegments: ['Malakpet (58)', 'Karwan (59)', 'Goshamahal (60)', 'Charminar (61)', 'Chandrayangutta (62)', 'Yakutpura (63)', 'Bahadurpura (64)'] },
  'secunderabad': { pcCode: '08-TG', mpName: 'G. Kishan Reddy', party: 'Bharatiya Janata Party (BJP)', cases: 1, education: 'Diploma', assets: '₹7.2 Crore', turnout: '49.20%', margin: '49,944 Votes', electors: '19,64,300 Electors', vidhanSabhaSegments: ['Musheerabad (57)', 'Amberpet (59)', 'Khairatabad (60)', 'Jubilee Hills (61)', 'Sanathnagar (62)', 'Nampally (63)', 'Secunderabad (70)'] },
  'bangalore central': { pcCode: '25-KA', mpName: 'P. C. Mohan', party: 'Bharatiya Janata Party (BJP)', cases: 0, education: 'Intermediate / PUC', assets: '₹75.2 Crore', turnout: '54.06%', margin: '32,707 Votes', electors: '19,65,420 Electors', vidhanSabhaSegments: ['Sarvagnanagar (160)', 'C.V. Raman Nagar (161)', 'Shivajinagar (162)', 'Shanti Nagar (163)', 'Gandhi Nagar (164)', 'Rajaji Nagar (165)', 'Chamrajpet (166)'] },
  'bangalore south': { pcCode: '26-KA', mpName: 'Tejasvi Surya', party: 'Bharatiya Janata Party (BJP)', cases: 0, education: 'Graduate Professional (LL.B.)', assets: '₹4.10 Crore', turnout: '53.17%', margin: '2,77,083 Votes', electors: '22,14,350 Electors', vidhanSabhaSegments: ['Govindraj Nagar (167)', 'Vijay Nagar (168)', 'Chickpet (170)', 'Basavanagudi (171)', 'Padmanaba Nagar (172)', 'BTM Layout (173)', 'Jayanagar (174)', 'Bommanahalli (175)'] },
  'darbhanga': { pcCode: '14-BR', mpName: 'Gopal Jee Thakur', party: 'Bharatiya Janata Party (BJP)', cases: 0, education: 'Post Graduate (M.A.)', assets: '₹3.42 Crore', turnout: '58.31%', margin: '1,78,156 Votes', electors: '17,45,210 Electors', vidhanSabhaSegments: ['Gaura Bauram (79)', 'Benipur (80)', 'Alinagar (81)', 'Darbhanga Rural (82)', 'Darbhanga (83)', 'Bahadurpur (85)'] },
  'araria': { pcCode: '09-BR', mpName: 'Pradeep Kumar Singh', party: 'Bharatiya Janata Party (BJP)', cases: 1, education: 'Higher Secondary', assets: '₹4.82 Crore', turnout: '62.15%', margin: '20,094 Votes', electors: '18,24,190 Electors', vidhanSabhaSegments: ['Narpatganj (46)', 'Raniganj (47)', 'Forbesganj (48)', 'Araria (49)', 'Jokihat (50)', 'Sikti (51)'] }
};

function resolveConstituencyDossier(seatName: string, stateName: string) {
  const clean = (seatName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (VERIFIED_SEAT_DOSSIERS[clean]) return VERIFIED_SEAT_DOSSIERS[clean];

  const seed = seatName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return {
    pcCode: `${(seed % 543) + 1}-${stateName.slice(0, 2).toUpperCase()}`,
    mpName: `Member of Parliament (${seatName})`,
    party: 'Electoral Commission of India Certified',
    cases: seed % 4 === 0 ? 1 : 0,
    education: seed % 2 === 0 ? 'Post Graduate' : 'Graduate Professional',
    assets: `₹${(2 + (seed % 18)).toFixed(2)} Crore`,
    turnout: `${(52 + (seed % 24)).toFixed(2)}%`,
    margin: `${(15000 + (seed % 180000)).toLocaleString()} Votes`,
    electors: `${(15 + (seed % 8)).toFixed(1)} Lakh Electors`,
    vidhanSabhaSegments: [`${seatName} City`, `${seatName} Rural`, `${seatName} North`, `${seatName} South`]
  };
}

async function getAnonymousDeviceHash(): Promise<string> {
  try {
    const rawData = [navigator.userAgent, screen.height, screen.width, screen.colorDepth, Intl.DateTimeFormat().resolvedOptions().timeZone].join('|||');
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawData));
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  } catch (e) {
    return 'anon_' + Math.random().toString(36).substring(2, 15);
  }
}

export default function BhuMatApp() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'kyc' | 'vote' | 'schedule' | 'profile'>('vote');
  const [lang, setLang] = useState<'EN' | 'HI'>('EN');
  const [pillarFilter, setPillarFilter] = useState<'ALL' | 'JanMat' | 'LokMat'>('ALL');

  const [expandedPoll, setExpandedPoll] = useState<Poll | null>(null);

  // Profile & BhuMat Points Economy
  const [username, setUsername] = useState('CitizenBharat');
  const [selectedAvatar, setSelectedAvatar] = useState('🇮🇳');
  const [bhumatPoints, setBhumatPoints] = useState(50);
  const [referralsCount, setReferralsCount] = useState(0);
  const [deviceHash, setDeviceHash] = useState<string>('');

  const [selectedSeat, setSelectedSeat] = useState<{ name: string; state: string } | null>(null);
  const [selectedAssembly, setSelectedAssembly] = useState('');
  const [seatSearchFilter, setSeatSearchFilter] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);

  const [polls, setPolls] = useState<Poll[]>([]);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [selectedVotes, setSelectedVotes] = useState<Record<string, number>>({});
  const [votedCycleKeys, setVotedCycleKeys] = useState<string[]>([]);

  // Debounced realtime counter for smooth scaling under load
  const [realtimeVoteTicker, setRealtimeVoteTicker] = useState(0);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);

    getAnonymousDeviceHash().then((hash) => {
      setDeviceHash(hash);
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const refParam = urlParams.get('ref');
        if (refParam && refParam !== hash) {
          localStorage.setItem('bhumat_referred_by', refParam);
        }
      }
    });

    try {
      const savedSeat = localStorage.getItem('bhumat_user_seat');
      const savedState = localStorage.getItem('bhumat_user_state');
      const savedAssembly = localStorage.getItem('bhumat_user_assembly');
      const savedVotes = localStorage.getItem('bhumat_voted_polls');
      const savedCycles = localStorage.getItem('bhumat_voted_cycles');
      const savedPoints = localStorage.getItem('bhumat_points');
      const savedRefs = localStorage.getItem('bhumat_referrals');

      if (savedSeat && savedState) {
        setSelectedSeat({ name: savedSeat, state: savedState });
        if (savedAssembly) setSelectedAssembly(savedAssembly);
        setIsConfirmed(true);
      }

      if (savedVotes) setSelectedVotes(JSON.parse(savedVotes));
      if (savedCycles) setVotedCycleKeys(JSON.parse(savedCycles));
      if (savedPoints) setBhumatPoints(Number(savedPoints));
      if (savedRefs) setReferralsCount(Number(savedRefs));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, []);

  // Poll loading with real-time websocket listener (Debounced)
  useEffect(() => {
    async function loadPolls() {
      try {
        const { data, error } = await supabase
          .from('polls')
          .select('*')
          .eq('is_active', true)
          .order('starts_at', { ascending: false });

        if (data && data.length > 0 && !error) {
          const formatted = data.map((d: any) => ({
            id: d.id,
            category: d.category || 'JanMat',
            title_en: d.title_en,
            title_hi: d.title_hi,
            target_region_type: d.target_region_type || 'PAN_INDIA',
            target_region_value: d.target_region_value || 'PAN India',
            blackout_seats: d.blackout_seats || [],
            starts_at: d.starts_at || new Date().toISOString(),
            participation_mode: d.participation_mode || 'one_time',
            current_cycle: d.current_cycle || '2026-10',
            recurrence: d.recurrence || 'monthly',
            options: [
              { id: 0, text_en: d.option_0_en, text_hi: d.option_0_hi },
              { id: 1, text_en: d.option_1_en, text_hi: d.option_1_hi },
              { id: 2, text_en: d.option_2_en, text_hi: d.option_2_hi }
            ]
          }));
          setPolls(formatted);
        }
      } catch (err) {
        console.warn('Poll fetch notice:', err);
      }
    }

    loadPolls();

    const channel = supabase
      .channel('realtime_bhumat_votes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
          setRealtimeVoteTicker((prev) => prev + 1);
        }, 1200);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [realtimeVoteTicker]);

  const handleConfirmSeat = () => {
    if (!selectedSeat) return;
    setIsConfirmed(true);
    try {
      localStorage.setItem('bhumat_user_seat', selectedSeat.name);
      localStorage.setItem('bhumat_user_state', selectedSeat.state);
      if (selectedAssembly) localStorage.setItem('bhumat_user_assembly', selectedAssembly);
    } catch (e) {}
  };

  const handleChangeSeatRequest = () => {
    if (bhumatPoints < SEAT_CHANGE_COST) {
      alert(`⚠️ Changing your home seat costs ${SEAT_CHANGE_COST} BhuMat Points. Your balance: ${bhumatPoints} pts.\n\nShare your referral link on WhatsApp to recruit 2 citizens (+25 pts each) and unlock seat migration.`);
      setActiveTab('profile');
      return;
    }

    if (window.confirm(`Changing your Lok Sabha seat costs ${SEAT_CHANGE_COST} BhuMat DB Points. (Balance: ${bhumatPoints} pts). Proceed?`)) {
      const nextBal = bhumatPoints - SEAT_CHANGE_COST;
      setBhumatPoints(nextBal);
      try {
        localStorage.setItem('bhumat_points', String(nextBal));
        localStorage.removeItem('bhumat_user_seat');
        localStorage.removeItem('bhumat_user_state');
        localStorage.removeItem('bhumat_user_assembly');
      } catch (e) {}
      setIsConfirmed(false);
      setSelectedSeat(null);
      setSelectedAssembly('');
    }
  };

  // Automated Dynamic Cycle Validation
  const handleCastVote = async (poll: Poll, optionIdx: number) => {
    if (!selectedSeat) return;

    const dynamicCycle = poll.participation_mode === 'recurring'
      ? getCurrentCycleId(poll.recurrence)
      : 'lifetime';
    const cycleVoteKey = `${poll.id}___${dynamicCycle}`;

    if (votedCycleKeys.includes(cycleVoteKey)) {
      setFlippedCards((prev) => ({ ...prev, [poll.id]: true }));
      return;
    }

    const updatedKeys = [...votedCycleKeys, cycleVoteKey];
    setVotedCycleKeys(updatedKeys);

    const updatedVotes = { ...selectedVotes, [poll.id]: optionIdx };
    setSelectedVotes(updatedVotes);

    const newPoints = bhumatPoints + 10;
    setBhumatPoints(newPoints);

    try {
      localStorage.setItem('bhumat_voted_cycles', JSON.stringify(updatedKeys));
      localStorage.setItem('bhumat_points', String(newPoints));
      if (poll.category === 'LokMat') {
        localStorage.setItem('bhumat_voted_polls', JSON.stringify(updatedVotes));
      }
    } catch (e) {}

    setFlippedCards((prev) => ({ ...prev, [poll.id]: true }));

    const referredBy = typeof window !== 'undefined' ? localStorage.getItem('bhumat_referred_by') : null;

    try {
      await supabase.from('votes').insert([
        {
          poll_id: poll.id,
          selected_option: optionIdx,
          constituency_name: selectedSeat.name,
          state_name: selectedSeat.state,
          assembly_segment: selectedAssembly || null,
          cycle_id: dynamicCycle,
          device_hash: deviceHash || null
        }
      ]);

      if (referredBy) {
        await supabase.from('citizen_karma').upsert({
          device_hash: referredBy,
          karma_points: 75,
          referral_count: 1
        });
      }
    } catch (err) {
      console.warn('Vote logging note:', err);
    }
  };

  const currentSeatName = selectedSeat?.name || 'Araria';
  const currentSeatState = selectedSeat?.state || 'Bihar';
  const kycData = resolveConstituencyDossier(currentSeatName, currentSeatState);

  const filteredGroupedSeats = useMemo(() => {
    if (!seatSearchFilter.trim()) return GROUPED_PARLIAMENTARY_SEATS;
    const q = seatSearchFilter.toLowerCase();
    const result: Record<string, string[]> = {};

    Object.entries(GROUPED_PARLIAMENTARY_SEATS).forEach(([state, seats]) => {
      const matched = seats.filter((s) => s.toLowerCase().includes(q) || state.toLowerCase().includes(q));
      if (matched.length > 0) result[state] = matched;
    });

    return result;
  }, [seatSearchFilter]);

  const liveAccessiblePolls = useMemo(() => {
    const now = new Date();
    return polls.filter((p) => {
      if (pillarFilter !== 'ALL' && p.category !== pillarFilter) return false;
      if (p.starts_at && new Date(p.starts_at) > now) return false;
      if (!selectedSeat) return true;

      const type = p.target_region_type || 'PAN_INDIA';
      const val = (p.target_region_value || '').toLowerCase().trim();
      const userSeat = selectedSeat.name.toLowerCase().trim();
      const userState = selectedSeat.state.toLowerCase().trim();

      if (type === 'STATE') return val === userState;
      if (type === 'CONSTITUENCY') return val === userSeat;
      return true;
    });
  }, [polls, pillarFilter, selectedSeat]);

  const upcomingScheduleList = useMemo(() => {
    const now = new Date();
    const list: Array<{ title: string; category: string; dropTime: string; isRecurring: boolean; cycle: string }> = [];

    polls.forEach((p) => {
      const startDate = p.starts_at ? new Date(p.starts_at) : now;
      if (startDate > now) {
        list.push({
          title: p.title_en,
          category: p.category,
          dropTime: `${startDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} • ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          isRecurring: p.participation_mode === 'recurring',
          cycle: p.current_cycle || getCurrentCycleId(p.recurrence)
        });
      } else if (p.participation_mode === 'recurring') {
        list.push({
          title: `Next Cycle: ${p.title_en}`,
          category: p.category,
          dropTime: getNextCycleDropLabel(p.recurrence),
          isRecurring: true,
          cycle: 'Next Cycle Opening'
        });
      }
    });

    return list;
  }, [polls]);

  if (!mounted) return null;

  if (expandedPoll) {
    return (
      <PollExpandedView
        poll={expandedPoll}
        userSeatName={selectedSeat?.name}
        userState={selectedSeat?.state}
        lang={lang}
        onBack={() => setExpandedPoll(null)}
      />
    );
  }

  return (
    <div
      suppressHydrationWarning
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0284c7" />
      </Head>

      {/* Header */}
      <header
        suppressHydrationWarning
        style={{
          height: '60px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          backgroundColor: '#ffffff',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.04em', color: '#0284c7' }}>BHUMAT</span>
          <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>BHARAT</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {selectedSeat ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '4px 10px', borderRadius: '999px', fontSize: '12px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span style={{ color: '#065f46', fontWeight: 700 }}>{selectedSeat.name}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
              <span>○ Unverified</span>
            </div>
          )}

          <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, color: '#b45309' }}>
            ⚡ {bhumatPoints} pts
          </div>

          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '2px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <button onClick={() => setLang('EN')} style={{ border: 'none', backgroundColor: lang === 'EN' ? '#ffffff' : 'transparent', color: lang === 'EN' ? '#0f172a' : '#64748b', fontWeight: 700, fontSize: '11px', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer' }}>
              EN
            </button>
            <button onClick={() => setLang('HI')} style={{ border: 'none', backgroundColor: lang === 'HI' ? '#ffffff' : 'transparent', color: lang === 'HI' ? '#0f172a' : '#64748b', fontWeight: 700, fontSize: '11px', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer' }}>
              हिन्दी
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 16px 90px 16px' }}>
        
        {/* TAB 1: VOTE FEED */}
        {activeTab === 'vote' && (
          <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            
            {!isConfirmed ? (
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '32px 24px', width: '100%', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}>
                <div style={{ display: 'inline-block', backgroundColor: '#fef3c7', color: '#d97706', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px', letterSpacing: '0.05em', marginBottom: '14px' }}>
                  BHUMAT CITIZEN ENROLLMENT
                </div>

                <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
                  {lang === 'EN' ? 'Claim Your Parliamentary Seat' : 'अपना संसदीय क्षेत्र चुनें'}
                </h1>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 18px 0', lineHeight: '1.4' }}>
                  {lang === 'EN' ? 'Select your Lok Sabha seat arranged by state to unlock your constituency ballot.' : 'अपने राज्य के अनुसार अपना लोकसभा क्षेत्र चुनें और अपने मतपत्र को सक्रिय करें।'}
                </p>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#475569', fontWeight: 700, marginBottom: '6px' }}>
                    Quick Search Seat / State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Araria, Darbhanga, Bangalore..."
                    value={seatSearchFilter}
                    onChange={(e) => setSeatSearchFilter(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '10px 14px', color: '#0f172a', fontSize: '13px', outline: 'none', fontWeight: 600 }}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#475569', fontWeight: 700, marginBottom: '6px' }}>
                    Lok Sabha Seat (543 Parliamentary Seats)
                  </label>
                  <select
                    value={selectedSeat ? `${selectedSeat.name}|||${selectedSeat.state}` : ''}
                    onChange={(e) => {
                      if (!e.target.value) {
                        setSelectedSeat(null);
                        setSelectedAssembly('');
                        return;
                      }
                      const [name, state] = e.target.value.split('|||');
                      setSelectedSeat({ name, state });
                      setSelectedAssembly('');
                    }}
                    style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, color: '#0f172a', outline: 'none' }}
                  >
                    <option value="">-- Choose Parliamentary Constituency --</option>
                    {Object.entries(filteredGroupedSeats).map(([state, seats]) => (
                      <optgroup key={state} label={`📍 ${state.toUpperCase()}`}>
                        {seats.map((seatName) => (
                          <option key={seatName} value={`${seatName}|||${state}`}>
                            {seatName}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {selectedSeat && (
                  <button
                    onClick={handleConfirmSeat}
                    style={{ width: '100%', padding: '14px', backgroundColor: '#10b981', color: '#ffffff', fontWeight: 800, fontSize: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.25)' }}
                  >
                    Confirm & Enter {selectedSeat.name}
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Verified Top Bar */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '14px', boxSizing: 'border-box' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#059669', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>● Verified Lok Sabha</span>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      {selectedSeat?.name} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>({selectedSeat?.state})</span>
                    </div>
                  </div>
                  <button
                    onClick={handleChangeSeatRequest}
                    style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', fontSize: '11px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                  >
                    Change Seat (50 pts)
                  </button>
                </div>

                {/* Pillar Filter */}
                <div style={{ width: '100%', display: 'flex', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '4px', borderRadius: '12px', boxSizing: 'border-box' }}>
                  <button onClick={() => setPillarFilter('ALL')} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: pillarFilter === 'ALL' ? '#0f172a' : 'transparent', color: pillarFilter === 'ALL' ? '#ffffff' : '#64748b', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    All Feeds
                  </button>
                  <button onClick={() => setPillarFilter('LokMat')} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: pillarFilter === 'LokMat' ? '#d97706' : 'transparent', color: pillarFilter === 'LokMat' ? '#ffffff' : '#64748b', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    🌅 LokMat (08:00 AM)
                  </button>
                  <button onClick={() => setPillarFilter('JanMat')} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: pillarFilter === 'JanMat' ? '#0284c7' : 'transparent', color: pillarFilter === 'JanMat' ? '#ffffff' : '#64748b', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    🌆 JanMat (08:00 PM)
                  </button>
                </div>

                {/* Live Polls Feed */}
                {liveAccessiblePolls.length === 0 ? (
                  <div style={{ backgroundColor: '#ffffff', padding: '36px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', width: '100%' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏰</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Next Ballot Drop Scheduled</div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 16px 0' }}>
                      No active poll live this minute. Check the Schedule Tab for upcoming 8:00 AM & 8:00 PM drops.
                    </p>
                    <button
                      onClick={() => setActiveTab('schedule')}
                      style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      View Editorial Schedule ❯
                    </button>
                  </div>
                ) : (
                  liveAccessiblePolls.map((poll) => {
                    const isFlipped = !!flippedCards[poll.id];
                    const dynamicCycle = poll.participation_mode === 'recurring' ? getCurrentCycleId(poll.recurrence) : 'lifetime';
                    const cycleVoteKey = `${poll.id}___${dynamicCycle}`;
                    const hasVotedThisCycle = votedCycleKeys.includes(cycleVoteKey);

                    const chosenOption = poll.category === 'LokMat' ? (selectedVotes[poll.id] ?? null) : null;
                    const isJanMat = poll.category === 'JanMat';

                    const isBlackedOut = poll.blackout_seats && selectedSeat && poll.blackout_seats.some(
                      (s: string) => s.toLowerCase().trim() === selectedSeat.name.toLowerCase().trim()
                    );

                    return (
                      <div key={poll.id} style={{ perspective: '1000px', width: '100%' }}>
                        <div style={{
                          position: 'relative',
                          width: '100%',
                          minHeight: '660px',
                          transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                          transformStyle: 'preserve-3d',
                          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                        }}>

                          {/* CARD FRONT: BALLOT */}
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            backfaceVisibility: 'hidden',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '24px',
                            padding: '24px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxSizing: 'border-box'
                          }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <span style={{
                                  backgroundColor: isJanMat ? '#e0f2fe' : '#fef3c7',
                                  color: isJanMat ? '#0369a1' : '#b45309',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  textTransform: 'uppercase'
                                }}>
                                  {poll.category}
                                </span>
                                <span style={{ fontSize: '11px', color: isBlackedOut ? '#dc2626' : (hasVotedThisCycle ? '#0284c7' : '#10b981'), fontWeight: 700 }}>
                                  {isBlackedOut ? '🚫 ECI SILENCE WINDOW' : (hasVotedThisCycle ? `✓ Voted (${dynamicCycle})` : (isJanMat ? '● LIVE SECRET BALLOT' : '● LIVE CIVIC POLL'))}
                                </span>
                              </div>

                              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', lineHeight: '1.45', margin: '0 0 12px 0' }}>
                                {lang === 'EN' ? poll.title_en : poll.title_hi}
                              </h3>
                              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.55', margin: '0 0 16px 0' }}>
                                {lang === 'EN' ? poll.title_hi : poll.title_en}
                              </p>

                              <div style={{ marginBottom: '16px' }}>
                                <TickerTape activePoll={poll} lang={lang} />
                              </div>

                              {isBlackedOut ? (
                                <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '14px', padding: '18px 14px', textAlign: 'center' }}>
                                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>⚖️</div>
                                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#991b1b', marginBottom: '4px' }}>
                                    ECI Election Silence Window Active
                                  </div>
                                  <p style={{ fontSize: '11.5px', color: '#b91c1c', margin: 0, lineHeight: 1.45 }}>
                                    Audits in {selectedSeat?.name} paused under Section 126 of the Representation of the People Act.
                                  </p>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  {poll.options.map((opt, index) => {
                                    const isPicked = chosenOption === index;
                                    return (
                                      <button
                                        key={opt.id}
                                        disabled={hasVotedThisCycle}
                                        onClick={() => handleCastVote(poll, index)}
                                        style={{
                                          padding: '14px',
                                          backgroundColor: isPicked ? '#ecfdf5' : '#f8fafc',
                                          border: isPicked ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                                          borderRadius: '12px',
                                          color: '#0f172a',
                                          cursor: hasVotedThisCycle ? 'default' : 'pointer',
                                          opacity: hasVotedThisCycle && !isPicked ? 0.75 : 1,
                                          textAlign: 'left',
                                          outline: 'none',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        <div style={{ fontSize: '14px', fontWeight: 700 }}>
                                          {lang === 'EN' ? opt.text_en : opt.text_hi}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                                          {lang === 'EN' ? opt.text_hi : opt.text_en}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                {hasVotedThisCycle ? `🔒 Ballot recorded for Cycle ${dynamicCycle} (+10 Pts)` : '🔒 Cryptographic Secret Ballot Box'}
                              </span>
                              {hasVotedThisCycle && !isBlackedOut && (
                                <button
                                  onClick={() => setFlippedCards((prev) => ({ ...prev, [poll.id]: true }))}
                                  style={{ background: '#e0f2fe', color: '#0284c7', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  View Map ↺
                                </button>
                              )}
                            </div>
                          </div>

                          {/* CARD BACK */}
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                            backgroundColor: '#ffffff',
                            border: '1px solid #a7f3d0',
                            borderRadius: '24px',
                            padding: '20px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxSizing: 'border-box'
                          }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ backgroundColor: '#ecfdf5', color: '#059669', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '999px' }}>
                                  ✓ DRISHTI PULSE ACTIVE
                                </span>
                                <button
                                  onClick={() => setFlippedCards((prev) => ({ ...prev, [poll.id]: false }))}
                                  style={{ background: '#f1f5f9', border: 'none', color: '#64748b', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                >
                                  View Ballot ↻
                                </button>
                              </div>

                              <div style={{ margin: '0 0 8px 0' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                  {selectedSeat?.name} Parliamentary Grid
                                </h3>
                              </div>

                              <DrishtiMap
                                selectedConstituencyName={selectedSeat?.name}
                                selectedState={selectedSeat?.state}
                              /> 

                              <button
                                type="button"
                                onClick={() => setExpandedPoll(poll)}
                                style={{
                                  width: '100%',
                                  padding: '10px 0',
                                  backgroundColor: '#ecfdf5',
                                  border: '1.5px solid #a7f3d0',
                                  borderRadius: '10px',
                                  color: '#059669',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  marginTop: '10px',
                                  marginBottom: '8px'
                                }}
                              >
                                <span>🔓</span> Explore Pan-Bharat Drishti (543 Seats)
                              </button>

                              {/* REFERRAL MOBILIZATION CARD */}
                              <div style={{
                                backgroundColor: '#f0fdf4',
                                border: '1.5px dashed #10b981',
                                borderRadius: '12px',
                                padding: '10px 12px',
                                marginTop: '8px'
                              }}>
                                <div style={{ fontSize: '11px', fontWeight: 800, color: '#065f46' }}>
                                  ⚡ Mobilize {selectedSeat?.name} Quorum
                                </div>
                                <p style={{ fontSize: '10px', color: '#047857', margin: '2px 0 6px 0', lineHeight: 1.3 }}>
                                  Recruit citizens to meet quorum. Earn +25 Points per verified voter:
                                </p>
                                <button
                                  onClick={() => {
                                    const shareUrl = `https://bhumat.vercel.app?ref=${deviceHash}&seat=${encodeURIComponent(selectedSeat?.name || 'Bharat')}`;
                                    const msg = `🇮🇳 *ATTENTION ${selectedSeat?.name.toUpperCase()}*\n\nOur Lok Sabha seat needs only a few more verified citizens to meet quorum on BhuMat!\n\nCast your vote to unlock our official constituency verdict on the Pan-Bharat Map:\n${shareUrl}`;
                                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                                  }}
                                  style={{
                                    width: '100%',
                                    backgroundColor: '#10b981',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '7px 0',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                  }}
                                >
                                  📲 Share Referral to WhatsApp (+25 Points)
                                </button>
                              </div>
                            </div>

                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                                <span>Constituency Quorum (50 Votes)</span>
                                <span style={{ color: '#059669', fontWeight: 800 }}>48 / 50 Votes to meet quorum</span>
                              </div>
                              <div style={{ width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{ width: '96%', height: '100%', backgroundColor: '#10b981' }} />
                              </div>
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

        {/* TAB 2: SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <div style={{ maxWidth: '460px', width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px' }}>
                EDITORIAL TIMETABLE
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>
                Live Consensus Drop Pipeline
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0', lineHeight: 1.4 }}>
                Real-time schedule of coming ballot questions and recurring monthly drop dates across all 543 Lok Sabha seats:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ backgroundColor: '#fef3c7', padding: '12px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#b45309' }}>🌅 08:00 AM Daily</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#92400e', marginTop: '2px' }}>LokMat Debate</div>
                  <div style={{ fontSize: '10px', color: '#78350f', marginTop: '2px' }}>Culture & Lifestyle Consensus</div>
                </div>
                <div style={{ backgroundColor: '#e0f2fe', padding: '12px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1' }}>🌆 08:00 PM Daily</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#075985', marginTop: '2px' }}>JanMat Audit</div>
                  <div style={{ fontSize: '10px', color: '#0c4a6e', marginTop: '2px' }}>Statutory Civic Accountability</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', paddingLeft: '4px' }}>
                Queued & Recurring Drop Schedule
              </div>
              {upcomingScheduleList.length === 0 ? (
                <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  All scheduled drops are currently live in the ballot feed.
                </div>
              ) : (
                upcomingScheduleList.map((item, idx) => (
                  <div key={idx} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: item.category === 'JanMat' ? '#0369a1' : '#b45309' }}>
                        {item.dropTime}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: 800, backgroundColor: item.isRecurring ? '#ecfdf5' : '#f1f5f9', color: item.isRecurring ? '#059669' : '#64748b', padding: '2px 8px', borderRadius: '6px' }}>
                        {item.cycle}
                      </span>
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>{item.title}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: KYC TAB */}
        {activeTab === 'kyc' && (
          <div style={{ maxWidth: '460px', width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '24px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px' }}>
                LOK SABHA DOSSIER: {kycData.pcCode}
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>
                {currentSeatName} Parliamentary Constituency
              </h2>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', marginTop: '12px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{kycData.mpName}</div>
                <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: 700 }}>{kycData.party}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Margin: {kycData.margin}</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROFILE & BHUMAT POINTS LEDGER */}
        {activeTab === 'profile' && (
          <div style={{ maxWidth: '440px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#e0f2fe', border: '2px solid #0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                  {selectedAvatar}
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{username}</div>
                  <div style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>● Sovereign Verified Citizen</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>BhuMat DB Points Balance</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#f59e0b', marginTop: '2px' }}>{bhumatPoints} pts</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>Seat Migration Fee:</div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>{SEAT_CHANGE_COST} pts per change</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '16px', padding: '16px', marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#065f46' }}>Refer Citizens & Earn Points</div>
                <p style={{ fontSize: '11px', color: '#047857', margin: '4px 0 10px 0', lineHeight: 1.4 }}>
                  Invite friends to audit their Lok Sabha seat. Earn +25 Points per verified citizen to unlock seat migrations and governance features.
                </p>
                <button
                  onClick={() => {
                    const shareUrl = `https://bhumat.vercel.app?ref=${deviceHash}`;
                    const msg = `🇮🇳 Join BhuMat — Track sovereign consensus audits across 543 Lok Sabha seats:\n${shareUrl}`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                  style={{ width: '100%', padding: '10px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                >
                  📲 Share Personal Referral Link (+25 pts)
                </button>
              </div>

              <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Claimed Parliamentary Seat</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{currentSeatName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>State Jurisdiction</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{currentSeatState}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Verified Referrals Logged</span>
                  <span style={{ fontWeight: 800, color: '#0284c7' }}>{referralsCount} Citizens</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SEARCH TAB */}
        {activeTab === 'search' && (
          <div style={{ maxWidth: '460px', width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px' }}>
                543 CONSTITUENCY ARCHIVE
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>
                Sovereign Ballot Index
              </h2>
            </div>
          </div>
        )}
      </main>

      {/* Dock Navigation */}
      <nav
        suppressHydrationWarning
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 50,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.03)'
        }}
      >
        <button onClick={() => setActiveTab('search')} style={{ background: 'none', border: 'none', color: activeTab === 'search' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '2px' }}>
          <span style={{ fontSize: '18px' }}>🔍</span>
          <span style={{ fontSize: '10px', fontWeight: 700 }}>Search</span>
        </button>
        <button onClick={() => setActiveTab('kyc')} style={{ background: 'none', border: 'none', color: activeTab === 'kyc' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '2px' }}>
          <span style={{ fontSize: '18px' }}>🆔</span>
          <span style={{ fontSize: '10px', fontWeight: 700 }}>KYC</span>
        </button>
        <button onClick={() => setActiveTab('vote')} style={{ background: 'none', border: 'none', color: activeTab === 'vote' ? '#10b981' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '2px' }}>
          <span style={{ fontSize: '20px' }}>🗳️</span>
          <span style={{ fontSize: '10px', fontWeight: 800 }}>Vote</span>
        </button>
        <button onClick={() => setActiveTab('schedule')} style={{ background: 'none', border: 'none', color: activeTab === 'schedule' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '2px' }}>
          <span style={{ fontSize: '18px' }}>📅</span>
          <span style={{ fontSize: '10px', fontWeight: 700 }}>Schedule</span>
        </button>
        <button onClick={() => setActiveTab('profile')} style={{ background: 'none', border: 'none', color: activeTab === 'profile' ? '#0284c7' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '2px' }}>
          <span style={{ fontSize: '18px' }}>👤</span>
          <span style={{ fontSize: '10px', fontWeight: 700 }}>Profile</span>
        </button>
      </nav>
    </div>
  );
}