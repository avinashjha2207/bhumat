'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { supabase, safeStorage } from './utils/supabaseClient';
import TickerTape from './TickerTape';
import { getCurrentCycleId } from './utils/cycleManager';
import { solvePoWChallenge } from './utils/powSolver';
import { evaluatePollSchedule } from './utils/pollScheduler';
import AuthModal from './AuthModal';
import SponsorPollModal from './SponsorPollModal';
import QuorumCelebrationModal from './QuorumCelebrationModal';
import MatParchiModal from './MatParchiModal';
import ScheduleTab from './ScheduleTab';
import SearchTab from './SearchTab';
import ProfileTab from './ProfileTab';
import CivicCarousel from './CivicCarousel';

const DrishtiMap = dynamic(() => import('./DrishtiMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '230px', backgroundColor: '#f1f5f9', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '12px' }}>
      Loading sovereign map vector...
    </div>
  )
});
const PollExpandedView = dynamic(() => import('./PollExpandedView'), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      color: '#0284c7',
      fontWeight: 800,
      fontSize: '13px'
    }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #e0f2fe', borderTopColor: '#0284c7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span>Loading 543 Sovereign Grid...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
});
const SEAT_CHANGE_COST_DBG = 1;
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
  next_starts_at?: string;
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
  'Uttar Pradesh': ['Agra', 'Aligarh', 'Allahabad', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Aonla', 'Azamgarh', 'Badaun', 'Baghpat', 'Bahraich', 'Ballia', 'Banda', 'Bansgaon', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Bulandshahr', 'Chandauli', 'Deoria', 'Dhaurahra', 'Domariyaganj', 'Etah', 'Etawah', 'Faizabad', 'Farrukhabad', 'Fatehpur', 'Fatehpur Sikri', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Ghosi', 'Gonda', 'Gorakhpur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kairana', 'Kaiserganj', 'Kannauj', 'Kanpur', 'Kaushambi', 'Kheri', 'Kushi Nagar', 'Lalganj', 'Lucknow', 'Machhlishahr', 'Mainpuri', 'Mathura', 'Meerut', 'Mirzapur', 'Misrikh', 'Mohanlalganj', 'Moradabad', 'Muzaffarnagar', 'Nagina', 'Phulpur', 'Pilibhit', 'Pratapgarh', 'Rae Bareli', 'Rampur', 'Robertsganj', 'Saharanpur', 'Salempur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shrawasti', 'Siddharthnagar', 'Sitapur', 'Sultanpur', 'Unnao', 'Varanasi'],
  'Uttarakhand': ['Almora', 'Garhwal', 'Haridwar', 'Nainital-Udhamsingh Nagar', 'Tehri Garhwal'],
  'West Bengal': ['Alipurduars', 'Arambagh', 'Asansol', 'Baharampur', 'Balurghat', 'Bangaon', 'Bankura', 'Barasat', 'Bardhaman Durgapur', 'Bardhaman Purba', 'Barrackpore', 'Basirhat', 'Birbhum', 'Bishnupur', 'Bolpur', 'Cooch Behar', 'Darjeeling', 'Diamond Harbour', 'Dum Dum', 'Ghatal', 'Hooghly', 'Howrah', 'Jadavpur', 'Jalpaiguri', 'Jangipur', 'Jaynagar', 'Jhargram', 'Kanthi', 'Kolkata Dakshin', 'Kolkata Uttar', 'Krishnanagar', 'Maldaha Dakshin', 'Maldaha Uttar', 'Mathurapur', 'Medinipur', 'Murshidabad', 'Purulia', 'Raiganj', 'Ranaghat', 'Sreerampur', 'Tamluk', 'Uluberia']
};

function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 10) return phone;
  const last10 = clean.slice(-10);
  return `+91 ***** **${last10.slice(-3)}`;
}

