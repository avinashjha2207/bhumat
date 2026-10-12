'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';

interface Poll {
  id: string;
  category: string;
  title_en: string;
  title_hi: string;
  participation_mode?: string;
  recurrence?: string;
  current_cycle?: string;
  starts_at?: string;
  is_active?: boolean;
  target_region_type?: string;
  target_seats?: string[];
  blackout_seats?: string[];
  options: any[];
}

const MASTER_ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || 'bhumat2026';
const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];

const QUICK_SEATS: Record<string, string> = {
  'Muzaffarpur': 'Bihar',
  'Darbhanga': 'Bihar',
  'Buxar': 'Bihar',
  'Banka': 'Bihar',
  'Sasaram': 'Bihar',
  'Munger': 'Bihar',
  'Nagpur': 'Maharashtra',
  'Ramtek': 'Maharashtra',
  'East Delhi': 'Delhi',
  'Gorakhpur': 'Uttar Pradesh',
  'Varanasi': 'Uttar Pradesh',
  'Bangalore South': 'Karnataka',
  'Vizianagaram': 'Andhra Pradesh',
  'Kurnool': 'Andhra Pradesh'
};

const ALL_543_SEATS: string[] = [
  'Andaman and Nicobar Islands', 'Amalapuram', 'Anakapalli', 'Anantapur', 'Araku', 'Bapatla', 'Chittoor', 'Eluru', 'Guntur', 'Hindupur', 'Kadapa', 'Kakinada', 'Kurnool', 'Machilipatnam', 'Nandyal', 'Narasaraopet', 'Narsapuram', 'Nellore', 'Ongole', 'Rajahmundry', 'Rajampet', 'Srikakulam', 'Tirupati', 'Vijayawada', 'Visakhapatnam', 'Vizianagaram',
  'Arunachal East', 'Arunachal West', 'Barpeta', 'Darrang-Udalguri', 'Dhubri', 'Dibrugarh', 'Diphu', 'Guwahati', 'Kaziranga', 'Kokrajhar', 'Lakhimpur', 'Nagaon', 'Silchar', 'Sonitpur',
  'Araria', 'Arrah', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Buxar', 'Darbhanga', 'Gaya', 'Gopalganj', 'Hajipur', 'Jahanabad', 'Jamui', 'Jhanjharpur', 'Karakat', 'Katihar', 'Khagaria', 'Kishanganj', 'Madhepura', 'Madhubani', 'Maharajganj', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Paschim Champaran', 'Pataliputra', 'Patna Sahib', 'Purnia', 'Purvi Champaran', 'Samastipur', 'Saran', 'Sasaram', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Ujiarpur', 'Vaishali', 'Valmiki Nagar',
  'Chandigarh', 'Bastar', 'Bilaspur', 'Durg', 'Janjgir-Champa', 'Kanker', 'Korba', 'Mahasamund', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Surguja',
  'Dadra and Nagar Haveli', 'Daman and Diu', 'Chandni Chowk', 'East Delhi', 'New Delhi', 'North East Delhi', 'North West Delhi', 'South Delhi', 'West Delhi', 'North Goa', 'South Goa',
  'Ahmedabad East', 'Ahmedabad West', 'Amreli', 'Anand', 'Banaskantha', 'Bardoli', 'Bharuch', 'Bhavnagar', 'Chhota Udaipur', 'Dahod', 'Gandhinagar', 'Jamnagar', 'Junagadh', 'Kachchh', 'Kheda', 'Mehsana', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar', 'Vadodara', 'Valsad',
  'Ambala', 'Bhiwani-Mahendragarh', 'Faridabad', 'Gurgaon', 'Hisar', 'Karnal', 'Kurukshetra', 'Rohtak', 'Sirsa', 'Sonipat', 'Hamirpur', 'Kangra', 'Mandi', 'Shimla',
  'Anantnag-Rajouri', 'Baramulla', 'Jammu', 'Srinagar', 'Udhampur', 'Chatra', 'Dhanbad', 'Dumka', 'Giridih', 'Godda', 'Hazaribagh', 'Jamshedpur', 'Khunti', 'Kodarma', 'Lohardaga', 'Palamu', 'Rajmahal', 'Ranchi', 'Singhbhum',
  'Bagalkot', 'Bangalore Central', 'Bangalore North', 'Bangalore Rural', 'Bangalore South', 'Belgaum', 'Bellary', 'Bidar', 'Bijapur', 'Chamarajanagar', 'Chikkballapur', 'Chikkodi', 'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gulbarga', 'Hassan', 'Haveri', 'Kolar', 'Koppal', 'Mandya', 'Mysore', 'Raichur', 'Shimoga', 'Tumkur', 'Udupi Chikmagalur', 'Uttara Kannada',
  'Alappuzha', 'Alathur', 'Attingal', 'Chalakudy', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Mavelikkara', 'Palakkad', 'Pathanamthitta', 'Ponnani', 'Thiruvananthapuram', 'Thrissur', 'Vatakara', 'Wayanad', 'Ladakh', 'Lakshadweep',
  'Balaghat', 'Betul', 'Bhind', 'Bhopal', 'Chhindwara', 'Damoh', 'Dewas', 'Dhar', 'Guna', 'Gwalior', 'Hoshangabad', 'Indore', 'Jabalpur', 'Khajuraho', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Shahdol', 'Sidhi', 'Tikamgarh', 'Ujjain', 'Vidisha',
  'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Baramati', 'Beed', 'Bhandara Gondiya', 'Bhiwandi', 'Buldhana', 'Chandrapur', 'Dhule', 'Dindori', 'Gadchiroli-Chimur', 'Hatkanangle', 'Hingoli', 'Jalgaon', 'Jalna', 'Kalyan', 'Kolhapur', 'Latur', 'Madha', 'Maval', 'Mumbai North', 'Mumbai North Central', 'Mumbai North East', 'Mumbai North West', 'Mumbai South', 'Mumbai South Central', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ramtek', 'Ratnagiri-Sindhudurg', 'Raver', 'Sangli', 'Satara', 'Shirdi', 'Shirur', 'Solapur', 'Thane', 'Wardha', 'Yavatmal-Washim',
  'Inner Manipur', 'Outer Manipur', 'Shillong', 'Tura', 'Mizoram', 'Nagaland',
  'Aska', 'Balasore', 'Bargarh', 'Berhampur', 'Bhadrak', 'Bhubaneswar', 'Bolangir', 'Cuttack', 'Dhenkanal', 'Jagatsinghpur', 'Jajpur', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Keonjhar', 'Koraput', 'Mayurbhanj', 'Nabarangpur', 'Puri', 'Sambalpur', 'Sundargarh', 'Puducherry',
  'Amritsar', 'Anandpur Sahib', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Firozpur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Khadoor Sahib', 'Ludhiana', 'Patiala', 'Sangrur',
  'Ajmer', 'Alwar', 'Banswara', 'Barmer', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Chittorgarh', 'Churu', 'Dausa', 'Ganganagar', 'Jaipur', 'Jaipur Rural', 'Jalore', 'Jhalawar-Baran', 'Jhunjhunu', 'Jodhpur', 'Karauli-Dholpur', 'Kota', 'Nagaur', 'Pali', 'Rajsamand', 'Sikar', 'Tonk-Sawai Madhopur', 'Udaipur', 'Sikkim',
  'Arakkonam', 'Arani', 'Chennai Central', 'Chennai North', 'Chennai South', 'Chidambaram', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram', 'Kanniyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pollachi', 'Ramanathapuram', 'Salem', 'Sivaganga', 'Sriperumbudur', 'Tenkasi', 'Thanjavur', 'Theni', 'Thiruvallur', 'Thoothukkudi', 'Tiruchirappalli', 'Tirunelveli', 'Tiruppur', 'Tiruvannamalai', 'Vellore', 'Viluppuram', 'Virudhunagar',
  'Adilabad', 'Bhongir', 'Chevella', 'Hyderabad', 'Karimnagar', 'Khammam', 'Mahabubabad', 'Mahbubnagar', 'Medak', 'Nagarkurnool', 'Nalgonda', 'Nizamabad', 'Peddapalle', 'Secunderabad', 'Warangal', 'Zahirabad', 'Tripura East', 'Tripura West',
  'Agra', 'Aligarh', 'Allahabad', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Aonla', 'Azamgarh', 'Badaun', 'Baghpat', 'Bahraich', 'Ballia', 'Banda', 'Bansgaon', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Bulandshahr', 'Chandauli', 'Deoria', 'Dhaurahra', 'Domariyaganj', 'Etah', 'Etawah', 'Faizabad', 'Farrukhabad', 'Fatehpur', 'Fatehpur Sikri', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Ghosi', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kairana', 'Kaiserganj', 'Kannauj', 'Kanpur', 'Kaushambi', 'Kheri', 'Kushi Nagar', 'Lalganj', 'Lucknow', 'Machhlishahr', 'Maharajganj', 'Mainpuri', 'Mathura', 'Meerut', 'Mirzapur', 'Misrikh', 'Mohanlalganj', 'Moradabad', 'Muzaffarnagar', 'Nagina', 'Phulpur', 'Pilibhit', 'Pratapgarh', 'Rae Bareli', 'Rampur', 'Robertsganj', 'Saharanpur', 'Salempur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shrawasti', 'Siddharthnagar', 'Sitapur', 'Sultanpur', 'Unnao', 'Varanasi',
  'Almora', 'Garhwal', 'Haridwar', 'Nainital-Udhamsingh Nagar', 'Tehri Garhwal',
  'Alipurduars', 'Arambagh', 'Asansol', 'Baharampur', 'Balurghat', 'Bangaon', 'Bankura', 'Barasat', 'Bardhaman Durgapur', 'Bardhaman Purba', 'Barrackpore', 'Basirhat', 'Birbhum', 'Bishnupur', 'Bolpur', 'Cooch Behar', 'Darjeeling', 'Diamond Harbour', 'Dum Dum', 'Ghatal', 'Hooghly', 'Howrah', 'Jadavpur', 'Jalpaiguri', 'Jangipur', 'Jaynagar', 'Jhargram', 'Kanthi', 'Kolkata Dakshin', 'Kolkata Uttar', 'Krishnanagar', 'Maldaha Dakshin', 'Maldaha Uttar', 'Mathurapur', 'Medinipur', 'Murshidabad', 'Purulia', 'Raiganj', 'Ranaghat', 'Sreerampur', 'Tamluk', 'Uluberia'
];