function maskEmailAddress(email?: string | null): string {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 3) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 3)}****${local.slice(-3)}@${domain}`;
}

function formatVotingSince(dateStr?: string, lang: 'EN' | 'HI' = 'EN'): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return lang === 'HI' ? '19 अक्टू 2026' : '19 Oct 2026';
  try {
    const day = String(d.getDate()).padStart(2, '0');
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsHi = ['जन', 'फ़र', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुला', 'अग', 'सितं', 'अक्टू', 'नव', 'दिसं'];
    const m = lang === 'HI' ? monthsHi[d.getMonth()] : monthsEn[d.getMonth()];
    return `${day} ${m} ${d.getFullYear()}`;
  } catch (e) {
    return lang === 'HI' ? '19 अक्टू 2026' : '19 Oct 2026';
  }
}

function resolveCivicRecognitionTier(monthlyVotes: number): { title: string; color: string; level: number } {
  if (monthlyVotes >= 55) return { title: '👑 Sovereign Ratna (Level 5)', color: '#8b5cf6', level: 5 };
  if (monthlyVotes >= 40) return { title: '⚖️ Rashtriya Nirdharak (Level 4)', color: '#0284c7', level: 4 };
  if (monthlyVotes >= 25) return { title: '🛡️ Lok Prahari (Level 3)', color: '#10b981', level: 3 };
  if (monthlyVotes >= 10) return { title: '🏛️ Jagruk Nagrik (Level 2)', color: '#d97706', level: 2 };
  return { title: '🌱 Prathamik Nagrik (Level 1)', color: '#64748b', level: 1 };
}

function getOrCreateVoterToken(): string {
  let token = safeStorage.getItem('bhumat_voter_token');
  if (!token && typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|; )bhumat_voter_token=([^;]*)/);
    if (match && match[1]) {
      token = decodeURIComponent(match[1]);
      safeStorage.setItem('bhumat_voter_token', token);
    }
  }
  if (!token) {
    token = 'bn_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    safeStorage.setItem('bhumat_voter_token', token);
  }
  if (typeof document !== 'undefined') {
    document.cookie = `bhumat_voter_token=${encodeURIComponent(token)}; path=/; max-age=31536000; SameSite=Lax`;
  }
  return token;
}

export default function BhuMatApp() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const isSubmittingVoteRef = useRef(false);
  const [activePlayingPollId, setActivePlayingPollId] = useState<string | null>(null);
  const [matParchiState, setMatParchiState] = useState<{
    isOpen: boolean;
    pollId: string;
    pollTitle: string;
    pollCategory: string;
    options: any[];
    selectedOptionText: string;
    seatName: string;
    stateName: string;
  }>({
    isOpen: false,
    pollId: '',
    pollTitle: '',
    pollCategory: 'LokMat',
    options: [],
    selectedOptionText: '',
    seatName: '',
    stateName: ''
  });
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const pollCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Stop audio immediately when the currently playing poll scrolls out of view
  useEffect(() => {
    if (!activePlayingPollId || typeof IntersectionObserver === 'undefined') return;
    const activeEl = pollCardRefs.current[activePlayingPollId];
    if (!activeEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.35) {
          if (activeAudioRef.current) {
            activeAudioRef.current.pause();
            activeAudioRef.current = null;
          }
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          setActivePlayingPollId(null);
        }
      },
      { threshold: [0.35] }
    );

    observer.observe(activeEl);
    return () => observer.disconnect();
  }, [activePlayingPollId]);

  const togglePollAudio = (poll: Poll, e?: React.MouseEvent) => { if (e) e.stopPropagation();

    // 1. If currently playing this poll, stop it
    if (activePlayingPollId === poll.id) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setActivePlayingPollId(null);
      return;
    }

    // 2. Stop any prior playing audio
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const audioUrl = (poll as any)[lang === 'HI' ? 'audio_url_hi' : 'audio_url_en'];

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      setActivePlayingPollId(poll.id);
      audio.play().catch(() => setActivePlayingPollId(null));
      audio.onended = () => {
        setActivePlayingPollId(null);
        activeAudioRef.current = null;
      };
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Zero-latency native fallback
      const textToRead = lang === 'HI'
        ? `${poll.title_hi}. विकल्प: ${poll.options.map((o, i) => `विकल्प ${i + 1}: ${o.text_hi}`).join('. ')}`
        : `${poll.title_en}. Options: ${poll.options.map((o, i) => `Option ${i + 1}: ${o.text_en}`).join('. ')}`;

      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.lang = lang === 'HI' ? 'hi-IN' : 'en-IN';
      utterance.rate = 0.95;
      utterance.onend = () => setActivePlayingPollId(null);
      utterance.onerror = () => setActivePlayingPollId(null);

      setActivePlayingPollId(poll.id);
      window.speechSynthesis.speak(utterance);
    }
  };
  const [activeTab, setActiveTab] = useState<'search' | 'vote' | 'schedule' | 'profile'>('vote');
  const [scheduleViewMode, setScheduleViewMode] = useState<'OVERVIEW' | 'CALENDAR'>('OVERVIEW');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number>(() => new Date().getDate());
  const [scheduleCategoryFilter, setScheduleCategoryFilter] = useState<'ALL' | 'LokMat' | 'JanMat'>('ALL');
  const [showCalendarView, setShowCalendarView] = useState<boolean>(false);
  const [scheduleMonthOffset, setScheduleMonthOffset] = useState<number>(0); // 0 = current running month, 1 = next month
  const [lang, setLang] = useState<'EN' | 'HI'>('EN');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'ALL' | 'JanMat' | 'LokMat'>('ALL');
  const [toast, setToast] = useState<{ msg: string; x: number; y: number } | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{ title: string; desc: string; x: number; y: number } | null>(null);
  const infoPopupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [expandedPoll, setExpandedPoll] = useState<Poll | null>(null);
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [username, setUsername] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return safeStorage.getItem('bhumat_username') || 'CitizenBharat';
    }
    return 'CitizenBharat';
  });
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [dbgPoints, setDbgPoints] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const isVerified = Boolean(
      safeStorage.getItem('bhumat_user_phone') || 
      safeStorage.getItem('bhumat_user_email')
    );
    if (!isVerified) return 0;
    const saved = safeStorage.getItem('bhumat_dbg_balance');
    return saved !== null && !isNaN(Number(saved)) ? Number(saved) : 5;
  });
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    requiredFor: 'JanMat' | 'LokMat' | 'General';
    pendingVote?: { poll: Poll; optionIdx: number };
  }>({ isOpen: false, requiredFor: 'General' });
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);
  const [showFirstTimeTip, setShowFirstTimeTip] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return safeStorage.getItem('bhumat_dismissed_welcome_tip') !== 'true';
    }
    return false;
  });
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
  const [linkedEmail, setLinkedEmail] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? safeStorage.getItem('bhumat_user_email') : null;
  });

  async function fetchLedger(token: string) {
    try {
      const activeToken = token || deviceHash;
      let { data } = await supabase
        .from('dbg_point_ledger')
        .select('*')
        .eq('voter_token', activeToken)
        .order('created_at', { ascending: false });

      // If user has 5 DBG but no rows logged yet, seed the genesis grant row
      if ((!data || data.length === 0) && dbgPoints >= 5) {
        data = [
          {
            id: 'genesis-welcome',
            description: lang === 'HI' ? 'नागरिक सत्यापन स्वागत बोनस' : 'Genesis Welcome Grant (Verified Citizen)',
            delta: 5,
            created_at: new Date().toISOString()
          }
        ];
      }
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
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [showQuorumModal, setShowQuorumModal] = useState(false);
  const [seatDossier, setSeatDossier] = useState<any | null>(null);
  const [tentativeSeat, setTentativeSeat] = useState<{ name: string; state: string } | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isChangeSeatModalOpen, setIsChangeSeatModalOpen] = useState(false);
  const [seatSearchInput, setSeatSearchInput] = useState('');
  const [pollSearchQuery, setPollSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [cachedTalliesByPoll, setCachedTalliesByPoll] = useState<Record<string, any[]>>({});
  const [stateBastionsByPoll, setStateBastionsByPoll] = useState<Record<string, any[]>>({});
  const [flippedOverrides, setFlippedOverrides] = useState<Record<string, boolean>>({});
  const [autoFlippedCards, setAutoFlippedCards] = useState<Record<string, boolean>>({});

  const observeVotedCard = (node: HTMLDivElement | null, pollId: string, hasVoted: boolean) => {
    if (!node || !hasVoted || autoFlippedCards[pollId] || flippedOverrides[pollId] !== undefined) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            setAutoFlippedCards((prev) => ({ ...prev, [pollId]: true }));
          }, 5000);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(node);
  };

  const [sessionBallotChoices, setSessionBallotChoices] = useState<Record<string, number>>({});
  const [votedCycleKeys, setVotedCycleKeys] = useState<string[]>([]);
  const [voteTimestamps, setVoteTimestamps] = useState<Record<string, string>>({});
  const [turfStandings, setTurfStandings] = useState<any[]>([]);

  const fetchSeatDossier = async (seatName: string, stateName: string) => {
    try {
      const cleanSeat = seatName.trim();
      const cleanState = stateName.trim();

      // Query the unified view v_pc_dossier with resilient punctuation matching
      let { data, error } = await supabase
        .from('v_pc_dossier')
        .select('*')
        .ilike('pc_name', cleanSeat)
        .maybeSingle();

      if (!data) {
        // Fallback for hyphen vs dash variations (e.g. Janjgir-Champa)
        const strippedName = cleanSeat.replace(/[^a-zA-Z0-9]/g, '');
        const { data: allDossiers } = await supabase.from('v_pc_dossier').select('*');
        data = allDossiers?.find((d: any) => d.pc_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === strippedName.toLowerCase()) || null;
      }

      if (error || !data) {
        console.warn('View fetch fallback, trying pc_number/name match:', error?.message);
      }

      setSeatDossier({
        ...data,
        pc_number: data?.pc_number || 1,
        incumbent_mp: data?.incumbent_mp || null,
        incumbent_party: data?.incumbent_party || null,
        winning_margin: data?.winning_margin || null,
        winning_margin_pct: data?.winning_margin_pct || null,
        turnout_pct: data?.turnout_pct || null,
        total_electors: data?.total_electors || 1750000,
        reservation_status: data?.reservation_status || 'GEN',
        assembly_segments: (data?.assembly_segments && Array.isArray(data.assembly_segments))
          ? data.assembly_segments.map((ac: any) => ({
              no: ac.no,
              name: lang === 'HI' && ac.name_hi ? ac.name_hi : ac.name,
              reservation: ac.reservation || 'GEN'
            }))
          : []
      });
    } catch (err) {
      console.error('Failed to load dossier from v_pc_dossier:', err);
    }
  };

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
    setActiveCategoryFilter('ALL');
    setPollSearchQuery('');
    setAutoFlippedCards({});
    setFlippedOverrides({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadPolls();
    setTimeout(() => {
      const flippedMap: Record<string, boolean> = {};
      votedCycleKeys.forEach((key) => {
        const pId = key.split('___')[0];
        flippedMap[pId] = true;
      });
      setAutoFlippedCards(flippedMap);
    }, 5000);
  };

  useEffect(() => {
    if (activeTab === 'search') {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  }, [activeTab]);

  // Listen for hardware/gesture back events to smoothly dismiss the full-map modal
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If modal was open and user swiped or pressed system Back, dismiss expanded view
      setExpandedPoll(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openExpandedView = async (poll: Poll) => {
    const dynamicCycle = (poll.participation_mode === 'recurring' && poll.recurrence !== 'expiry')
      ? getCurrentCycleId(poll.recurrence, poll.starts_at) 
      : 'lifetime';
    const cycleVoteKey = `${poll.id}___${dynamicCycle}`;
    
    const hasVoted = votedCycleKeys.includes(cycleVoteKey) || 
      (poll.participation_mode === 'one_time' && votedCycleKeys.some(k => k.startsWith(`${poll.id}___`)));
    if (!hasVoted) {
      showPointerToast(
        lang === 'HI'
          ? '🔒 परिणाम देखने हेतु पहले अपना मत दर्ज करें!'
          : '🔒 Cast your ballot first to unlock consensus results for this cycle!'
      );
      setActiveTab('vote');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    try {
      const { data } = await supabase
        .from('constituency_tallies')
        .select('*')
        .eq('poll_id', poll.id);
      if (data) {
        setCachedTalliesByPoll((prev) => ({ ...prev, [poll.id]: data }));
      }
    } catch (e) {}

    // Push history state so Android/iOS back swipe dismisses the modal gracefully
    if (typeof window !== 'undefined') {
      window.history.pushState({ modal: 'expanded' }, '');
    }
    setExpandedPoll(poll);
  };

  const closeExpandedView = () => {
    if (typeof window !== 'undefined' && window.history.state?.modal === 'expanded') {
      window.history.back();
    } else {
      setExpandedPoll(null);
    }
  };

  async function syncWallet(token: string) {
    try {
      const isVerifiedUser = Boolean(
        safeStorage.getItem('bhumat_user_phone') || 
        safeStorage.getItem('bhumat_user_email')
      );

      // 1. GUEST SAFETY GUARD: Unverified guests strictly hold 0 DBG
      if (!isVerifiedUser) {
        setDbgPoints(0);
        return;
      }

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

      // 2. VERIFIED CITIZEN: Read directly from nagrik_profiles
      const { data: profile } = await supabase
        .from('nagrik_profiles')
        .select('dbg_balance, phone_number, email')
        .eq('voter_token', activeToken)
        .maybeSingle();

      if (profile) {
        const verifiedDbg = profile.dbg_balance !== undefined && profile.dbg_balance !== null ? profile.dbg_balance : 5;
        setDbgPoints(verifiedDbg);
        safeStorage.setItem('bhumat_dbg_balance', String(verifiedDbg));
      }

      // Fetch accurate count of verified LokMat votes directly from database
  const { count: actualLokMatCount } = await supabase
    .from('lokmat_votes')
    .select('*', { count: 'exact', head: true })
    .eq('voter_token', activeToken);

  // Fetch accurate count of JanMat secret audit participation (Table A)
  const { count: actualJanMatCount } = await supabase
    .from('janmat_blind_participation_receipts')
    .select('*', { count: 'exact', head: true })
    .eq('voter_token', activeToken);

  const verifiedLokMat = typeof actualLokMatCount === 'number' ? actualLokMatCount : localLokMat;
      const verifiedJanMat = typeof actualJanMatCount === 'number' ? actualJanMatCount : localJanMat;
      const verifiedTotal = verifiedLokMat + verifiedJanMat;
      setLokmatPollsCount(verifiedLokMat);
      setJanmatAuditsCount(verifiedJanMat);
      setTotalVotesCount(verifiedTotal);
      setMonthlyVotesCount(verifiedTotal);
    } catch (e) {
      console.warn('Wallet fetch error:', e);
    }
  }

  useEffect(() => {
    setMounted(true);
    const token = getOrCreateVoterToken();
    setDeviceHash(token);
    syncWallet(token);
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
          // Read incoming deep-linked seat from WhatsApp share
      const deepSeat = urlParams.get('seat');
      if (deepSeat && !safeStorage.getItem('bhumat_user_seat')) {
        const cleanDeepSeat = deepSeat.trim();
        // Check if seat exists in grouped list
        Object.entries(GROUPED_PARLIAMENTARY_SEATS).forEach(([st, seats]) => {
          if (seats.some(s => s.toLowerCase() === cleanDeepSeat.toLowerCase())) {
            const exactSeat = seats.find(s => s.toLowerCase() === cleanDeepSeat.toLowerCase()) || cleanDeepSeat;
            setSelectedSeat({ name: exactSeat, state: st });
            setIsConfirmed(true);
            safeStorage.setItem('bhumat_user_seat', exactSeat);
            safeStorage.setItem('bhumat_user_state', st);
          }
        });
      }

      // Read incoming deep-linked poll from WhatsApp share and scroll into view
      const deepPollId = urlParams.get('poll');
      if (deepPollId) {
        setTimeout(() => {
          const targetCard = document.getElementById(`poll-card-${deepPollId}`);
          if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
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
      try {
        if (savedCycles && savedCycles !== 'undefined') {
          const parsed = JSON.parse(savedCycles);
          if (Array.isArray(parsed)) setVotedCycleKeys(parsed);
        }
      } catch (err) {
        console.warn('Recovered from invalid savedCycles cache');
      }
      try {
        if (savedChoices && savedChoices !== 'undefined') {
          const parsed = JSON.parse(savedChoices);
          if (parsed && typeof parsed === 'object') setSessionBallotChoices(parsed);
        }
      } catch (err) {
        console.warn('Recovered from invalid savedChoices cache');
      }
      try {
        if (savedTimestamps && savedTimestamps !== 'undefined') {
          const parsed = JSON.parse(savedTimestamps);
          if (parsed && typeof parsed === 'object') setVoteTimestamps(parsed);
        }
      } catch (err) {
        console.warn('Recovered from invalid savedTimestamps cache');
      }
    } catch (e) {}

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration skipped:', err);
      });
    }

    // Cleanup audio when component unmounts
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
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
          current_cycle: d.participation_mode === 'recurring' 
            ? getCurrentCycleId(d.recurrence || 'monthly', d.starts_at)
            : (d.current_cycle || 'lifetime'),
          recurrence: d.recurrence || 'monthly',
          is_active: d.is_active !== false,
          next_starts_at: d.next_starts_at || undefined,
          options: d.options || [
            { id: 0, text_en: 'Option 1', text_hi: 'विकल्प 1' },
            { id: 1, text_en: 'Option 2', text_hi: 'विकल्प 2' }
          ]
        }));
        data.forEach((p: any) => {
          // Fetch national tallies for each active poll
          supabase
            .from('constituency_tallies')
            .select('*')
            .eq('poll_id', p.id)
            .then(({ data: tData }) => {
              if (tData && tData.length > 0) {
                setCachedTalliesByPoll((prev) => ({ ...prev, [p.id]: tData }));
              }
            });

          if (selectedSeat?.state) {
            supabase.rpc('get_state_top_bastions', {
              p_poll_id: p.id,
              p_state_name: selectedSeat.state
            }).then(({ data: bastions }) => {
              if (bastions && Array.isArray(bastions) && bastions.length > 0) {
                setStateBastionsByPoll((prev) => ({ ...prev, [p.id]: bastions }));
              }
            });
          }
        });
        setPolls(formatted);
      }
    } catch (err) {}
  }

  useEffect(() => {
    loadPolls();
    const feedRealtimeChannel = supabase
      .channel(`global_feed_sync_${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'constituency_tallies'
        },
        (payload: any) => {
          const updated = payload.new;
          if (!updated || !updated.poll_id) return;
          setCachedTalliesByPoll((prev) => {
            const currentList = prev[updated.poll_id] || [];
            const idx = currentList.findIndex(
              (t: any) => t.constituency_name?.toLowerCase() === updated.constituency_name?.toLowerCase()
            );
            if (idx >= 0) {
              const next = [...currentList];
              next[idx] = updated;
              return { ...prev, [updated.poll_id]: next };
            }
            return { ...prev, [updated.poll_id]: [...currentList, updated] };
          });
          if (selectedSeat?.state && updated.state_name?.toLowerCase() === selectedSeat.state.toLowerCase()) {
            supabase.rpc('get_state_top_bastions', {
              p_poll_id: updated.poll_id,
              p_state_name: selectedSeat.state
            }).then(({ data: bastions }) => {
              if (bastions && Array.isArray(bastions)) {
                setStateBastionsByPoll((prev) => ({ ...prev, [updated.poll_id]: bastions }));
              }
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(feedRealtimeChannel);
    };
  }, [selectedSeat?.state]);

  const handleConfirmSeat = async () => {
    if (!tentativeSeat) return;

    // A. INITIAL FIRST-TIME SEAT ENROLLMENT (Entering App)
    if (!isConfirmed) {
      setSelectedSeat(tentativeSeat);
      setIsConfirmed(true);
      safeStorage.setItem('bhumat_user_seat', tentativeSeat.name);
      safeStorage.setItem('bhumat_user_state', tentativeSeat.state);
      setTentativeSeat(null);
      showPointerToast(lang === 'HI' ? `✓ ${tentativeSeat.name} संसदीय क्षेत्र चयनित!` : `✓ ${tentativeSeat.name} seat selected!`);
      return;
    }

    // B. SEAT CHANGE REQUEST
    const isCitizenVerified = Boolean(
      (safeStorage.getItem('bhumat_user_phone')?.trim()) || 
      (safeStorage.getItem('bhumat_user_email')?.trim()) ||
      (linkedPhone && linkedPhone.trim() !== '') || 
      (linkedEmail && linkedEmail.trim() !== '')
    );

    // 1. GUEST USER INTERCEPT: Block unverified guests and offer 5 DBG welcome bonus
    if (!isCitizenVerified) {
      setIsChangeSeatModalOpen(false);
      showPointerToast(
        lang === 'HI'
          ? '🔒 सीट बदलने और 5 DBG स्वागत बोनस पाने के लिए साइन अप करें!'
          : '🔒 Signup to change seat and get 5 DBG as welcome bonus to participate in sovereign voting!'
      );
      setTimeout(() => {
        setAuthModalState({ isOpen: true, requiredFor: 'General' });
      }, 350);
      return;
    }

    // 2. VERIFIED CITIZEN SHIFT: Deducts 1 DBG
    try {
      const activeToken = deviceHash || safeStorage.getItem('bhumat_voter_token') || getOrCreateVoterToken();

      const { data: profile, error: profErr } = await supabase
        .from('nagrik_profiles')
        .select('dbg_balance, assigned_pc_id')
        .eq('voter_token', activeToken)
        .maybeSingle();

      if (profErr || !profile) {
        showPointerToast(lang === 'HI' ? 'सत्यापित प्रोफ़ाइल नहीं मिली।' : 'Verified citizen profile not found.');
        return;
      }

      if ((profile.dbg_balance ?? 0) < 1) {
        showPointerToast(lang === 'HI' ? 'सीट बदलने के लिए 1 DBG आवश्यक है।' : '1 DBG required to shift seat. Insufficient balance.');
        return;
      }

      // Deduct 1 DBG
      const { error: updateErr } = await supabase
        .from('nagrik_profiles')
        .update({
          assigned_pc_id: tentativeSeat.name,
          dbg_balance: (profile.dbg_balance ?? 1) - 1,
          updated_at: new Date().toISOString()
        })
        .eq('voter_token', activeToken);

      if (updateErr) {
        showPointerToast('Seat shift failed: ' + updateErr.message);
        return;
      }

      await supabase.from('dbg_point_ledger').insert({
        voter_token: activeToken,
        delta: -1,
        description: `Seat shifted to ${tentativeSeat.name}`,
        created_at: new Date().toISOString()
      });

      setSelectedSeat(tentativeSeat);
      safeStorage.setItem('bhumat_user_seat', tentativeSeat.name);
      safeStorage.setItem('bhumat_user_state', tentativeSeat.state);
      setDbgPoints((prev) => Math.max(0, prev - 1));
      safeStorage.setItem('bhumat_dbg_balance', String(Math.max(0, dbgPoints - 1)));
      setIsChangeSeatModalOpen(false);
      setTentativeSeat(null);
      showPointerToast(
        lang === 'HI'
          ? `संसदीय सीट बदलकर ${tentativeSeat.name} कर दी गई (-1 DBG)`
          : `Parliamentary seat shifted to ${tentativeSeat.name} (-1 DBG)`
      );
    } catch (err: any) {
      console.error('Error shifting seat:', err);
      showPointerToast('Shift error: ' + (err?.message || 'Transaction aborted'));
    }
  };

  const getFrequencyRevoteMessage = (recurrence?: string, isOneTime?: boolean) => {
    if (isOneTime) {
      return lang === 'HI'
        ? '🔒 एक नागरिक • एक मत: आप इस प्रश्न पर अपना मत पहले ही दर्ज कर चुके हैं।'
        : '🔒 One Person • One Vote: You have already voted on this poll.';
    }
    const rec = (recurrence || 'monthly').toLowerCase();
    if (rec.includes('day')) {
      return lang === 'HI'
        ? '🔒 इस चक्र का मत दर्ज है। सीट बदलने पर भी अगला मत कल नए चक्र में ही मान्य होगा।'
        : '🔒 Cycle Ballot Recorded: Re-voting unlocks tomorrow for your active seat.';
    }
    if (rec.includes('week')) {
      return lang === 'HI'
        ? '🔒 इस साप्ताहिक चक्र का मत दर्ज है। अगला मत नए चक्र में आपकी नई सीट हेतु मान्य होगा।'
        : '🔒 Cycle Ballot Recorded: Re-voting unlocks next week for your active seat.';
    }
    return lang === 'HI'
      ? '🔒 एक नागरिक • एक मत: आप इस चक्र में मतदान कर चुके हैं। सीट परिवर्तन अगले चक्र से प्रभावी होगा।'
      : '🔒 One Citizen • One Vote: You already voted this cycle. Seat change applies from next cycle.';
  };

  const executeCastBallot = async (
  poll: Poll, 
  optionIdx: number, 
  e?: React.MouseEvent | React.TouchEvent, 
  overrideToken?: string,
  forceVerified?: boolean
) => {
  if (!selectedSeat) return;
  const activeVoterToken = overrideToken || deviceHash || safeStorage.getItem('bhumat_voter_token') || getOrCreateVoterToken();
  const dynamicCycle = poll.participation_mode === 'recurring' ? getCurrentCycleId(poll.recurrence, poll.starts_at) : 'lifetime';
  const cycleVoteKey = `${poll.id}___${dynamicCycle}`;
  const choiceKey = `${poll.id}___${dynamicCycle}`;
  
  const storedCyclesRaw = safeStorage.getItem('bhumat_voted_cycles');
  const storedCycles: string[] = storedCyclesRaw ? JSON.parse(storedCyclesRaw) : [];
  
  if (votedCycleKeys.includes(cycleVoteKey) || storedCycles.includes(cycleVoteKey)) {
    const isOneTime = poll.participation_mode === 'one_time';
    showPointerToast(getFrequencyRevoteMessage(poll.recurrence, isOneTime), e);
    return;
  }
  // Ensure stuck locks auto-clear if a previous promise or network call stalled
    if (isSubmittingVoteRef.current) {
      console.warn('Submission throttled: previous vote in-flight.');
      return;
    }
    isSubmittingVoteRef.current = true;

    // Safety fallback: Release the mutex after 2.5 seconds no matter what
    const lockTimer = setTimeout(() => {
      isSubmittingVoteRef.current = false;
    }, 2500);
  
  const updatedKeys = [...new Set([...votedCycleKeys, ...storedCycles, cycleVoteKey])];
  setVotedCycleKeys(updatedKeys);
  try {
    safeStorage.setItem('bhumat_voted_cycles', JSON.stringify(updatedKeys));
  } catch (err) {}
  try {
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
    
    // Check verification status, respecting forceVerified on immediate elevation
    const isUserVerified = forceVerified || Boolean(
      safeStorage.getItem('bhumat_user_phone')?.trim() ||
      safeStorage.getItem('bhumat_user_email')?.trim() ||
      (linkedPhone && linkedPhone.trim() !== '') ||
      (linkedEmail && linkedEmail.trim() !== '')
    );

    if (!isUserVerified) {
      const nextCount = guestVotesCast + 1;
      setGuestVotesCast(nextCount);
      safeStorage.setItem('bhumat_guest_vote_count', String(nextCount));
      const xpGained = poll.category === 'JanMat' ? '+20 XP' : '+10 XP';
      if (nextCount < 3) {
        showPointerToast(lang === 'HI' ? `✓ मत दर्ज! ${xpGained} • अतिथि ${nextCount} / 3` : `✓ Ballot logged! ${xpGained} • Guest ${nextCount} of 3`, e);
      } else {
        showPointerToast(lang === 'HI' ? `✓ तीसरा अतिथि मत दर्ज! अंक सुरक्षित करने हेतु साइन अप करें।` : `✓ 3rd Guest Ballot Cast! SignUp to lock points.`, e);
      }
    } else {
      const xpGained = poll.category === 'JanMat' ? '+20 XP' : '+10 XP';
      showPointerToast(lang === 'HI' ? `✓ ${selectedSeat.name} हेतु नागरिक मत दर्ज! ${xpGained}` : `✓ Verified Citizen ballot logged for ${selectedSeat.name}! ${xpGained}`, e);
    }
      try {
        safeStorage.setItem('bhumat_vote_timestamps', JSON.stringify(updatedTimestamps));
        safeStorage.setItem('bhumat_voted_polls', JSON.stringify(updatedChoices));
      } catch (err) {}
      const currentDynamicSeason = getCurrentCycleId('monthly');
      try {
        const { data: gData } = await supabase.rpc('record_vote_gamification', {
          p_voter_token: deviceHash,
          p_category: poll.category,
          p_state_name: selectedSeat.state,
          p_constituency_name: selectedSeat.name,
          p_season_id: currentDynamicSeason
        });
        if (gData?.streak) {
          safeStorage.setItem('bhumat_daily_streak', String(gData.streak));
        }
        if (gData?.dbg_awarded > 0) {
          showPointerToast(`🎉 7-Day Continuous Participation: +1 DBG Awarded!`, e);
        }
        setProfileRefreshKey((prev) => prev + 1);
      } catch (err) {
        console.warn('Gamification XP logging error:', err);
      }
      let challengeId: string | null = null;
      let solvedNonce: string | null = null;
      try {
        const { data: challengeData } = await supabase.rpc('get_ballot_challenge', {
          p_voter_token: deviceHash,
          p_poll_id: poll.id
        });
        if (challengeData?.success) {
          challengeId = challengeData.challenge_id;
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

      if (poll.blackout_seats && poll.blackout_seats.includes(selectedSeat.name)) {
        showPointerToast(
          lang === 'HI'
            ? '🏛️ ECI धारा 126: इस संसदीय क्षेत्र में 48 घंटे का मौन काल प्रभावी है।'
            : '🏛️ ECI Section 126: Statutory 48-hour silence period active for this seat.'
        );
        return;
      }

      const { data: ballotResult, error: ballotError } = await supabase.rpc('cast_ballot_transaction', {
        p_poll_id: poll.id,
        p_category: poll.category,
        p_cycle_id: dynamicCycle,
        p_pc_name: selectedSeat.name,
        p_state_name: selectedSeat.state,
        p_selected_option: optionIdx,
        p_voter_token: activeVoterToken
      });
      if (ballotError || (ballotResult && ballotResult.success === false)) {
        const errorMsg = ballotError?.message || ballotResult?.message || (lang === 'HI' ? 'मतदान दर्ज नहीं हो सका' : 'Ballot submission failed');
        showPointerToast(`⚠️ ${errorMsg}`, e);

        if (ballotResult?.votes_added && selectedSeat) {
          supabase
            .from('constituency_tallies')
            .select('total_votes')
            .eq('poll_id', poll.id)
            .eq('constituency_name', selectedSeat.name)
            .maybeSingle()
            .then(({ data: tData }) => {
              if (tData && tData.total_votes === 50) {
                setShowQuorumModal(true);
              }
            });
        }

        const rollbackKeys = votedCycleKeys.filter((k) => k !== cycleVoteKey);
        setVotedCycleKeys(rollbackKeys);
        try {
          safeStorage.setItem('bhumat_voted_cycles', JSON.stringify(rollbackKeys));
        } catch (err) {}
        return;
      }
      // Optimistic In-Memory Tally Update (+1 vote jump for immediate UI reactivity)
      setCachedTalliesByPoll((prev) => {
        const currentList = prev[poll.id] || [];
        const optKey = `opt_${optionIdx}_votes`;
        const optKeyAlt = `opt_${optionIdx}_count`;
        const seatNameNorm = selectedSeat.name.toLowerCase().trim();

        const seatIdx = currentList.findIndex(
          (t: any) =>
            (t.constituency_name && t.constituency_name.toLowerCase().trim() === seatNameNorm) ||
            (t.pc_name && t.pc_name.toLowerCase().trim() === seatNameNorm)
        );

        if (seatIdx >= 0) {
          const updatedItem = { ...currentList[seatIdx] };
          updatedItem.total_votes = (Number(updatedItem.total_votes || updatedItem.total_ballots) || 0) + 1;
          updatedItem.total_ballots = updatedItem.total_votes;
          updatedItem[optKey] = (Number(updatedItem[optKey] ?? updatedItem[optKeyAlt]) || 0) + 1;
          updatedItem[optKeyAlt] = updatedItem[optKey];
          const nextList = [...currentList];
          nextList[seatIdx] = updatedItem;
          return { ...prev, [poll.id]: nextList };
        } else {
          const newItem = {
            poll_id: poll.id,
            constituency_name: selectedSeat.name,
            state_name: selectedSeat.state,
            total_votes: 1,
            total_ballots: 1,
            [optKey]: 1,
            [optKeyAlt]: 1,
            leading_option_id: optionIdx
          };
          return { ...prev, [poll.id]: [...currentList, newItem] };
        }
      });
      try {
        const { data: refReward } = await supabase.rpc('check_and_reward_referral', {
          p_voter_token: activeVoterToken,
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
      syncWallet(activeVoterToken);
    } finally {
      clearTimeout(lockTimer);
      setTimeout(() => {
        isSubmittingVoteRef.current = false;
      }, 400);
    }
  };

  const handleCastVote = async (poll: Poll, optionIdx: number, e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      if ('preventDefault' in e && typeof e.preventDefault === 'function') e.preventDefault();
      if ('stopPropagation' in e && typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    // Immediately stop any active audio readout whenever an option is tapped
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setActivePlayingPollId(null);
    if (!selectedSeat) return;
    const dynamicCycle = (poll.participation_mode === 'recurring' && poll.recurrence !== 'expiry')
      ? getCurrentCycleId(poll.recurrence, poll.starts_at)
      : (poll.current_cycle || 'lifetime');
    const cycleVoteKey = `${poll.id}___${dynamicCycle}`;
    if (votedCycleKeys.includes(cycleVoteKey)) {
      const isOneTime = poll.participation_mode === 'one_time';
      showPointerToast(getFrequencyRevoteMessage(poll.recurrence, isOneTime), e);
      return;
    }

    const isJanMat = poll.category === 'JanMat';
    const isCitizenVerified = Boolean(
      (linkedPhone && linkedPhone.trim() !== '') || 
      (linkedEmail && linkedEmail.trim() !== '')
    );

    // 1. JanMat is STRICT: Guests can never vote on JanMat without signup
    if (isJanMat && !isCitizenVerified) {
      showPointerToast(
        lang === 'HI'
          ? '🔒 जनमत गोपनीय ऑडिट में मतदान के लिए नागरिक सत्यापन आवश्यक है।'
          : '🔒 Citizen verification required to participate in JanMat secret audits.',
        e
      );
      setAuthModalState({
        isOpen: true,
        requiredFor: 'JanMat',
        pendingVote: { poll, optionIdx }
      });
      return;
    }

    // 2. LokMat Guest Quota: 3 votes max before requiring signup
    if (!isCitizenVerified && guestVotesCast >= 3) {
      showPointerToast(
        lang === 'HI'
          ? '🔒 आपने 3 अतिथि मत पूरे कर लिए हैं! आजीवन मतदान हेतु साइन अप करें।'
          : "🔒 You've used your 3 guest votes! SignUp to continue participating.",
        e
      );
      setAuthModalState({
        isOpen: true,
        requiredFor: 'LokMat',
        pendingVote: { poll, optionIdx }
      });
      return;
    }

    executeCastBallot(poll, optionIdx, e);
  };

  const { livePollsList, scheduledQueueList } = useMemo(() => {
    const live: Poll[] = [];
    const upcoming: Poll[] = [];
    polls.forEach((p) => {
      const schedule = evaluatePollSchedule(p);
      if (schedule.isCurrentlyLive) {
        live.push(p);
      } else {
        upcoming.push(p);
      }
    });
    return { livePollsList: live, scheduledQueueList: upcoming };
  }, [polls]);

  const liveAccessiblePolls = useMemo(() => {
    return livePollsList.filter((p) => {
      if (activeCategoryFilter === 'JanMat' && p.category !== 'JanMat') return false;
      if (activeCategoryFilter === 'LokMat' && p.category !== 'LokMat') return false;
      if (p.target_region_type === 'CUSTOM_SEATS' && Array.isArray(p.target_seats) && p.target_seats.length > 0) {
        if (selectedSeat && !p.target_seats.includes(selectedSeat.name)) {
          return false;
        }
      }
      return true;
    });
  }, [livePollsList, activeCategoryFilter, selectedSeat]);

  const allFlattenedSeats = useMemo(() => {
    const list: Array<{ name: string; state: string }> = [];
    Object.entries(GROUPED_PARLIAMENTARY_SEATS).forEach(([state, seats]) => {
      seats.forEach((seat) => list.push({ name: seat, state }));
    });
    return list;
  }, []);

  const searchPollMatches = useMemo(() => {
    let list = polls;
    if (activeCategoryFilter === 'JanMat') list = list.filter((p) => p.category === 'JanMat');
    if (activeCategoryFilter === 'LokMat') list = list.filter((p) => p.category === 'LokMat');
    if (!pollSearchQuery.trim()) return list;
    const q = pollSearchQuery.toLowerCase().trim();
    const searchTokens = q.split(/\s+/).filter(Boolean);
    return list.filter((p) => {
      const combined = `${p.title_en} ${p.title_hi} ${p.category} ${p.options?.map((o: any) => `${o.text_en}${o.text_hi}`).join(' ')}`.toLowerCase();
      return searchTokens.every(token => combined.includes(token));
    });
  }, [pollSearchQuery, polls, activeCategoryFilter]);

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

  const recognitionTier = resolveCivicRecognitionTier(monthlyVotesCount);
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
          flex-shrink: 0;
          pointer-events: none;
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
              <div 
                onClick={() => setShowDossierModal(true)}
                title="View Official Lok Sabha Dossier & Civic Pulse"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ecfdf5', border: '1.5px solid #a7f3d0', padding: '3px 9px', borderRadius: '999px', fontSize: '11px', cursor: 'pointer' }}
              >
                <div className="header-radar-beacon-container">
                  <div className="header-radar-ping" />
                  <div className="header-radar-core" />
                </div>
                <span style={{ color: '#065f46', fontWeight: 800 }}>{selectedSeat.name} ↗</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              onClick={(e) => triggerInfoPopup(
                lang === 'HI' ? 'नागरिक DBG अंक' : 'Civic DBG Points',
                lang === 'HI'
                  ? 'आपके नागरिक रिवॉर्ड अंक। लगातार 7 दिन वोट करने और मित्रों को आमंत्रित कर अर्जित। सीट बदलने का शुल्क 1 DBG है।'
                  : 'Your citizen reward points. Earned by 7-day voting streaks, completing the season milestones, and inviting friends. Shifting your constituency costs 1 DBG.',
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
            {/* Horizontal Civic Carousel (Explains BhuMat, Cadence, & Rules) */}
            <CivicCarousel
              lang={lang}
              selectedSeat={selectedSeat}
              isVerified={Boolean(linkedPhone || linkedEmail)}
              guestVoteCount={Object.keys(sessionBallotChoices).length}
              onOpenAuth={() => setAuthModalState({ isOpen: true, requiredFor: 'General' })}
            />

            {/* Animated 3-Step Guest Runway Indicator Meter */}
            {!linkedPhone && isConfirmed && (
              <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '16px', padding: '12px 16px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>
                      🌱 {lang === 'HI' ? `नागरिक रनवे: ${guestVotesCast} / 3 मत प्रयुक्त` : `Guest Runway: ${guestVotesCast} of 3 Ballots Cast`}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#475569', marginTop: '2px' }}>
                      {guestVotesCast >= 3 
                        ? (lang === 'HI' ? 'रनवे पूर्ण! मतदान जारी रखने हेतु साइन अप करें।' : 'Runway complete! SignUp to keep voting.')
                        : (lang === 'HI' ? `OTP सत्यापन से पूर्व ${3 - guestVotesCast} मत शेष।` : `${3 - guestVotesCast} ballot${3 - guestVotesCast === 1 ? '' : 's'} remaining before OTP registration.`)}
                    </div>
                  </div>
                  <button
                    onClick={() => setAuthModalState({ isOpen: true, requiredFor: 'General' })}
                    style={{ padding: '6px 12px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    {lang === 'HI' ? 'साइन अप करें' : 'SignUp'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '4px', width: '100%', marginTop: '8px' }}>
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      style={{
                        flex: 1,
                        height: '5px',
                        borderRadius: '3px',
                        backgroundColor: guestVotesCast >= step ? '#10b981' : '#e2e8f0',
                        transition: 'background-color 0.4s ease'
                      }}
                    />
                  ))}
                </div>
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
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>
                      {selectedSeat?.name} <span style={{ fontSize: '12px', color: '#475569' }}>({selectedSeat?.state})</span>
                    </div>
                    {seatDossier && (
                      <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, marginTop: '2px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ backgroundColor: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>
                          {seatDossier.reservation_status || 'GEN'}
                        </span>
                        <span>•</span>
                        <span>{seatDossier.assembly_segments_count || 6} Assembly Segments</span>
                        <span>•</span>
                        <span>{seatDossier.rural_pct ? `${seatDossier.rural_pct}% Rural` : 'Civic Grid'}</span>
                      </div>
                    )}
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

                {/* ⚔️ SEAT TURF WAR BATTLEGROUND STRIP */}
                {isConfirmed && selectedSeat && turfStandings.length > 0 && (
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '20px',
                    padding: '16px 18px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '15px' }}>⚔️</span>
                        <span style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {lang === 'HI' ? `${selectedSeat.name} क्षेत्रीय मुकाबला` : `${selectedSeat.name} Regional Turf War`}
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '6px' }}>
                        {selectedSeat.state} Cluster
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(() => {
                        const activeCohort = turfStandings.filter(s => (s.total_votes || 0) > 0);
                        const zeroCohort = turfStandings.filter(s => (s.total_votes || 0) === 0);
                        return (
                          <>
                            {activeCohort.map((item, idx) => {
                              const isHome = item.is_home;
                              return (
                                <div key={item.seat} style={{
                                  backgroundColor: isHome ? '#f0fdf4' : '#f8fafc',
                                  border: isHome ? '1.5px solid #a7f3d0' : '1px solid #e2e8f0',
                                  borderRadius: '12px',
                                  padding: '8px 12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '11px', fontWeight: 900, color: isHome ? '#059669' : '#0284c7' }}>
                                        #{idx + 1}
                                      </span>
                                      <span style={{ fontSize: '12.5px', fontWeight: isHome ? 900 : 700, color: isHome ? '#065f46' : '#0f172a' }}>
                                        {item.seat} {isHome && (lang === 'HI' ? '(आप)' : '(You)')}
                                      </span>
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 800, color: isHome ? '#059669' : '#0284c7' }}>
                                      {item.total_votes} {item.total_votes === 1 ? 'Vote' : 'Votes'} ({item.quorum_pct}%)
                                    </span>
                                  </div>
                                  <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.max(item.quorum_pct || 0, 2)}%`, height: '100%', backgroundColor: isHome ? '#10b981' : '#0284c7', transition: 'width 0.4s ease' }} />
                                  </div>
                                </div>
                              );
                            })}

                            {zeroCohort.length > 0 && (
                              <div style={{
                                backgroundColor: '#f8fafc',
                                border: '1px dashed #cbd5e1',
                                borderRadius: '12px',
                                padding: '10px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                                    {lang === 'HI' ? 'अचयनित पड़ोसी क्षेत्र (0 मत)' : 'Awaiting First Ballots'}
                                  </span>
                                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>
                                    0 / 50 Quorum
                                  </span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {zeroCohort.map((item) => (
                                    <span
                                      key={item.seat}
                                      style={{
                                        fontSize: '11px',
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #e2e8f0',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        color: item.is_home ? '#059669' : '#475569',
                                        fontWeight: item.is_home ? 800 : 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <span>📍</span>
                                      <span>{item.seat} {item.is_home && (lang === 'HI' ? '(आप)' : '(You)')}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <button
                      onClick={() => {
                        const msg = lang === 'HI'
                          ? `🚨 *${selectedSeat.name} सीट मुकाबला:* हमारे पड़ोसी क्षेत्रों में मत बढ़ रहे हैं! भूमत पर अपना मत दें और अपने क्षेत्र को कोरम तक पहुंचाएं:\nhttps://vote.bhumat.com?seat=${encodeURIComponent(selectedSeat.name)}&ref=${referralCode}`
                          : `🚨 *${selectedSeat.name} Turf War Alert:* Our neighboring constituencies are catching up! Cast your ballot on BhuMat to defend our seat quorum:\nhttps://vote.bhumat.com?seat=${encodeURIComponent(selectedSeat.name)}&ref=${referralCode}`;
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(16,185,129,0.2)'
                      }}
                    >
                      <span>📲</span>
                      <span>{lang === 'HI' ? `${selectedSeat.name} को आगे बढ़ाएं (व्हाट्सएप)` : `Mobilize ${selectedSeat.name} (WhatsApp)`}</span>
                    </button>
                  </div>
                )}

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '4px', borderRadius: '12px' }}>
                  <button onClick={() => setActiveCategoryFilter('ALL')} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: activeCategoryFilter === 'ALL' ? '#0f172a' : 'transparent', color: activeCategoryFilter === 'ALL' ? '#ffffff' : '#64748b', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    {lang === 'HI' ? 'सभी विचार' : 'All Opinion'}
                  </button>
                  <button onClick={() => setActiveCategoryFilter('LokMat')} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: activeCategoryFilter === 'LokMat' ? '#d97706' : 'transparent', color: activeCategoryFilter === 'LokMat' ? '#ffffff' : '#d97706', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    🌅 LokMat
                  </button>
                  <button onClick={() => setActiveCategoryFilter('JanMat')} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: activeCategoryFilter === 'JanMat' ? '#059669' : 'transparent', color: activeCategoryFilter === 'JanMat' ? '#ffffff' : '#059669', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    🌆 JanMat
                  </button>
                </div>

                {/* Daily WhatsApp Broadcast Channel Strip */}
            <a
              href="https://whatsapp.com/channel/0029Vb4QYvX5Ui2R"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: 'none',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '7px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px' }}>📢</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                  {lang === 'HI' ? 'दैनिक 8 PM ऑडिट हेतु व्हाट्सएप पर अपडेट रहें' : 'Stay notified for daily 8 PM JanMat Audits'}
                </span>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#16a34a' }}>
                {lang === 'HI' ? 'चैनल देखें ↗' : 'Channel ↗'}
              </span>
            </a>
                
                {liveAccessiblePolls.map((poll) => {
                  const isJanMat = poll.category === 'JanMat';
                  const dynamicCycle = (poll.participation_mode === 'recurring' && poll.recurrence !== 'expiry')
                    ? getCurrentCycleId(poll.recurrence, poll.starts_at)
                    : (poll.current_cycle || 'lifetime');
                  const cycleVoteKey = `${poll.id}___${dynamicCycle}`;
                  const choiceKey = `${poll.id}___${dynamicCycle}`;
                  const hasVotedThisCycle = votedCycleKeys.includes(cycleVoteKey);
                  const isFlipped = flippedOverrides[poll.id] !== undefined 
                    ? flippedOverrides[poll.id] 
                    : (autoFlippedCards[poll.id] || false);
                  const userChoiceIdx = sessionBallotChoices[choiceKey];
                  const isBilingual = Boolean(poll.title_hi && poll.title_hi.trim() !== '');
                  const calculatedFrontHeight = Math.max(
                    380,
                    165 + (poll.options.length * 54) + (isBilingual ? 22 : 0) + (isJanMat ? 25 : 10)
                  );
                  const dynamicCardHeight = isFlipped ? 760 : calculatedFrontHeight;
                  return (
                    <div
                      key={poll.id}
                      id={`poll-card-${poll.id}`}
                      ref={(el) => {
                        observeVotedCard(el, poll.id, hasVotedThisCycle);
                        pollCardRefs.current[poll.id] = el;
                      }}
                      style={{
                        perspective: '1200px',
                        width: '100%',
                        minHeight: `${dynamicCardHeight}px`,
                        marginBottom: '22px',
                        transition: 'min-height 0.4s ease'
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          minHeight: `${dynamicCardHeight}px`,
                          transition: 'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
                          transformStyle: 'preserve-3d',
                          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                        }}
                      >
                        {/* FRONT CARD: BALLOT VIEW */}
                        <div
                          style={{
                            position: isFlipped ? 'absolute' : 'relative',
                            inset: isFlipped ? 0 : 'auto',
                            backfaceVisibility: 'hidden',
                            pointerEvents: isFlipped ? 'none' : 'auto',
                            opacity: isFlipped ? 0 : 1,
                            backgroundColor: '#ffffff',
                            border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                            borderRadius: '24px',
                            padding: '20px',
                            paddingBottom: '22px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxSizing: 'border-box',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                            minHeight: `${calculatedFrontHeight}px`,
                            transition: 'opacity 0.25s ease'
                          }}
                        >
                          <div>
                            {/* Card Header: 2-Row Clean Layout (Zero Clutter) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                              {/* Row 1: Status & Mode on Left | Actions on Right */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="live-dot-animated" />
                                  <span style={{ fontSize: '10.5px', fontWeight: 900, color: '#ef4444', letterSpacing: '0.05em' }}>LIVE</span>
                                  <span
                                    onClick={(e) => triggerInfoPopup(
                                      isJanMat ? (lang === 'HI' ? 'जनमत नागरिक ऑडिट' : 'JanMat Civic Audit') : (lang === 'HI' ? 'लोकमत सांस्कृतिक पल्स' : 'LokMat Cultural Pulse'),
                                      isJanMat
                                        ? (lang === 'HI' ? 'संप्रभु गोपनीय मतपेटी (JanMat): आपकी पहचान से 100% पृथक, कोई टोकन या डेटा संकलित नहीं होता।' : 'Cryptographic Secret Ballot (JanMat): Completely decoupled from your citizen token. Zero identity tracking.')
                                        : (lang === 'HI' ? 'सार्वजनिक सांस्कृतिक पल्स (LokMat): आपके क्षेत्र के सांस्कृतिक व सामाजिक रुझानों को उजागर करने वाला खुला मत।' : 'Open Cultural Pulse (LokMat): Attributed to your profile to reveal local constituency opinion trends.'),
                                      e
                                    )}
                                    style={{
                                      backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb',
                                      color: isJanMat ? '#059669' : '#d97706',
                                      fontSize: '10px',
                                      fontWeight: 800,
                                      padding: '2.5px 8px',
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

                                {/* Right Side Actions: Listen + View Drishti */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => togglePollAudio(poll, e)}
                                    title={lang === 'HI' ? 'प्रश्न एवं विकल्प सुनें' : 'Listen to question & options'}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      backgroundColor: activePlayingPollId === poll.id ? '#ecfdf5' : '#ffffff',
                                      border: `1.5px solid ${activePlayingPollId === poll.id ? '#10b981' : '#cbd5e1'}`,
                                      color: activePlayingPollId === poll.id ? '#065f46' : '#334155',
                                      padding: '3px 8px',
                                      borderRadius: '7px',
                                      fontSize: '10.5px',
                                      fontWeight: 750,
                                      cursor: 'pointer',
                                      lineHeight: 1,
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                    }}
                                  >
                                    <span>{activePlayingPollId === poll.id ? '⏹' : '🔊'}</span>
                                    <span>
                                      {activePlayingPollId === poll.id
                                        ? (lang === 'HI' ? 'रोकें' : 'Stop')
                                        : (lang === 'HI' ? 'सुनें' : 'Listen')}
                                    </span>
                                  </button>

                                  {hasVotedThisCycle && (
                                    <button
                                      type="button"
                                      onClick={() => setFlippedOverrides((prev) => ({ ...prev, [poll.id]: true }))}
                                      style={{
                                        background: '#f8fafc',
                                        color: '#0f172a',
                                        border: '1.5px solid #cbd5e1',
                                        padding: '3px 9px',
                                        borderRadius: '7px',
                                        fontSize: '10.5px',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        lineHeight: 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <span>{lang === 'HI' ? 'दृष्टि' : 'Drishti'}</span>
                                      <span>↺</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Row 2: Cadence Strip (Single-Line Without Wrap) */}
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const isOneTime = poll.participation_mode === 'one_time';
                                    const isExpiryMode = poll.participation_mode === 'expiry' || poll.recurrence === 'expiry';
                                    triggerInfoPopup(
                                      isOneTime 
                                        ? (lang === 'HI' ? 'एकमुश्त मत (One-Vote)' : 'One-Vote Poll') 
                                        : (isExpiryMode ? (lang === 'HI' ? 'सीमित समय मत' : 'Limited-Time Poll') : (lang === 'HI' ? 'मासिक चक्र' : 'Monthly Poll')),
                                      isOneTime
                                        ? (lang === 'HI'
                                            ? 'इस प्रश्न पर हर नागरिक केवल एक बार मत दे सकता है। आपका मत हमेशा के लिए राष्ट्रीय जनमत का हिस्सा रहेगा।'
                                            : 'Every citizen votes once on this question. Your answer permanently joins the national public opinion.')
                                        : (isExpiryMode
                                            ? (lang === 'HI'
                                                ? 'यह प्रश्न निर्धारित अंतिम तिथि तक ही खुला रहेगा। समय रहते अपना मत दें।'
                                                : 'This poll closes at a set deadline. Cast your vote before it ends.')
                                            : (lang === 'HI'
                                                ? 'यह प्रश्न हर महीने दोबारा खुलता है ताकि आप अपनी राय अपडेट कर सकें।'
                                                : 'This poll re-opens every month so you can update your sentiment.')),
                                      e
                                    );
                                  }}
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 750,
                                    color: '#475569',
                                    backgroundColor: '#f1f5f9',
                                    padding: '2.5px 8px',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {(() => {
                                    if (poll.participation_mode === 'expiry' || poll.recurrence === 'expiry') {
                                      const d = poll.next_starts_at ? new Date(poll.next_starts_at) : new Date();
                                      const dateStr = d.toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' });
                                      return (
                                        <span style={{ color: '#dc2626', backgroundColor: '#fef2f2', padding: '1px 5px', borderRadius: '4px' }}>
                                          ⏳ {lang === 'HI' ? `सक्रिय: ${dateStr} तक` : `Active until ${dateStr}`}
                                        </span>
                                      );
                                    }
                                    if (poll.participation_mode === 'one_time') {
                                      return <span>🔒 {lang === 'HI' ? 'एकमुश्त मत' : 'One-Vote Poll'}</span>;
                                    }
                                    const now = new Date();
                                    const startDay = poll.starts_at ? new Date(poll.starts_at).getDate() : 1;
                                    const safeStartDay = Math.min(startDay, 28);
                                    let targetYear = now.getFullYear();
                                    let targetMonth = now.getMonth();
                                    if (now.getDate() >= safeStartDay) {
                                      targetMonth += 1;
                                      if (targetMonth > 11) { targetMonth = 0; targetYear += 1; }
                                    }
                                    const nextUnlockDate = new Date(targetYear, targetMonth, safeStartDay);
                                    const nextDateStr = nextUnlockDate.toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' });
                                    return hasVotedThisCycle 
                                      ? <span>🔓 {lang === 'HI' ? `अगला चक्र: ${nextDateStr}` : `Re-vote: ${nextDateStr}`}</span>
                                      : <span>📅 {lang === 'HI' ? 'मासिक चक्र' : 'Monthly Cycle'}</span>;
                                  })()}
                                  <span style={{ fontSize: '9px', opacity: 0.65 }}>ⓘ</span>
                                </span>
                              </div>
                            {/* Question Title & Translation */}
                            <div style={{ marginBottom: '14px', marginTop: '10px' }}>
                              <h2 style={{
                                fontSize: '16px',
                                fontWeight: 700,
                                color: '#0f172a',
                                lineHeight: 1.42,
                                letterSpacing: '-0.015em',
                                margin: '0 0 6px 0',
                                wordBreak: 'normal',
                                overflowWrap: 'break-word'
                              }}>
                                {lang === 'EN' ? poll.title_en : poll.title_hi}
                              </h2>
                              <p style={{
                                fontSize: '13px',
                                fontWeight: 500,
                                color: '#475569',
                                lineHeight: 1.46,
                                margin: 0,
                                overflowWrap: 'break-word'
                              }}>
                                {lang === 'EN' ? poll.title_hi : poll.title_en}
                              </p>
                            </div>
                               
                            </div>
                            <div style={{ margin: '0 0 14px 0', maxWidth: '100%', boxSizing: 'border-box' }}>
                              {/* Live Poll-Contextual 543 Ticker Tape */}
                            {/* Live Poll-Contextual 543 Ticker Tape */}
                            <TickerTape
                              tallies={cachedTalliesByPoll[poll.id] || []}
                              options={poll.options}
                              pollCategory={poll.category}
                              lang={lang}
                            />
                            </div>
                            {poll.blackout_seats && selectedSeat && poll.blackout_seats.includes(selectedSeat.name) ? (
                              <div
                                style={{
                                  backgroundColor: '#f8fafc',
                                  border: '1.5px solid #cbd5e1',
                                  borderRadius: '14px',
                                  padding: '16px',
                                  textAlign: 'center',
                                  margin: '12px 0',
                                }}
                              >
                                <span style={{ fontSize: '20px' }}>🏛️</span>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                                  Statutory Silence Period Active
                                </div>
                                <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.45 }}>
                                  Per ECI Section 126, public polling on governance is suppressed in {selectedSeat.name} during the 48-hour pre-election silence window. Ballots will unlock post-polling.
                                </p>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                                {poll.options.map((opt, idx) => {
                                  const optColor = OPTION_PALETTE[idx % OPTION_PALETTE.length];
                                  const isUserChoice = !isJanMat && userChoiceIdx === idx;
                                  const showChoiceHighlight = isUserChoice && hasVotedThisCycle;
                                  const pollTallies = cachedTalliesByPoll[poll.id] || [];
                                  const activeCounts = poll.options.map((_, oIdx) =>
                                    pollTallies.reduce((sum: number, t: any) => {
                                      return sum + Number(t[`opt_${oIdx}_votes`] ?? t[`opt_${oIdx}_count`] ?? 0);
                                    }, 0)
                                  );
                                  const activeTotalVotes = activeCounts.reduce((a, b) => a + b, 0);
                                  
                                  // Largest Remainder Method: Guarantees strict 100% sum
                                  const optPct = (() => {
                                    if (activeTotalVotes === 0) return Math.round(100 / poll.options.length);
                                    const exacts = activeCounts.map(c => (c / activeTotalVotes) * 100);
                                    const floors = exacts.map(e => Math.floor(e));
                                    let rem = 100 - floors.reduce((a, b) => a + b, 0);
                                    const diffs = exacts.map((e, i) => ({ i, d: e - floors[i] })).sort((a, b) => b.d - a.d);
                                    for (let r = 0; r < rem; r++) {
                                      floors[diffs[r % diffs.length].i] += 1;
                                    }
                                    return floors[idx] ?? 0;
                                  })();
                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleCastVote(poll, idx, e);
                                      }}
                                      style={{
                                        position: 'relative',
                                        overflow: 'hidden',
                                        padding: '11px 15px',
                                        minHeight: '44px',
                                        borderRadius: '12px',
                                        backgroundColor: showChoiceHighlight ? `${optColor}0A` : '#ffffff',
                                        border: showChoiceHighlight ? `1.5px solid ${optColor}88` : `1px solid ${optColor}33`,
                                        borderLeft: showChoiceHighlight ? `4px solid ${optColor}` : `1px solid ${optColor}33`,
                                        textAlign: 'left',
                                        cursor: hasVotedThisCycle ? 'default' : 'pointer',
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '3px',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      {hasVotedThisCycle && (
                                        <div
                                          style={{
                                            position: 'absolute',
                                            left: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: `${optPct}%`,
                                            backgroundColor: `${optColor}10`,
                                            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                                            pointerEvents: 'none'
                                          }}
                                        />
                                      )}
                                      <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '10px' }}>
                                        <div style={{
                                          fontSize: '13.5px',
                                          fontWeight: showChoiceHighlight ? 800 : (hasVotedThisCycle ? 700 : 600),
                                          color: '#0f172a',
                                          flex: 1,
                                          wordBreak: 'break-word',
                                          lineHeight: 1.35,
                                          letterSpacing: '-0.01em'
                                        }}>
                                          {lang === 'EN' ? opt.text_en : opt.text_hi}
                                        </div>
                                        {hasVotedThisCycle && (
                                          <span style={{ fontSize: '13px', fontWeight: 900, color: optColor, minWidth: '38px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                            {optPct}%
                                          </span>
                                        )}
                                      </div>
                                      <div style={{
                                        position: 'relative',
                                        zIndex: 2,
                                        fontSize: '11px',
                                        color: '#64748b',
                                        wordBreak: 'break-word',
                                        lineHeight: 1.3,
                                        fontWeight: 500,
                                        marginTop: '1px'
                                      }}>
                                        {lang === 'EN' ? opt.text_hi : opt.text_en}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginTop: 'auto', gap: '8px', minHeight: '44px' }}>
                            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                              {isJanMat 
                                ? (lang === 'HI' ? '🔒 100% गोपनीय मत' : '🔒 100% Anonymous Ballot')
                                : (lang === 'HI' ? '🗳️ खुला सार्वजनिक मत' : '🗳️ Open Public Mat')}
                            </span>
                            {hasVotedThisCycle ? (
                              <button
                                type="button"
                                onClick={() => openExpandedView(poll)}
                                style={{
                                  background: isJanMat ? '#ecfdf5' : '#f0fdf4',
                                  color: '#059669',
                                  border: '1.5px solid #a7f3d0',
                                  padding: '8px 16px',
                                  borderRadius: '12px',
                                  fontSize: '11.5px',
                                  fontWeight: 850,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  boxShadow: '0 2px 6px rgba(5,150,105,0.08)'
                                }}
                              >
                                <span>{lang === 'HI' ? 'पूर्ण दृष्टि (543 सीटें) देखें ↗' : 'Explore Full Drishti (543 Seats)'}</span>
                                <span>📊 ↗</span>
                              </button>
                            ) : (
                              <span style={{
                                fontSize: '10.5px',
                                fontWeight: 750,
                                color: isJanMat ? '#059669' : '#d97706',
                                backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb',
                                border: `1px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                                padding: '5px 9px',
                                borderRadius: '7px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <span>🗳️</span>
                                <span>{lang === 'HI' ? 'मत देकर लाइव परिणाम देखें' : 'Tap to vote and see live results'}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* BACK CARD: DRISHTI STATE VIEW */}
                        <div
                          style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  pointerEvents: isFlipped ? 'auto' : 'none',
                  backgroundColor: '#ffffff',
                  border: `1.5px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`,
                  borderRadius: '24px',
                  padding: '16px 16px 18px 16px',
                  minHeight: '760px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  overflow: 'hidden'
                }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '26px', marginBottom: '6px' }}>
                              <span className="drishti-active-chip" style={{ backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb', color: isJanMat ? '#059669' : '#d97706', fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '999px', lineHeight: 1 }}>
                                {lang === 'HI' ? '✓ दृष्टि मत सक्रिय' : '✓ DRISHTI MAT ACTIVE'}
                              </span>
                              <button
                                onClick={() => setFlippedOverrides((prev) => ({ ...prev, [poll.id]: false }))}
                                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '11px', padding: '3px 10px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
                              >
                                {lang === 'HI' ? 'मतपत्र देखें ↻' : 'View Ballot ↻'}
                              </button>
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                              <h2 style={{ fontSize: '16px', fontWeight: 850, margin: 0, color: '#0f172a', lineHeight: 1.3, letterSpacing: '-0.015em' }}>
                                {lang === 'EN' ? poll.title_en : poll.title_hi}
                              </h2>
                            </div>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: poll.options.length <= 2 ? '1fr 1fr' : 'repeat(auto-fit, minmax(140px, 1fr))',
                                gap: '6px 8px',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                padding: '8px 10px',
                                marginBottom: '8px',
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
                                      gap: '5px',
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
                              <div 
                                onClick={(e) => triggerInfoPopup(
                                  lang === 'HI' ? 'खंडित मत (Split Mat)' : 'Split Mat Stance',
                                  lang === 'HI'
                                    ? 'जब किसी भी विकल्प को 50% से अधिक स्पष्ट बहुमत नहीं मिलता, तो वह क्षेत्र खंडित मत के रूप में चिन्हित होता है।'
                                    : 'Indicates a divided seat where no single option holds an absolute majority (>50%).',
                                  e
                                )}
                                style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}
                              >
                                <span>⚖️</span>
                                <span>{lang === 'HI' ? 'खंडित मत' : 'Split Mat'}</span>
                                <span style={{ fontSize: '9px', opacity: 0.6 }}>ⓘ</span>
                              </div>
                            </div>
                            <div style={{ width: '100%', marginBottom: '4px' }}>
                              <DrishtiMap
                      selectedConstituencyName={selectedSeat?.name}
                      selectedState={selectedSeat?.state || 'Bihar'}
                      pollId={poll.id}
                      options={poll.options}
                      userVotedOptionIdx={sessionBallotChoices[`${poll.id}___${dynamicCycle}`] ?? sessionBallotChoices[`${poll.id}___lifetime`]}
                      lang={lang}
                    />
                            </div>
                          </div>

                          {/* BOTTOM ANCHORED SECTION */}
                          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                            
                            {/* 💡 CONTEXT-AWARE LOCAL ANALYTICS REVEAL */}
                            {(() => {
                              const dynamicCycle = (poll.participation_mode === 'recurring' && poll.recurrence !== 'expiry')
                                ? getCurrentCycleId(poll.recurrence, poll.starts_at)
                                : (poll.current_cycle || 'lifetime');
                              const userChoice = sessionBallotChoices[`${poll.id}___${dynamicCycle}`];
                              const tallies = cachedTalliesByPoll[poll.id] || [];
                              const seatNorm = (selectedSeat?.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
const stateNorm = (selectedSeat?.state || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

// 1. Declare stateTallies once, matching both state_name and state_ut robustly
const stateTallies = (tallies || []).filter((t: any) => {
  const rowSt = (t.state_name || t.state_ut || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  return rowSt === stateNorm;
});

// 2. Find homeTally from stateTallies or fallback to entire tallies array
const homeTally = stateTallies.find((t: any) => {
  const rowSeat = (t.constituency_name || t.pc_name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  return rowSeat === seatNorm;
}) || (tallies || []).find((t: any) => {
  const rowSeat = (t.constituency_name || t.pc_name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  return rowSeat === seatNorm;
});

// 3. Read true raw votes from authoritative tally
const homeTotal = Number(homeTally?.total_votes || homeTally?.total_ballots || 0);

// 4. Map turfStandings cleanly, ensuring home seat is guaranteed with homeTotal
let hasHomeInStandings = false;
const turfStandings = stateTallies.map((t: any) => {
  const rowSeat = (t.constituency_name || t.pc_name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const isHome = rowSeat === seatNorm;
  if (isHome) hasHomeInStandings = true;
  return {
    seat: t.constituency_name || t.pc_name || 'Constituency',
    total_votes: isHome ? homeTotal : Number(t.total_votes || t.total_ballots || 0),
    is_home: isHome
  };
});

// If home seat had 0 initial records in stateTallies, append it directly with homeTotal
if (!hasHomeInStandings && selectedSeat?.name) {
  turfStandings.push({
    seat: selectedSeat.name,
    total_votes: homeTotal,
    is_home: true
  });
}
                              const chosenOptIdx = userChoice !== undefined ? userChoice : 0;
                              const optKeyCount = `opt_${chosenOptIdx}_count`;
                              const optKeyVotes = `opt_${chosenOptIdx}_votes`;
                              const homeChosenVotes = Number(homeTally?.[optKeyCount] ?? homeTally?.[optKeyVotes] ?? 0);
                              
                              const homePct = homeTotal > 0 ? Math.round((homeChosenVotes / homeTotal) * 100) : 0;
                              const isPioneer = homeTotal <= 1;

                              // State calculations
                              let stateTotal = 0;
                              let stateChosenVotes = 0;
                              stateTallies.forEach((t: any) => {
                                stateTotal += Number(t.total_votes || t.total_ballots || 0);
                                stateChosenVotes += Number(t[optKeyCount] ?? t[optKeyVotes] ?? 0);
                              });
                              const statePct = stateTotal > 0 ? Math.round((stateChosenVotes / stateTotal) * 100) : homePct;
                              const delta = homePct - statePct;

                             
                              const chosenOpt = poll.options[chosenOptIdx];
                              const rawOptLabel = lang === 'HI' ? (chosenOpt?.text_hi || chosenOpt?.text_en) : chosenOpt?.text_en;
                              const optLabel = rawOptLabel ? rawOptLabel.split('(')[0].trim() : '';

                              return (
                                <div style={{
                                  backgroundColor: '#f0fdf4',
                                  border: '1.5px solid #bbf7d0',
                                  borderRadius: '12px',
                                  padding: '8px 12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                  boxSizing: 'border-box'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '13px' }}>{isPioneer ? '🌱' : '💡'}</span>
                                    <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600, lineHeight: 1.35 }}>
                                      {isPioneer ? (
                                        lang === 'HI' ? (
                                          <span>
                                            आप <strong>{selectedSeat?.name || 'अपने क्षेत्र'}</strong> से इस रुख (<em>{optLabel}</em>) पर <strong>प्रथम नागरिक मत</strong> हैं! (राज्य औसत: {statePct}%)।
                                          </span>
                                        ) : (
                                          <span>
                                            You cast the <strong>pioneer ballot in {selectedSeat?.name || 'your seat'}</strong> for <em>{optLabel}</em>! ({selectedSeat?.state || 'State'} average: {statePct}%).
                                          </span>
                                        )
                                      ) : (
                                        lang === 'HI' ? (
                                          <span>
                                            <strong>{selectedSeat?.name || 'आपके क्षेत्र'}</strong> में <strong>{homePct}%</strong> नागरिक आपके रुख (<em>{optLabel}</em>) से सहमत हैं
                                            {Math.abs(delta) >= 3 ? ` (राज्य औसत से ${delta > 0 ? `+${delta}% अधिक` : `${delta}% कम`})` : ''}।
                                          </span>
                                        ) : (
                                          <span>
                                            In <strong>{selectedSeat?.name || 'your seat'}</strong>, <strong>{homePct}%</strong> align with your stance (<em>{optLabel}</em>)
                                            {Math.abs(delta) >= 3 ? ` (${delta > 0 ? `+${delta}% above` : `${delta}% below`} ${selectedSeat?.state || 'state'} average)` : ''}.
                                          </span>
                                        )
                                      )}
                                    </div>
                                  </div>
                                  <span style={{
                                    fontSize: '10px',
                                    fontWeight: 900,
                                    color: '#15803d',
                                    backgroundColor: '#dcfce7',
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {isPioneer ? '🌱 Pioneer Ballot' : `${homePct}% Local Match`}
                                  </span>
                                </div>
                              );
                            })()}
                            
                            {/* Live Neighbor Rivalry Alert */}
                            {stateBastionsByPoll[poll.id] && stateBastionsByPoll[poll.id].length > 1 && (
                              <div style={{
                                backgroundColor: '#fffbeb',
                                border: '1px solid #fde68a',
                                borderRadius: '10px',
                                padding: '6px 10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                color: '#92400e'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <span>⚔️</span>
                                  <span>
                                    {selectedSeat?.name || 'Home'}: <strong>{turfStandings.find((s: any) => s.is_home)?.total_votes || 0}</strong> vs {stateBastionsByPoll[poll.id].find((b: any) => b.constituency_name.toLowerCase() !== (selectedSeat?.name || '').toLowerCase())?.constituency_name || 'Rival'}: <strong>{stateBastionsByPoll[poll.id].find((b: any) => b.constituency_name.toLowerCase() !== (selectedSeat?.name || '').toLowerCase())?.total_votes || 0}</strong>
                                  </span>
                                </div>
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: 800,
                                  color: '#b45309',
                                  backgroundColor: '#fef3c7',
                                  padding: '1px 6px',
                                  borderRadius: '4px'
                                }}>
                                  {(turfStandings.find((s: any) => s.is_home)?.total_votes || 1) >= (stateBastionsByPoll[poll.id].find((b: any) => b.constituency_name.toLowerCase() !== (selectedSeat?.name || '').toLowerCase())?.total_votes || 1) ? '🏆 Leading' : '⚡ Contested'}
                                </span>
                              </div>
                            )}

                            {/* Regional Pulse: Top Engaged Constituencies */}
                            <div style={{ marginTop: '0px', marginBottom: '4px', width: '100%', boxSizing: 'border-box' }}>
                              <div style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                marginBottom: '5px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <span>🏛️</span>
                                <span>{lang === 'HI' ? `${selectedSeat?.state || 'राज्य'} के शीर्ष क्षेत्र` : `Top Regional Pulse (${selectedSeat?.state || 'State'})`}</span>
                              </div>

                              {stateBastionsByPoll[poll.id] && stateBastionsByPoll[poll.id].length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(
                                  // Deduplicate by constituency_name so a single seat never renders multiple times
                                  stateBastionsByPoll[poll.id].filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => (t.constituency_name || t.pc_name) === (v.constituency_name || v.pc_name)) === i).length, 
                                  3
                                )}, 1fr)`, gap: '6px' }}>
                                  {stateBastionsByPoll[poll.id]
                                    .filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => (t.constituency_name || t.pc_name) === (v.constituency_name || v.pc_name)) === i)
                                    .slice(0, 3)
                                    .map((bastion: any, bIdx: number) => {
    const opt = poll.options[bastion.leading_opt_idx] || poll.options[0];
    const optColor = OPTION_PALETTE[(bastion.leading_opt_idx ?? 0) % OPTION_PALETTE.length];
    const rawBastionText = lang === 'HI' ? opt?.text_hi : opt?.text_en;
    const cleanBastionText = rawBastionText ? rawBastionText.split('(')[0].trim() : '';
    const badges = ['🥇', '🥈', '🥉'];
    return (
      <div
        key={`${bastion.constituency_name}-${bIdx}`}
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '66px',
          boxSizing: 'border-box'
        }}
      >
        <div style={{
          fontSize: '11px',
          fontWeight: 800,
          color: '#0f172a',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.2
        }}>
          {badges[bIdx]} {bastion.constituency_name}
        </div>
        <div style={{
          fontSize: '9.5px',
          fontWeight: 700,
          color: optColor,
          lineHeight: 1.25,
          margin: '3px 0',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {cleanBastionText}
        </div>
        <div style={{
          fontSize: '8.5px',
          color: bastion.total_votes >= 50 ? '#059669' : '#64748b',
          fontWeight: 800,
          borderTop: '1px dashed #e2e8f0',
          paddingTop: '2px'
        }}>
          {bastion.total_votes >= 50 
            ? (lang === 'HI' ? `🛡️ सत्यापित (${bastion.total_votes})` : `🛡️ Fortified (${bastion.total_votes}v)`)
            : `${Math.min(100, Math.max(2, Math.round((bastion.total_votes / 50) * 100)))}% ${lang === 'HI' ? 'कोरम' : 'Quorum'}`}
        </div>
      </div>
    );
  })}
</div>
                              ) : (
                                <div style={{
                                  backgroundColor: '#f0fdf4',
                                  border: '1px solid #bbf7d0',
                                  borderRadius: '10px',
                                  padding: '8px 10px',
                                  fontSize: '11px',
                                  color: '#166534',
                                  fontWeight: 700,
                                  textAlign: 'center',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}>
                                  <span>📍 {selectedSeat?.name || 'Constituency'}: {lang === 'HI' ? 'प्रारंभिक सहमति निर्माण' : 'Early Consensus Building'}</span>
                                  <span style={{ fontSize: '10px', backgroundColor: '#dcfce7', padding: '2px 7px', borderRadius: '5px' }}>
                                    {Math.min(100, Math.max(2, Math.round(((turfStandings.find((s: any) => s.is_home)?.total_votes || 1) / 50) * 100)))}% {lang === 'HI' ? 'कोरम' : 'Quorum'}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Dynamic Post-Vote Action Bar */}
                            {hasVotedThisCycle && (
                              <div style={{
                                display: 'flex',
                                gap: '6px',
                                width: '100%',
                                boxSizing: 'border-box',
                                margin: '2px 0 4px 0'
                              }}>
                                <button
                                  type="button"
                                  onClick={() => {
  const currentIdx = liveAccessiblePolls.findIndex(p => p.id === poll.id);
  
  // 1. Check for unvoted polls strictly DOWN the list
  let nextTarget = liveAccessiblePolls.slice(currentIdx + 1).find(p => {
    const cyc = p.participation_mode === 'recurring' ? getCurrentCycleId(p.recurrence) : 'lifetime';
    return !votedCycleKeys.includes(`${p.id}___${cyc}`);
  });

  // 2. Wrap-around to the top if nothing remains below
  if (!nextTarget) {
    nextTarget = liveAccessiblePolls.slice(0, currentIdx).find(p => {
      const cyc = p.participation_mode === 'recurring' ? getCurrentCycleId(p.recurrence) : 'lifetime';
      return !votedCycleKeys.includes(`${p.id}___${cyc}`);
    });
  }

  if (nextTarget) {
    const targetNode = document.getElementById(`poll-card-${nextTarget.id}`);
    if (targetNode) {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Trigger intentional audio readout on arrival
      setTimeout(() => {
        if (nextTarget) {
          togglePollAudio(nextTarget);
        }
      }, 650);
    }
  } else {
    showPointerToast(lang === 'HI' ? '✓ आपने सभी सक्रिय मत पूर्ण कर लिए हैं!' : '✓ You have voted on all live polls for this cycle!');
  }
}}
                                  style={{
                                    flex: 1,
                                    padding: '7px 10px',
                                    backgroundColor: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '10px',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    color: '#0f172a',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <span>⏭️</span>
                                  <span>{lang === 'HI' ? 'अगला मत दें' : 'Next Poll'}</span>
                                </button>
                                <button
                                type="button"
                                onClick={() => {
                                  const dynamicCycle = (poll.participation_mode === 'recurring' && poll.recurrence !== 'expiry')
                                    ? getCurrentCycleId(poll.recurrence, poll.starts_at)
                                    : (poll.current_cycle || 'lifetime');
                                  const userChoice = sessionBallotChoices[`${poll.id}___${dynamicCycle}`];
                                  const chosenOpt = poll.options[userChoice !== undefined ? userChoice : 0];
                                  const optText = lang === 'HI' ? (chosenOpt?.text_hi || chosenOpt?.text_en) : chosenOpt?.text_en;
                                  
                                  setMatParchiState({
                                    isOpen: true,
                                    pollId: poll.id,
                                    pollTitle: lang === 'HI' ? poll.title_hi : poll.title_en,
                                    pollCategory: poll.category || 'LokMat',
                                    options: poll.options || [],
                                    selectedOptionText: optText || '',
                                    seatName: selectedSeat?.name || 'Constituency',
                                    stateName: selectedSeat?.state || 'National'
                                  });
                                }}
                                style={{
                                  flex: 1,
                                  padding: '8px 10px',
                                  backgroundColor: '#ecfdf5',
                                  border: '1.5px solid #a7f3d0',
                                  borderRadius: '10px',
                                  color: '#065f46',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span>📜</span>
                                <span>{lang === 'HI' ? 'मत पर्ची शेयर करें' : 'Share Mat Parchi'}</span>
                              </button>
                              </div>
                            )}

                            {/* Full Drishti Button */}
                            <div style={{ width: '100%', paddingTop: '4px', paddingBottom: '0px' }}>
                              <button
                                type="button"
                                onClick={() => openExpandedView(poll)}
                                style={{
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  padding: '12px 16px',
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
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                                }}
                              >
                                <span>{lang === 'HI' ? 'संप्रभु दृष्टि देखें (543 सीटें) ↗' : 'Explore Full Drishti (543 Seats)'}</span>
                                <span>📊 ↗</span>
                              </button>
                            </div>
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
          <SearchTab
            polls={polls}
            searchPollMatches={searchPollMatches}
            pollSearchQuery={pollSearchQuery}
            setPollSearchQuery={setPollSearchQuery}
            activeCategoryFilter={activeCategoryFilter}
            setActiveCategoryFilter={setActiveCategoryFilter}
            lang={lang}
            votedCycleKeys={votedCycleKeys}
            flippedOverrides={flippedOverrides}
            openExpandedView={openExpandedView}
            setActiveTab={setActiveTab}
            searchInputRef={searchInputRef}
          />
        )}

        {/* TAB 3: SCHEDULE & CADENCE */}
        {activeTab === 'schedule' && (
          <ScheduleTab
            polls={polls}
            scheduledQueueList={scheduledQueueList}
            lang={lang}
            votedCycleKeys={votedCycleKeys}
            openExpandedView={openExpandedView}
            setActiveCategoryFilter={setActiveCategoryFilter}
            setActiveTab={setActiveTab}
            triggerInfoPopup={triggerInfoPopup}
          />
        )}

        {/* TAB 4: CITIZEN PASSPORT & CIVIC XP */}
        {activeTab === 'profile' && (
          <ProfileTab
            lang={lang}
            deviceHash={deviceHash}
            username={username}
            setUsername={setUsername}
            isEditingUsername={isEditingUsername}
            setIsEditingUsername={setIsEditingUsername}
            usernameInput={usernameInput}
            setUsernameInput={setUsernameInput}
            selectedSeat={selectedSeat}
            linkedPhone={linkedPhone}
            linkedEmail={linkedEmail}
            dbgPoints={dbgPoints}
            setDbgPoints={setDbgPoints}
            displayMonthlyVotes={displayMonthlyVotes}
            recognitionTier={recognitionTier}
            polls={polls}
            sessionBallotChoices={sessionBallotChoices}
            cachedTalliesByPoll={cachedTalliesByPoll}
            setShowSponsorModal={setShowSponsorModal}
            showPointerToast={showPointerToast}
            fetchLedger={fetchLedger}
            ledgerEntries={ledgerEntries}
            isLedgerOpen={isLedgerOpen}
            setIsLedgerOpen={setIsLedgerOpen}
            referralCode={referralCode}
            votingSinceDate={votingSinceDate}
            formatVotingSince={formatVotingSince}
            totalVotesCount={totalVotesCount}
            lokmatPollsCount={lokmatPollsCount}
            janmatAuditsCount={janmatAuditsCount}
            setTentativeSeat={setTentativeSeat}
            setSeatSearchInput={setSeatSearchInput}
            setIsChangeSeatModalOpen={setIsChangeSeatModalOpen}
            syncWallet={syncWallet}
          />
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

      {/* 5-Tab Bottom Navigation Dock */}
      {isConfirmed && !isChangeSeatModalOpen && (
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
              padding: '0 4px',
              boxSizing: 'border-box'
            }}
          >
            {/* 1. Search */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('search');
                setTimeout(() => searchInputRef.current?.focus(), 150);
              }}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: activeTab === 'search' ? '#0284c7' : '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1, transform: activeTab === 'search' ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.15s ease' }}>🔍</span>
              <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'search' ? 900 : 600, marginTop: '4px', letterSpacing: '-0.01em' }}>
                {lang === 'HI' ? 'खोजें' : 'Search'}
              </span>
            </button>

            {/* 2. Schedule */}
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: activeTab === 'schedule' ? '#0284c7' : '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1, transform: activeTab === 'schedule' ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.15s ease' }}>📅</span>
              <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'schedule' ? 900 : 600, marginTop: '4px', letterSpacing: '-0.01em' }}>
                {lang === 'HI' ? 'समय-सारणी' : 'Schedule'}
              </span>
            </button>

            {/* 3. Vote (Primary Center Action) */}
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'vote') {
                  handleBrandReset();
                } else {
                  setActiveTab('vote');
                }
              }}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: activeTab === 'vote' ? '#0284c7' : '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1, transform: activeTab === 'vote' ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.15s ease' }}>🗳️</span>
              <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'vote' ? 900 : 600, marginTop: '4px', letterSpacing: '-0.01em' }}>
                {lang === 'HI' ? 'मतदान' : 'Vote'}
              </span>
            </button>

            {/* 4. Rankings */}
            <button
              type="button"
              onClick={() => router.push('/leaderboard')}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1 }}>🏆</span>
              <span style={{ fontSize: '10.5px', fontWeight: 600, marginTop: '4px', letterSpacing: '-0.01em' }}>
                {lang === 'HI' ? 'लीडरबोर्ड' : 'Rankings'}
              </span>
            </button>

            {/* 5. Profile */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('profile');
              }}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: activeTab === 'profile' ? '#0284c7' : '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1, transform: activeTab === 'profile' ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.15s ease' }}>👤</span>
              <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'profile' ? 900 : 600, marginTop: '4px', letterSpacing: '-0.01em' }}>
                {lang === 'HI' ? 'प्रोफ़ाइल' : 'Profile'}
              </span>
            </button>
          </div>
        </nav>
      )}

      {/* Auth Modal with Plain-Language EVM Ink Privacy Assurance */}
      <AuthModal
        isOpen={authModalState.isOpen}
        onClose={() => setAuthModalState({ isOpen: false, requiredFor: 'General' })}
        requiredFor={authModalState.requiredFor}
        userSeat={selectedSeat?.name || ''}
        userState={selectedSeat?.state || ''}
        lang={lang}
        onSuccess={async (newToken, identifier, isVerified) => {
          setDeviceHash(newToken);
          setLinkedPhone(identifier);
          safeStorage.setItem('bhumat_user_phone', identifier);
          if (!isVerified) {
            setLinkedEmail(identifier);
            safeStorage.setItem('bhumat_user_email', identifier);
          }
          setDbgPoints(5);
          safeStorage.setItem('bhumat_dbg_balance', '5');

          // Elevate guest session across ANY of the 543 Lok Sabha seats
          const targetSeat = tentativeSeat || selectedSeat;
          if (targetSeat?.name) {
            try {
              const { data: claimData } = await supabase.rpc('claim_guest_session_and_shift', {
                p_device_token: newToken,
                p_target_pc_id: targetSeat.name,
                p_username: username || null,
                p_phone: isVerified ? identifier : null,
                p_email: !isVerified ? identifier : null
              });

              if (claimData?.dbg_balance !== undefined) {
                setDbgPoints(claimData.dbg_balance);
                safeStorage.setItem('bhumat_dbg_balance', String(claimData.dbg_balance));
              }

              // If user signed up during a seat shift intercept, complete the shift
              if (tentativeSeat && tentativeSeat.name !== selectedSeat?.name) {
                setSelectedSeat(tentativeSeat);
                safeStorage.setItem('bhumat_user_seat', tentativeSeat.name);
                safeStorage.setItem('bhumat_user_state', tentativeSeat.state);
                setTentativeSeat(null);
              }

              showPointerToast(
                lang === 'HI'
                  ? '🎉 स्वागत है! नागरिक खाता सत्यापित एवं 5 DBG बोनस प्राप्त हुआ।'
                  : '🎉 Welcome! Account verified and 5 DBG bonus credited.'
              );
            } catch (rpcErr) {
              console.warn('Session claim error:', rpcErr);
            }
          }

          syncWallet(newToken);
          setProfileRefreshKey((prev) => prev + 1);
          if (authModalState.pendingVote) {
            executeCastBallot(authModalState.pendingVote.poll, authModalState.pendingVote.optionIdx, undefined, newToken, true);
          }
        }}
      />

      {/* Official Lok Sabha Dossier & Pulse Modal */}
      {showDossierModal && selectedSeat && (
        <div
          onClick={() => setShowDossierModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 210,
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
              padding: '22px',
              maxWidth: '430px',
              width: '100%',
              maxHeight: '90dvh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxSizing: 'border-box'
            }}
          >
            {/* Header Badge & Close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 900, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.04em' }}>
                🏛️ {lang === 'HI' ? 'आधिकारिक निर्वाचन आयोग (ECI) प्रोफाइल' : 'OFFICIAL ECI CONSTITUENCY DOSSIER'}
              </span>
              <button
                onClick={() => setShowDossierModal(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 800, color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Title & ECI Number */}
            <div>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '22px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                {selectedSeat.name}
              </h3>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                {selectedSeat.state} • {lang === 'HI' ? `संसदीय क्षेत्र #${seatDossier?.pc_number || '1'}` : `Parliamentary Constituency #${seatDossier?.pc_number || '1'}`}
              </div>
            </div>

            {/* 4-Box Electoral & Constitutional Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  {lang === 'HI' ? 'सांसद (2024)' : 'INCUMBENT MP (2024)'}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                  {seatDossier?.incumbent_mp ? `${seatDossier.incumbent_mp}` : 'Awaiting Data'}
                </div>
                {seatDossier?.incumbent_party && (
                  <div style={{ fontSize: '10.5px', color: '#0284c7', fontWeight: 700, marginTop: '1px' }}>
                    {seatDossier.incumbent_party} {seatDossier.winning_margin ? `(+${Number(seatDossier.winning_margin).toLocaleString('en-IN')})` : ''}
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  {lang === 'HI' ? '2024 मतदान प्रतिशत' : '2024 VOTER TURNOUT'}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                  {seatDossier?.turnout_pct ? `${seatDossier.turnout_pct}%` : '65.5%'}
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '1px' }}>
                  {seatDossier?.total_electors ? `~${(Number(seatDossier.total_electors) / 1000000).toFixed(2)}M Electors` : 'Registered Voters'}
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  {lang === 'HI' ? 'आरक्षण स्थिति' : 'RESERVATION'}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                  {seatDossier?.reservation_status || 'GEN'}
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  {lang === 'HI' ? 'विधानसभा सीटें' : 'ASSEMBLY SEGMENTS'}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
                  {seatDossier?.assembly_segments?.length || seatDossier?.assembly_segments_count || 6} Seats
                </div>
              </div>
            </div>

            {/* Authentic Constituent Assembly Segments Badges */}
            {seatDossier?.assembly_segments && seatDossier.assembly_segments.length > 0 && (
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '10px 12px' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                  {lang === 'HI' ? 'अंतर्गत विधानसभा क्षेत्र (विधानसभा):' : 'CONSTITUENT ASSEMBLY SEGMENTS:'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                  {seatDossier.assembly_segments.map((ac: any, idx: number) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        color: '#334155'
                      }}
                    >
                      {ac.no ? `#${ac.no} ` : ''}{ac.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* BhuMat 50-Vote Quorum Fortification Progress */}
            <div style={{ backgroundColor: '#ecfdf5', padding: '12px 14px', borderRadius: '14px', border: '1.5px solid #a7f3d0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#065f46' }}>
                  ⚡ {lang === 'HI' ? 'भूमत जनमत संप्रभु सुदृढ़ीकरण' : 'BhuMat Consensus Fortification'}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 900, color: '#059669' }}>
                  {turfStandings.find((s: any) => s.is_home)?.total_votes || 1} / 50 {lang === 'HI' ? 'मत' : 'Votes'}
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: '#d1fae5', borderRadius: '999px', marginTop: '8px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.max(turfStandings.find((s: any) => s.is_home)?.quorum_pct || 2, 2))}%`,
                    height: '100%',
                    backgroundColor: '#059669',
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
            </div>

            <button
              onClick={() => {
                setShowDossierModal(false);
                setActiveTab('vote');
              }}
              style={{
                padding: '12px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                borderRadius: '12px',
                border: 'none',
                fontWeight: 800,
                fontSize: '12.5px',
                cursor: 'pointer',
                marginTop: '2px'
              }}
            >
              ✓ {lang === 'HI' ? 'फीड पर वापस लौटें' : 'Return to Sovereign Feed'}
            </button>
          </div>
        </div>
      )}
      

      {/* 50-Quorum Milestone Celebration Modal */}
      <QuorumCelebrationModal
        isOpen={showQuorumModal}
        onClose={() => setShowQuorumModal(false)}
        seatName={selectedSeat?.name || 'Constituency'}
        stateName={selectedSeat?.state || 'Bharat'}
        totalVotes={50}
        lang={lang}
        referralCode={referralCode}
      />

      {matParchiState.isOpen && (
        <MatParchiModal
          isOpen={matParchiState.isOpen}
          onClose={() => setMatParchiState((prev) => ({ ...prev, isOpen: false }))}
          pollId={matParchiState.pollId}
          pollTitle={matParchiState.pollTitle}
          pollCategory={matParchiState.pollCategory}
          options={matParchiState.options}
          selectedOptionText={matParchiState.selectedOptionText}
          seatName={matParchiState.seatName}
          stateName={matParchiState.stateName}
          lang={lang}
        />
      )}

      {/* 50 DBG User-Sponsored Poll Modal */}
      {showSponsorModal && (
        <SponsorPollModal
          voterToken={deviceHash}
          username={username}
          userState={selectedSeat?.state || 'Bihar'}
          userSeat={selectedSeat?.name || 'Muzaffarpur'}
          userDbgBalance={dbgPoints}
          onClose={() => {
            setShowSponsorModal(false);
            syncWallet(deviceHash);
          }}
        />
      )}
    </div>
  );
}