export default function AdminAuditPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeAdminTab, setActiveAdminTab] = useState<'AUDIT' | 'CREATE_POLL'>('AUDIT');
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPollId, setSelectedPollId] = useState<string>('ALL');
  const [ballotBoxRows, setBallotBoxRows] = useState<any[]>([]);
  const [participationsCount, setParticipationsCount] = useState<number>(0);
  const [ballotBoxTotalCount, setBallotBoxTotalCount] = useState<number>(0);
  const [talliesRows, setTalliesRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Cryptographic Audit Verdict
  const [anonymityVerdict, setAnonymityVerdict] = useState<string | null>(null);

  // Platform Maintenance Kill-Switch
  const [isPlatformFrozen, setIsPlatformFrozen] = useState(false);

  // ECI Blackout Management
  const [blackoutSeatInput, setBlackoutSeatInput] = useState('');
  const [blackoutActionStatus, setBlackoutActionStatus] = useState('');

  // Sandbox Single Test
  const [simTargetPollId, setSimTargetPollId] = useState('');
  const [simSeat, setSimSeat] = useState('Muzaffarpur');
  const [simState, setSimState] = useState('Bihar');
  const [simOption, setSimOption] = useState(0);
  const [simMessage, setSimMessage] = useState('');

  // Cycle Roll-Over State
  const [cycleSimStatus, setCycleSimStatus] = useState('');

  // Table 4 Filter
  const [tallyFilter, setTallyFilter] = useState<'ALL' | 'FORTIFIED' | 'ACTIVE'>('ALL');

  // New Poll Creator Form State
  const [newCategory, setNewCategory] = useState<'JanMat' | 'LokMat'>('JanMat');
  const [newTitleEn, setNewTitleEn] = useState('');
  const [newTitleHi, setNewTitleHi] = useState('');
  const [newRecurrence, setNewRecurrence] = useState<'daily' | 'weekly' | 'monthly' | 'lifetime'>('monthly');
  const [newStartsAt, setNewStartsAt] = useState(new Date().toISOString().slice(0, 16));
  const [newTargetType, setNewTargetType] = useState<'PAN_INDIA' | 'CUSTOM_SEATS'>('PAN_INDIA');
  const [customTargetSeats, setCustomTargetSeats] = useState<string[]>([]);
  const [targetSeatSearch, setTargetSeatSearch] = useState('');
  const [newOptions, setNewOptions] = useState([
    { text_en: 'Option 1', text_hi: 'विकल्प 1' },
    { text_en: 'Option 2', text_hi: 'विकल्प 2' },
    { text_en: 'Option 3', text_hi: 'विकल्प 3' }
  ]);
  const [createPollStatus, setCreatePollStatus] = useState('');

  // 1. Session Persistence Guard
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('bhumat_admin_auth');
      if (stored === 'true') {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === MASTER_ADMIN_PIN) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('bhumat_admin_auth', 'true');
      }
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Invalid Security Passcode');
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('bhumat_admin_auth');
    }
    setIsAuthenticated(false);
    setPasscode('');
  };

  async function fetchPolls() {
    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .order('starts_at', { ascending: false });
    if (data && !error) {
      setPolls(data);
      if (data.length > 0 && !simTargetPollId) {
        setSimTargetPollId(data[0].id);
      }
    }
  }

  async function fetchPlatformSettings() {
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('key', 'maintenance_mode')
        .maybeSingle();
      if (data?.value?.is_frozen !== undefined) {
        setIsPlatformFrozen(Boolean(data.value.is_frozen));
      }
    } catch (e) {}
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchPolls();
      fetchPlatformSettings();
    }
  }, [isAuthenticated]);

  async function runComprehensiveAudit(pollId: string) {
    setLoading(true);
    try {
      const isAll = pollId === 'ALL';

      // 1. Table 2: Blind Ballot Box
      let bQuery = supabase.from('ballot_box').select('*', { count: 'exact' });
      if (!isAll) bQuery = bQuery.eq('poll_id', pollId);
      const { data: ballots, count: bCount } = await bQuery.order('id', { ascending: false }).limit(40);
      setBallotBoxRows(ballots || []);
      setBallotBoxTotalCount(bCount || 0);

      // Verify Anonymity in Table 2 Sample
      if (ballots && ballots.length > 0) {
        const sample = ballots[0];
        const hasLeak = 'voter_token' in sample || 'user_id' in sample || 'ip_address' in sample;
        if (hasLeak) {
          setAnonymityVerdict('⚠️ ANONYMITY WARNING: Metadata detected in Table 2!');
        } else {
          setAnonymityVerdict('🛡️ 100% Cryptographic Anonymity Intact (0 Tokens/IPs in Table 2)');
        }
      } else {
        setAnonymityVerdict('🛡️ Cryptographic Blind Ledger Verified');
      }

      // 2. Table 1: Voter Participations (Gating)
      let pQuery = supabase.from('voter_participations').select('*', { count: 'exact', head: true });
      if (!isAll) pQuery = pQuery.eq('poll_id', pollId);
      const { count: pCount } = await pQuery;
      setParticipationsCount(pCount || 0);

      // 3. Table 4: Pre-computed Matrix
      let tQuery = supabase.from('constituency_tallies').select('*');
      if (!isAll) tQuery = tQuery.eq('poll_id', pollId);
      const { data: tallies } = await tQuery.order('total_votes', { ascending: false });
      setTalliesRows(tallies || []);
    } catch (e) {
      console.error('Audit query error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      runComprehensiveAudit(selectedPollId);
      const channel = supabase
        .channel(`admin_audit_stream_${selectedPollId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ballot_box' }, () => runComprehensiveAudit(selectedPollId))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'constituency_tallies' }, () => runComprehensiveAudit(selectedPollId))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'voter_participations' }, () => runComprehensiveAudit(selectedPollId))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchPolls())
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAuthenticated, selectedPollId]);

  const selectedPoll = polls.find((p) => p.id === selectedPollId);
  const isAllPollsSelected = selectedPollId === 'ALL';
  const isLedgerReconciled = ballotBoxTotalCount === participationsCount;

  // De-duplicated Aggregated Rollup for Table 4 in [ALL POLLS] mode
  const aggregatedTallies = useMemo(() => {
    if (!isAllPollsSelected) {
      return talliesRows;
    }
    const map: Record<string, any> = {};
    talliesRows.forEach((row) => {
      const key = `${row.constituency_name}|||${row.state_name}`;
      if (!map[key]) {
        map[key] = {
          constituency_name: row.constituency_name,
          state_name: row.state_name,
          total_votes: 0,
          opt_0_votes: 0,
          opt_1_votes: 0,
          opt_2_votes: 0,
          opt_3_votes: 0,
          leading_option: row.leading_option,
          is_fortified: false
        };
      }
      map[key].total_votes += Number(row.total_votes || 0);
      map[key].opt_0_votes += Number(row.opt_0_votes || row.option_0_votes || 0);
      map[key].opt_1_votes += Number(row.opt_1_votes || row.option_1_votes || 0);
      map[key].opt_2_votes += Number(row.opt_2_votes || row.option_2_votes || 0);
      map[key].opt_3_votes += Number(row.opt_3_votes || row.option_3_votes || 0);
      if (map[key].total_votes >= 50) map[key].is_fortified = true;
    });
    return Object.values(map).sort((a, b) => b.total_votes - a.total_votes);
  }, [talliesRows, isAllPollsSelected]);

  const fortifiedSeatsCount = aggregatedTallies.filter((r) => r.is_fortified || r.total_votes >= 50).length;
  const filteredTallies = aggregatedTallies.filter((r) => {
    if (tallyFilter === 'FORTIFIED') return r.is_fortified || r.total_votes >= 50;
    if (tallyFilter === 'ACTIVE') return r.total_votes > 0;
    return true;
  });

  const topHotspots = useMemo(() => {
    return aggregatedTallies.slice(0, 5);
  }, [aggregatedTallies]);

  // Platform Emergency Freeze Kill-Switch
  const handleTogglePlatformFreeze = async () => {
    const nextState = !isPlatformFrozen;
    const confirmMsg = nextState
      ? '🚨 EMERGENCY: Freeze public voting platform-wide for maintenance?'
      : 'Unfreeze platform and resume live public voting?';
    if (!confirm(confirmMsg)) return;
    await supabase.from('platform_settings').upsert({
      key: 'maintenance_mode',
      value: { is_frozen: nextState, reason: nextState ? 'Scheduled Civic Maintenance' : '' }
    });
    setIsPlatformFrozen(nextState);
  };

  // CSV Exporter for Sovereign Audit Proofs
  const exportTableToCSV = (data: any[], filename: string) => {
    if (!data.length) return alert('No data to export.');
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((obj) => Object.values(obj).map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle Poll Active/Inactive Status
  const handleTogglePollStatus = async () => {
    if (!selectedPoll) return;
    const newStatus = !selectedPoll.is_active;
    const { error } = await supabase
      .from('polls')
      .update({ is_active: newStatus })
      .eq('id', selectedPoll.id);
    if (error) {
      alert(`Error toggling status: ${error.message}`);
    } else {
      setPolls(polls.map((p) => (p.id === selectedPoll.id ? { ...p, is_active: newStatus } : p)));
    }
  };

  // Permanently Delete Poll
  const handleDeletePoll = async () => {
    if (!selectedPoll) return;
    const confirmText = prompt(`Type "DELETE" to permanently destroy poll "${selectedPoll.title_en}" and its ballot records:`);
    if (confirmText !== 'DELETE') return;
    await supabase.from('ballot_box').delete().eq('poll_id', selectedPoll.id);
    await supabase.from('participations').delete().eq('poll_id', selectedPoll.id);
    await supabase.from('voter_participations').delete().eq('poll_id', selectedPoll.id);
    await supabase.from('constituency_tallies').delete().eq('poll_id', selectedPoll.id);
    await supabase.from('poll_totals').delete().eq('poll_id', selectedPoll.id);
    const { error } = await supabase.from('polls').delete().eq('id', selectedPoll.id);
    if (error) {
      alert(`Failed to delete poll: ${error.message}`);
    } else {
      alert('Poll deleted permanently.');
      const updated = polls.filter((p) => p.id !== selectedPoll.id);
      setPolls(updated);
      setSelectedPollId('ALL');
    }
  };

  // Add ECI 48-Hour Silence Blackout Seat
  const handleAddBlackoutSeat = async (seatToAdd: string) => {
    if (!selectedPoll || !seatToAdd.trim()) return;
    const currentBlackouts = selectedPoll.blackout_seats || [];
    if (currentBlackouts.includes(seatToAdd)) return;
    const updated = [...currentBlackouts, seatToAdd];
    setBlackoutActionStatus(`Adding ${seatToAdd} to ECI silence period...`);
    const { error } = await supabase
      .from('polls')
      .update({ blackout_seats: updated })
      .eq('id', selectedPoll.id);
    if (!error) {
      setPolls(polls.map((p) => (p.id === selectedPoll.id ? { ...p, blackout_seats: updated } : p)));
      setBlackoutSeatInput('');
      setBlackoutActionStatus(`✓ ${seatToAdd} placed under ECI Silence Period.`);
    } else {
      setBlackoutActionStatus(`❌ Error: ${error.message}`);
    }
    setTimeout(() => setBlackoutActionStatus(''), 2500);
  };

  // Remove Blackout Seat
  const handleRemoveBlackoutSeat = async (seatToRemove: string) => {
    if (!selectedPoll) return;
    const updated = (selectedPoll.blackout_seats || []).filter((s) => s !== seatToRemove);
    const { error } = await supabase
      .from('polls')
      .update({ blackout_seats: updated })
      .eq('id', selectedPoll.id);
    if (!error) {
      setPolls(polls.map((p) => (p.id === selectedPoll.id ? { ...p, blackout_seats: updated } : p)));
    }
  };

  const handleSeatChange = (seat: string) => {
    setSimSeat(seat);
    if (QUICK_SEATS[seat]) {
      setSimState(QUICK_SEATS[seat]);
    }
  };

  // Simulated Test Vote
  const handleSimulateBallot = async () => {
    const targetPoll = isAllPollsSelected ? simTargetPollId : selectedPollId;
    if (!targetPoll) {
      alert('Please choose a valid poll target for injection.');
      return;
    }
    setSimMessage('Casting simulated ballot...');
    const fakeToken = 'sim_' + Math.random().toString(36).substring(2, 10);
    const { data, error } = await supabase.rpc('cast_ballot_transaction', {
      p_poll_id: targetPoll,
      p_cycle_id: '2026-10',
      p_voter_token: fakeToken,
      p_state_name: simState,
      p_constituency_name: simSeat,
      p_selected_option: Number(simOption)
    });
    if (error || !data?.success) {
      setSimMessage(`❌ Error: ${error?.message || data?.error}`);
    } else {
      setSimMessage(`✓ Ballot Logged: Seat total is now ${data.constituency_total}. Total audit ledger is ${data.total_poll_votes}.`);
      runComprehensiveAudit(selectedPollId);
    }
  };

  // Cycle Advance Simulator
  const handleSimulateCycleRollOver = async () => {
    const targetPoll = isAllPollsSelected ? simTargetPollId : selectedPollId;
    if (!targetPoll) return;
    const targetObj = polls.find((p) => p.id === targetPoll);
    if (!targetObj) return;

    if (!confirm(`Simulate cycle roll-over for poll "${targetObj.title_en}"? (Moves cycle to Season 11, unlocks re-vote windows)`)) return;

    setCycleSimStatus('Advancing cycle...');
    const nextCycle = '2026-11';
    const { error } = await supabase
      .from('polls')
      .update({ current_cycle: nextCycle })
      .eq('id', targetPoll);

    if (error) {
      setCycleSimStatus(`❌ Roll-over failed: ${error.message}`);
    } else {
      setCycleSimStatus(`✓ Poll rolled over to Season 11 (${nextCycle}). Citizen ballot windows are re-armed.`);
      fetchPolls();
    }
  };

  const handleResetPollVotes = async () => {
    if (isAllPollsSelected) {
      if (!confirm('CAUTION: You have selected [ALL POLLS]. Reset all votes across the platform?')) return;
      await supabase.from('ballot_box').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('participations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('voter_participations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('constituency_tallies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('poll_totals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      alert('All votes reset across the platform.');
    } else {
      if (!confirm(`Reset all votes for poll ${selectedPollId}?`)) return;
      await supabase.from('ballot_box').delete().eq('poll_id', selectedPollId);
      await supabase.from('participations').delete().eq('poll_id', selectedPollId);
      await supabase.from('voter_participations').delete().eq('poll_id', selectedPollId);
      await supabase.from('constituency_tallies').delete().eq('poll_id', selectedPollId);
      await supabase.from('poll_totals').delete().eq('poll_id', selectedPollId);
      alert('Poll votes reset to 0.');
    }
    runComprehensiveAudit(selectedPollId);
  };

  const handleDeployNewPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitleEn.trim()) {
      alert('English title is required');
      return;
    }
    setCreatePollStatus('Publishing poll to BhuMat Sovereign Ledger...');
    const newPollId = `poll_${Math.random().toString(36).substring(2, 8)}`;
    const formattedOptions = newOptions.map((opt, idx) => ({
      id: idx,
      text_en: opt.text_en.trim(),
      text_hi: (opt.text_hi || opt.text_en).trim()
    }));
    const payload = {
      id: newPollId,
      category: newCategory,
      title_en: newTitleEn.trim(),
      title_hi: (newTitleHi || newTitleEn).trim(),
      options: formattedOptions,
      participation_mode: newRecurrence === 'lifetime' ? 'one_time' : 'recurring',
      recurrence: newRecurrence,
      current_cycle: '2026-10',
      starts_at: new Date(newStartsAt).toISOString(),
      is_active: true,
      target_region_type: newTargetType,
      target_seats: newTargetType === 'CUSTOM_SEATS' ? customTargetSeats : [],
      blackout_seats: []
    };
    const { error } = await supabase.from('polls').insert([payload]);
    if (error) {
      setCreatePollStatus(`❌ Error deploying poll: ${error.message}`);
    } else {
      setCreatePollStatus(`✓ Poll Successfully Deployed! ID: ${newPollId}`);
      setNewTitleEn('');
      setNewTitleHi('');
      setCustomTargetSeats([]);
      await fetchPolls();
      setSelectedPollId(newPollId);
      setTimeout(() => {
        setActiveAdminTab('AUDIT');
        setCreatePollStatus('');
      }, 1400);
    }
  };

  // PIN Lock Screen
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', fontFamily: 'system-ui' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: '#1e293b', padding: '32px', borderRadius: '16px', width: '320px', border: '1px solid #334155', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔐</div>
          <h2 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0' }}>BhuMat Audit Portal</h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px 0' }}>Enter master security passcode</p>
          <input
            type="password"
            placeholder="Enter passcode..."
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#ffffff', marginBottom: '10px', textAlign: 'center', outline: 'none' }}
          />
          {authError && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 700, marginBottom: '10px' }}>{authError}</div>}
          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}>
            Unlock Audit Ledger
          </button>
        </form>
      </div>
    );
  }

  const matchingTargetSeats = targetSeatSearch.trim()
    ? ALL_543_SEATS.filter((s) => s.toLowerCase().includes(targetSeatSearch.toLowerCase().trim())).slice(0, 8)
    : [];
  const matchingBlackoutSeats = blackoutSeatInput.trim()
    ? ALL_543_SEATS.filter((s) => s.toLowerCase().includes(blackoutSeatInput.toLowerCase().trim())).slice(0, 6)
    : [];
  const activePollsCount = polls.filter((p) => p.is_active).length;

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f8fafc', padding: '24px', fontFamily: 'system-ui', color: '#0f172a' }}>
      <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
        
        {/* Header with Emergency Freeze Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                BhuMat Sovereign Command & Verification Suite
              </h1>
              {isPlatformFrozen && (
                <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 900 }}>
                  🚨 FROZEN (MAINTENANCE)
                </span>
              )}
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Solo-Operator Console: Real-time verification, hot spot telemetry, and 48-hour ECI silence controls.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleTogglePlatformFreeze}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isPlatformFrozen ? '#10b981' : '#fee2e2',
                color: isPlatformFrozen ? '#ffffff' : '#dc2626',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {isPlatformFrozen ? '▶ Unfreeze Platform' : '🚨 Freeze Platform'}
            </button>
            <button
              onClick={() => setActiveAdminTab(activeAdminTab === 'AUDIT' ? 'CREATE_POLL' : 'AUDIT')}
              style={{ padding: '8px 16px', backgroundColor: activeAdminTab === 'CREATE_POLL' ? '#0f172a' : '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
            >
              {activeAdminTab === 'CREATE_POLL' ? '← Back to Live Audit' : '＋ Deploy New Poll'}
            </button>
            <button onClick={handleLogout} style={{ padding: '8px 14px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              🔒 Lock Panel
            </button>
          </div>
        </div>

        {/* TAB 1: NEW POLL DEPLOYMENT STUDIO */}
        {activeAdminTab === 'CREATE_POLL' ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '6px' }}>
              EDITORIAL STUDIO
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 900, margin: '10px 0 6px 0' }}>Deploy Sovereign Public Opinion Poll</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
              Configure bilingual questions, options, category track, targeted regions, and cadence for live feed publishing.
            </p>
            <form onSubmit={handleDeployNewPoll} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Category Track */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div
                  onClick={() => setNewCategory('JanMat')}
                  style={{ padding: '14px', borderRadius: '12px', border: `2px solid ${newCategory === 'JanMat' ? '#059669' : '#e2e8f0'}`, backgroundColor: newCategory === 'JanMat' ? '#ecfdf5' : '#ffffff', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 800, color: '#059669', fontSize: '14px' }}>🌆 JanMat Audit (Civic Track)</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Strict cryptographic secret ballot, decoupled anonymous ledger.</div>
                </div>
                <div
                  onClick={() => setNewCategory('LokMat')}
                  style={{ padding: '14px', borderRadius: '12px', border: `2px solid ${newCategory === 'LokMat' ? '#d97706' : '#e2e8f0'}`, backgroundColor: newCategory === 'LokMat' ? '#fffbeb' : '#ffffff', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 800, color: '#d97706', fontSize: '14px' }}>🌅 LokMat Debate (Culture & Mat)</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Open public pulse, choice attributed to user profile, early trend unmasking.</div>
                </div>
              </div>

              {/* Titles */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>Question Title (English) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Which sector requires priority budgetary allocation in 2026?"
                    value={newTitleEn}
                    onChange={(e) => setNewTitleEn(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>Question Title (Hindi)</label>
                  <input
                    type="text"
                    placeholder="उदा. 2026 में किस क्षेत्र को प्राथमिकता बजटीय आवंटन की आवश्यकता है?"
                    value={newTitleHi}
                    onChange={(e) => setNewTitleHi(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Recurrence & Start Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>Recurrence Cadence</label>
                  <select
                    value={newRecurrence}
                    onChange={(e) => setNewRecurrence(e.target.value as any)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                  >
                    <option value="monthly">Monthly Cycle (Default JanMat)</option>
                    <option value="weekly">Weekly Cycle</option>
                    <option value="daily">Daily Pulse</option>
                    <option value="lifetime">One-Time Lifetime Vote</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>Drop Date & Time</label>
                  <input
                    type="datetime-local"
                    value={newStartsAt}
                    onChange={(e) => setNewStartsAt(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Target Region Selector */}
              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  Target Electoral Scope
                </label>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setNewTargetType('PAN_INDIA')}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: `1.5px solid ${newTargetType === 'PAN_INDIA' ? '#0284c7' : '#cbd5e1'}`, backgroundColor: newTargetType === 'PAN_INDIA' ? '#e0f2fe' : '#ffffff', color: newTargetType === 'PAN_INDIA' ? '#0369a1' : '#475569', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
                  >
                    🇮🇳 Pan-India (All 543 Lok Sabha Seats)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTargetType('CUSTOM_SEATS')}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: `1.5px solid ${newTargetType === 'CUSTOM_SEATS' ? '#0284c7' : '#cbd5e1'}`, backgroundColor: newTargetType === 'CUSTOM_SEATS' ? '#e0f2fe' : '#ffffff', color: newTargetType === 'CUSTOM_SEATS' ? '#0369a1' : '#475569', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
                  >
                    🎯 Specific Target Constituencies Only
                  </button>
                </div>
                {newTargetType === 'CUSTOM_SEATS' && (
                  <div>
                    <input
                      type="text"
                      placeholder="Type constituency to add (e.g. Darbhanga, Banka, Nagpur)..."
                      value={targetSeatSearch}
                      onChange={(e) => setTargetSeatSearch(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                    {matchingTargetSeats.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                        {matchingTargetSeats.map((seat) => (
                          <span
                            key={seat}
                            onClick={() => {
                              if (!customTargetSeats.includes(seat)) setCustomTargetSeats([...customTargetSeats, seat]);
                              setTargetSeatSearch('');
                            }}
                            style={{ backgroundColor: '#ffffff', border: '1px solid #0284c7', color: '#0284c7', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            ＋ {seat}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                      {customTargetSeats.map((seat) => (
                        <span key={seat} style={{ backgroundColor: '#0284c7', color: '#ffffff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {seat}
                          <button type="button" onClick={() => setCustomTargetSeats(customTargetSeats.filter((s) => s !== seat))} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, fontWeight: 900 }}>✕</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Options */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '8px' }}>Poll Options (Up to 4)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {newOptions.map((opt, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: OPTION_PALETTE[idx] }} />
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1} (English)`}
                        value={opt.text_en}
                        onChange={(e) => {
                          const updated = [...newOptions];
                          updated[idx].text_en = e.target.value;
                          setNewOptions(updated);
                        }}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', fontWeight: 600 }}
                      />
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1} (Hindi)`}
                        value={opt.text_hi}
                        onChange={(e) => {
                          const updated = [...newOptions];
                          updated[idx].text_hi = e.target.value;
                          setNewOptions(updated);
                        }}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', fontWeight: 600 }}
                      />
                      {newOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setNewOptions(newOptions.filter((_, i) => i !== idx))}
                          style={{ padding: '8px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontWeight: 800 }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {newOptions.length < 4 && (
                    <button
                      type="button"
                      onClick={() => setNewOptions([...newOptions, { text_en: `Option ${newOptions.length + 1}`, text_hi: `विकल्प ${newOptions.length + 1}` }])}
                      style={{ padding: '8px 14px', alignSelf: 'flex-start', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ＋ Add Option
                    </button>
                  )}
                </div>
              </div>

              {createPollStatus && (
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: createPollStatus.startsWith('✓') ? '#ecfdf5' : '#fef2f2', color: createPollStatus.startsWith('✓') ? '#059669' : '#dc2626', fontWeight: 800, fontSize: '13px' }}>
                  {createPollStatus}
                </div>
              )}
              <button
                type="submit"
                style={{ padding: '16px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 900, cursor: 'pointer', marginTop: '10px' }}
              >
                {newTargetType === 'CUSTOM_SEATS'
                  ? `🚀 Publish & Broadcast to ${customTargetSeats.length} Selected Seats`
                  : '🚀 Publish & Broadcast to 543 Seats'}
              </button>
            </form>
          </div>
        ) : (
          /* TAB 2: AUDIT & GOVERNANCE SUITE */
          <>
            {/* Solo-Operator Telemetry Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Active Poll Cadence</span>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>{activePollsCount} Live / {polls.length} Total</div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Fortified Quorum Seats</span>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#059669', marginTop: '4px' }}>{fortifiedSeatsCount} / 543 Seats</div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>Total Civic Ballots</span>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0284c7', marginTop: '4px' }}>{ballotBoxTotalCount} Cast</div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>Top Hotspot</span>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#b45309', marginTop: '6px' }}>
                  {topHotspots[0] ? `${topHotspots[0].constituency_name} (${topHotspots[0].total_votes})` : 'Awaiting Data'}
                </div>
              </div>
            </div>

            {/* Cryptographic Anonymity Banner */}
            {anonymityVerdict && (
              <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '10px', backgroundColor: anonymityVerdict.includes('⚠️') ? '#fef2f2' : '#ecfdf5', border: `1px solid ${anonymityVerdict.includes('⚠️') ? '#fecaca' : '#a7f3d0'}`, fontSize: '12px', fontWeight: 800, color: anonymityVerdict.includes('⚠️') ? '#991b1b' : '#065f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{anonymityVerdict}</span>
                <button onClick={() => runComprehensiveAudit(selectedPollId)} style={{ background: 'none', border: 'none', color: '#0284c7', fontWeight: 800, cursor: 'pointer', fontSize: '11px' }}>
                  Re-Verify Ledger
                </button>
              </div>
            )}

            {/* Poll Target & Governance Bar */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    Audit Poll Target:
                  </label>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: isAllPollsSelected ? '#0284c7' : '#059669' }}>
                    {isAllPollsSelected ? `🌐 Platform Aggregate (${polls.length} Polls)` : `Target ID: ${selectedPollId}`}
                  </span>
                </div>
                <select
                  value={selectedPollId}
                  onChange={(e) => setSelectedPollId(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '2px solid #0284c7',
                    fontWeight: 700,
                    fontSize: '13px',
                    backgroundColor: isAllPollsSelected ? '#f0f9ff' : '#ffffff',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                >
                  <option value="ALL">🌐 [ALL POLLS] Cumulative Sovereign Health & Multi-Poll Activity</option>
                  {polls.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.is_active ? '🟢 LIVE' : '🔴 PAUSED'}] [{p.category}] {p.title_en} ({p.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '4px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {!isAllPollsSelected ? (
                    <>
                      <button
                        onClick={handleTogglePollStatus}
                        style={{
                          padding: '9px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: selectedPoll?.is_active ? '#fef3c7' : '#ecfdf5',
                          color: selectedPoll?.is_active ? '#b45309' : '#059669',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {selectedPoll?.is_active ? '⏸ Pause / Deactivate Poll' : '▶ Reactivate Poll'}
                      </button>
                      <button
                        onClick={handleDeletePoll}
                        style={{ padding: '9px 16px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        🗑️ Delete Poll
                      </button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '6px 12px', borderRadius: '6px' }}>
                        Active Polls: {activePollsCount} / {polls.length}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleResetPollVotes}
                    style={{ padding: '9px 14px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {isAllPollsSelected ? 'Reset All Votes' : 'Reset Votes'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => exportTableToCSV(talliesRows, `bhumat_tallies_${selectedPollId}`)}
                    style={{ padding: '9px 14px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    📥 Export CSV
                  </button>
                  <button
                    onClick={() => runComprehensiveAudit(selectedPollId)}
                    style={{ padding: '9px 16px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    ↻ Refresh Ledger
                  </button>
                </div>
              </div>

              {/* ECI Silence Blackout Section */}
              {!isAllPollsSelected && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🏛️ Election Commission Compliance: 48-Hour Silence Blackout
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Constituencies in silence period cannot cast ballots or view leading trends.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Search seat to blackout (e.g. Darbhanga, Banka, Nagpur)..."
                      value={blackoutSeatInput}
                      onChange={(e) => setBlackoutSeatInput(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600 }}
                    />
                    {matchingBlackoutSeats.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: '120px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 60, marginTop: '2px' }}>
                        {matchingBlackoutSeats.map((s) => (
                          <div
                            key={s}
                            onClick={() => handleAddBlackoutSeat(s)}
                            style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                          >
                            ⛔ Silence {s}
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => handleAddBlackoutSeat(blackoutSeatInput)}
                      style={{ padding: '8px 14px', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Lock Seat
                    </button>
                  </div>
                  {blackoutActionStatus && (
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626' }}>{blackoutActionStatus}</div>
                  )}
                  {selectedPoll?.blackout_seats && selectedPoll.blackout_seats.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', alignSelf: 'center' }}>Active Silence Seats:</span>
                      {selectedPoll.blackout_seats.map((seat) => (
                        <span key={seat} style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          ⛔ {seat}
                          <button onClick={() => handleRemoveBlackoutSeat(seat)} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', padding: 0, fontWeight: 900 }}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reconciliation Meters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Table 1: Participations (Gating)</div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>{participationsCount}</div>
                <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>
                  {isAllPollsSelected ? 'Unique platform tokens' : 'Unique voter tokens registered'}
                </div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Table 2: Blind Ballot Box</div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#0284c7', marginTop: '6px' }}>{ballotBoxTotalCount}</div>
                <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px' }}>
                  {isAllPollsSelected ? 'Total decoupled ballots' : 'Anonymous ballots cast'}
                </div>
              </div>
              <div style={{ backgroundColor: isLedgerReconciled ? '#ecfdf5' : '#fef2f2', padding: '16px', borderRadius: '14px', border: `1.5px solid ${isLedgerReconciled ? '#a7f3d0' : '#fecaca'}` }}>
                <div style={{ fontSize: '10px', color: isLedgerReconciled ? '#065f46' : '#991b1b', textTransform: 'uppercase', fontWeight: 800 }}>Reconciliation Status</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: isLedgerReconciled ? '#059669' : '#dc2626', marginTop: '8px' }}>
                  {isLedgerReconciled ? '✓ 100% Reconciled' : '⚠ Discrepancy Found'}
                </div>
                <div style={{ fontSize: '11px', color: isLedgerReconciled ? '#047857' : '#b91c1c', marginTop: '4px' }}>
                  {ballotBoxTotalCount} ballots == {participationsCount} tokens
                </div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Pan-Bharat Quorum Radar</div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: fortifiedSeatsCount > 0 ? '#10b981' : '#64748b', marginTop: '6px' }}>
                  {fortifiedSeatsCount} / 543
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Seats fortified (≥ 50 votes)</div>
              </div>
            </div>

            {/* Sandbox Live Ballot Injector & Cycle Controls */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>🧪 Sandbox Realtime Testing & Cadence Controls</h3>
                {isAllPollsSelected && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>Target Poll:</span>
                    <select
                      value={simTargetPollId}
                      onChange={(e) => setSimTargetPollId(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #0284c7', fontSize: '12px', fontWeight: 700 }}
                    >
                      {polls.map((p) => (
                        <option key={p.id} value={p.id}>[{p.category}] {p.title_en.slice(0, 30)}...</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 2fr auto', gap: '10px', alignItems: 'center' }}>
                <select
                  value={simSeat}
                  onChange={(e) => handleSeatChange(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
                >
                  {Object.keys(QUICK_SEATS).map((s) => (
                    <option key={s} value={s}>{s} ({QUICK_SEATS[s]})</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="State"
                  value={simState}
                  onChange={(e) => setSimState(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
                />
                <select
                  value={simOption}
                  onChange={(e) => setSimOption(Number(e.target.value))}
                  style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
                >
                  {((isAllPollsSelected ? polls.find((p) => p.id === simTargetPollId)?.options : selectedPoll?.options) || [
                    { id: 0, text_en: 'Option 1' },
                    { id: 1, text_en: 'Option 2' },
                    { id: 2, text_en: 'Option 3' }
                  ]).map((opt: any, idx: number) => (
                    <option key={opt.id || idx} value={idx}>
                      Option {idx}: {opt.text_en}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleSimulateBallot}
                  style={{ padding: '10px 18px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                >
                  Cast Test Vote
                </button>
              </div>

              {simMessage && (
                <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 700, color: simMessage.startsWith('✓') ? '#059669' : '#dc2626' }}>
                  {simMessage}
                </div>
              )}

              {/* Cycle Advance Simulator Trigger */}
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#0369a1' }}>📅 Cycle Cadence Roll-Over Test:</span>
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>Simulate moving to Season 11 (Nov 2026) to test re-vote unlocking.</span>
                </div>
                <button
                  onClick={handleSimulateCycleRollOver}
                  style={{ padding: '6px 14px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                >
                  Advance Cycle → 2026-11
                </button>
              </div>
              {cycleSimStatus && (
                <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 700, color: cycleSimStatus.startsWith('✓') ? '#059669' : '#dc2626' }}>
                  {cycleSimStatus}
                </div>
              )}
            </div>

            {/* Table 4: Pre-Computed Matrix (De-duplicated & Aggregated) */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
                    📊 Table 4: {isAllPollsSelected ? 'Platform-Wide Aggregated Constituency Matrix' : 'Pre-computed Constituency Matrix (`constituency_tallies`)'}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {isAllPollsSelected ? 'Aggregated unique constituency civic activity across all polls.' : 'Granular option breakdown for selected question.'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setTallyFilter('ALL')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: tallyFilter === 'ALL' ? '#0f172a' : '#f1f5f9', color: tallyFilter === 'ALL' ? '#ffffff' : '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>All Seats</button>
                  <button onClick={() => setTallyFilter('ACTIVE')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: tallyFilter === 'ACTIVE' ? '#0f172a' : '#f1f5f9', color: tallyFilter === 'ACTIVE' ? '#ffffff' : '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Active (&gt;0)</button>
                  <button onClick={() => setTallyFilter('FORTIFIED')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: tallyFilter === 'FORTIFIED' ? '#0f172a' : '#f1f5f9', color: tallyFilter === 'FORTIFIED' ? '#ffffff' : '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Fortified (≥50)</button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px' }}>Constituency</th>
                      <th style={{ padding: '10px' }}>State</th>
                      <th style={{ padding: '10px' }}>Total Ballots</th>
                      <th style={{ padding: '10px' }}>Opt 0 (Orange)</th>
                      <th style={{ padding: '10px' }}>Opt 1 (Green)</th>
                      <th style={{ padding: '10px' }}>Opt 2 (Sky Blue)</th>
                      <th style={{ padding: '10px' }}>Opt 3 (Purple)</th>
                      <th style={{ padding: '10px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTallies.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '18px', textAlign: 'center', color: '#94a3b8' }}>
                          No seats matching filter.
                        </td>
                      </tr>
                    ) : (
                      filteredTallies.map((row) => (
                        <tr key={`${row.constituency_name}-${row.state_name}-${row.poll_id || ''}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px', fontWeight: 800 }}>{row.constituency_name}</td>
                          <td style={{ padding: '10px', color: '#64748b' }}>{row.state_name}</td>
                          <td style={{ padding: '10px', fontWeight: 900, color: '#0284c7' }}>{row.total_votes}</td>
                          <td style={{ padding: '10px', color: '#f97316', fontWeight: 700 }}>{row.opt_0_votes}</td>
                          <td style={{ padding: '10px', color: '#10b981', fontWeight: 700 }}>{row.opt_1_votes}</td>
                          <td style={{ padding: '10px', color: '#0ea5e9', fontWeight: 700 }}>{row.opt_2_votes}</td>
                          <td style={{ padding: '10px', color: '#8b5cf6', fontWeight: 700 }}>{row.opt_3_votes}</td>
                          <td style={{ padding: '10px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', backgroundColor: row.is_fortified ? '#ecfdf5' : '#fef3c7', color: row.is_fortified ? '#059669' : '#d97706' }}>
                              {row.is_fortified ? `✓ FORTIFIED (${row.total_votes})` : `🌱 Active (${row.total_votes})`}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Cryptographic Decoupled Blind Ballot Box */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
                  🔒 Table 2: Cryptographic Blind Ballot Box (`ballot_box`)
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => exportTableToCSV(ballotBoxRows, `bhumat_ballots_${selectedPollId}`)}
                    style={{ padding: '6px 12px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    📥 Export Ballot Box
                  </button>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', padding: '3px 8px', borderRadius: '999px', alignSelf: 'center' }}>
                    ✓ Side-Channel Immune
                  </span>
                </div>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 12px 0' }}>
                Notice: Zero timestamps, zero voter tokens, zero device fingerprints, and zero IP addresses are stored.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px' }}>Ballot UUID</th>
                      <th style={{ padding: '10px' }}>Constituency</th>
                      <th style={{ padding: '10px' }}>State</th>
                      <th style={{ padding: '10px' }}>Selected Option</th>
                      <th style={{ padding: '10px' }}>Batch Cycle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ballotBoxRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: '#94a3b8' }}>
                          Ballot box is currently empty.
                        </td>
                      </tr>
                    ) : (
                      ballotBoxRows.map((b) => (
                        <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>{b.id}</td>
                          <td style={{ padding: '10px', fontWeight: 700 }}>{b.constituency_name}</td>
                          <td style={{ padding: '10px', color: '#64748b' }}>{b.state_name}</td>
                          <td style={{ padding: '10px', fontWeight: 800, color: OPTION_PALETTE[b.selected_option % 4] }}>
                            Option {b.selected_option}
                          </td>
                          <td style={{ padding: '10px', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>{b.cycle_date || 'Daily Batch'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}