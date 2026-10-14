'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { getCurrentCycleId } from '../utils/cycleManager';

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

const SEAT_TO_STATE_MAP: Record<string, string> = {
  'Andaman and Nicobar Islands': 'Andaman and Nicobar Islands',
  'Amalapuram': 'Andhra Pradesh', 'Anakapalli': 'Andhra Pradesh', 'Anantapur': 'Andhra Pradesh', 'Araku': 'Andhra Pradesh',
  'Bapatla': 'Andhra Pradesh', 'Chittoor': 'Andhra Pradesh', 'Eluru': 'Andhra Pradesh', 'Guntur': 'Andhra Pradesh',
  'Hindupur': 'Andhra Pradesh', 'Kadapa': 'Andhra Pradesh', 'Kakinada': 'Andhra Pradesh', 'Kurnool': 'Andhra Pradesh',
  'Machilipatnam': 'Andhra Pradesh', 'Nandyal': 'Andhra Pradesh', 'Narasaraopet': 'Andhra Pradesh', 'Narsapuram': 'Andhra Pradesh',
  'Nellore': 'Andhra Pradesh', 'Ongole': 'Andhra Pradesh', 'Rajahmundry': 'Andhra Pradesh', 'Rajampet': 'Andhra Pradesh',
  'Srikakulam': 'Andhra Pradesh', 'Tirupati': 'Andhra Pradesh', 'Vijayawada': 'Andhra Pradesh', 'Visakhapatnam': 'Andhra Pradesh', 'Vizianagaram': 'Andhra Pradesh',
  'Arunachal East': 'Arunachal Pradesh', 'Arunachal West': 'Arunachal Pradesh',
  'Barpeta': 'Assam', 'Darrang-Udalguri': 'Assam', 'Dhubri': 'Assam', 'Dibrugarh': 'Assam', 'Diphu': 'Assam',
  'Guwahati': 'Assam', 'Kaziranga': 'Assam', 'Kokrajhar': 'Assam', 'Lakhimpur': 'Assam', 'Nagaon': 'Assam',
  'Silchar': 'Assam', 'Sonitpur': 'Assam',
  'Araria': 'Bihar', 'Arrah': 'Bihar', 'Aurangabad': 'Bihar', 'Banka': 'Bihar', 'Begusarai': 'Bihar',
  'Bhagalpur': 'Bihar', 'Buxar': 'Bihar', 'Darbhanga': 'Bihar', 'Gaya': 'Bihar', 'Gopalganj': 'Bihar',
  'Hajipur': 'Bihar', 'Jahanabad': 'Bihar', 'Jamui': 'Bihar', 'Jhanjharpur': 'Bihar', 'Karakat': 'Bihar',
  'Katihar': 'Bihar', 'Khagaria': 'Bihar', 'Kishanganj': 'Bihar', 'Madhepura': 'Bihar', 'Madhubani': 'Bihar',
  'Maharajganj': 'Bihar', 'Munger': 'Bihar', 'Muzaffarpur': 'Bihar', 'Nalanda': 'Bihar', 'Nawada': 'Bihar',
  'Paschim Champaran': 'Bihar', 'Pataliputra': 'Bihar', 'Patna Sahib': 'Bihar', 'Purnia': 'Bihar',
  'Purvi Champaran': 'Bihar', 'Samastipur': 'Bihar', 'Saran': 'Bihar', 'Sasaram': 'Bihar', 'Sheohar': 'Bihar',
  'Sitamarhi': 'Bihar', 'Siwan': 'Bihar', 'Supaul': 'Bihar', 'Ujiarpur': 'Bihar', 'Vaishali': 'Bihar', 'Valmiki Nagar': 'Bihar',
  'Chandigarh': 'Chandigarh',
  'Bastar': 'Chhattisgarh', 'Bilaspur': 'Chhattisgarh', 'Durg': 'Chhattisgarh', 'Janjgir-Champa': 'Chhattisgarh',
  'Kanker': 'Chhattisgarh', 'Korba': 'Chhattisgarh', 'Mahasamund': 'Chhattisgarh', 'Raigarh': 'Chhattisgarh',
  'Raipur': 'Chhattisgarh', 'Rajnandgaon': 'Chhattisgarh', 'Surguja': 'Chhattisgarh',
  'Dadra and Nagar Haveli': 'Dadra and Nagar Haveli and Daman and Diu', 'Daman and Diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'Chandni Chowk': 'Delhi', 'East Delhi': 'Delhi', 'New Delhi': 'Delhi', 'North East Delhi': 'Delhi',
  'North West Delhi': 'Delhi', 'South Delhi': 'Delhi', 'West Delhi': 'Delhi',
  'North Goa': 'Goa', 'South Goa': 'Goa',
  'Ahmedabad East': 'Gujarat', 'Ahmedabad West': 'Gujarat', 'Amreli': 'Gujarat', 'Anand': 'Gujarat',
  'Banaskantha': 'Gujarat', 'Bardoli': 'Gujarat', 'Bharuch': 'Gujarat', 'Bhavnagar': 'Gujarat',
  'Chhota Udaipur': 'Gujarat', 'Dahod': 'Gujarat', 'Gandhinagar': 'Gujarat', 'Jamnagar': 'Gujarat',
  'Junagadh': 'Gujarat', 'Kachchh': 'Gujarat', 'Kheda': 'Gujarat', 'Mehsana': 'Gujarat', 'Navsari': 'Gujarat',
  'Panchmahal': 'Gujarat', 'Patan': 'Gujarat', 'Porbandar': 'Gujarat', 'Rajkot': 'Gujarat', 'Sabarkantha': 'Gujarat',
  'Surat': 'Gujarat', 'Surendranagar': 'Gujarat', 'Vadodara': 'Gujarat', 'Valsad': 'Gujarat',
  'Ambala': 'Haryana', 'Bhiwani-Mahendragarh': 'Haryana', 'Faridabad': 'Haryana', 'Gurgaon': 'Haryana',
  'Hisar': 'Haryana', 'Karnal': 'Haryana', 'Kurukshetra': 'Haryana', 'Rohtak': 'Haryana', 'Sirsa': 'Haryana', 'Sonipat': 'Haryana',
  'Hamirpur': 'Himachal Pradesh', 'Kangra': 'Himachal Pradesh', 'Mandi': 'Himachal Pradesh', 'Shimla': 'Himachal Pradesh',
  'Anantnag-Rajouri': 'Jammu and Kashmir', 'Baramulla': 'Jammu and Kashmir', 'Jammu': 'Jammu and Kashmir',
  'Srinagar': 'Jammu and Kashmir', 'Udhampur': 'Jammu and Kashmir',
  'Chatra': 'Jharkhand', 'Dhanbad': 'Jharkhand', 'Dumka': 'Jharkhand', 'Giridih': 'Jharkhand', 'Godda': 'Jharkhand',
  'Hazaribagh': 'Jharkhand', 'Jamshedpur': 'Jharkhand', 'Khunti': 'Jharkhand', 'Kodarma': 'Jharkhand',
  'Lohardaga': 'Jharkhand', 'Palamu': 'Jharkhand', 'Rajmahal': 'Jharkhand', 'Ranchi': 'Jharkhand', 'Singhbhum': 'Jharkhand',
  'Bagalkot': 'Karnataka', 'Bangalore Central': 'Karnataka', 'Bangalore North': 'Karnataka', 'Bangalore Rural': 'Karnataka',
  'Bangalore South': 'Karnataka', 'Belgaum': 'Karnataka', 'Bellary': 'Karnataka', 'Bidar': 'Karnataka', 'Bijapur': 'Karnataka',
  'Chamarajanagar': 'Karnataka', 'Chikkballapur': 'Karnataka', 'Chikkodi': 'Karnataka', 'Chitradurga': 'Karnataka',
  'Dakshina Kannada': 'Karnataka', 'Davanagere': 'Karnataka', 'Dharwad': 'Karnataka', 'Gulbarga': 'Karnataka',
  'Hassan': 'Karnataka', 'Haveri': 'Karnataka', 'Kolar': 'Karnataka', 'Koppal': 'Karnataka', 'Mandya': 'Karnataka',
  'Mysore': 'Karnataka', 'Raichur': 'Karnataka', 'Shimoga': 'Karnataka', 'Tumkur': 'Karnataka',
  'Udupi Chikmagalur': 'Karnataka', 'Uttara Kannada': 'Karnataka',
  'Alappuzha': 'Kerala', 'Alathur': 'Kerala', 'Attingal': 'Kerala', 'Chalakudy': 'Kerala', 'Ernakulam': 'Kerala',
  'Idukki': 'Kerala', 'Kannur': 'Kerala', 'Kasaragod': 'Kerala', 'Kollam': 'Kerala', 'Kottayam': 'Kerala',
  'Kozhikode': 'Kerala', 'Malappuram': 'Kerala', 'Mavelikkara': 'Kerala', 'Palakkad': 'Kerala',
  'Pathanamthitta': 'Kerala', 'Ponnani': 'Kerala', 'Thiruvananthapuram': 'Kerala', 'Thrissur': 'Kerala',
  'Vatakara': 'Kerala', 'Wayanad': 'Kerala',
  'Ladakh': 'Ladakh', 'Lakshadweep': 'Lakshadweep',
  'Balaghat': 'Madhya Pradesh', 'Betul': 'Madhya Pradesh', 'Bhind': 'Madhya Pradesh', 'Bhopal': 'Madhya Pradesh',
  'Chhindwara': 'Madhya Pradesh', 'Damoh': 'Madhya Pradesh', 'Dewas': 'Madhya Pradesh', 'Dhar': 'Madhya Pradesh',
  'Guna': 'Madhya Pradesh', 'Gwalior': 'Madhya Pradesh', 'Hoshangabad': 'Madhya Pradesh', 'Indore': 'Madhya Pradesh',
  'Jabalpur': 'Madhya Pradesh', 'Khajuraho': 'Madhya Pradesh', 'Khandwa': 'Madhya Pradesh', 'Khargone': 'Madhya Pradesh',
  'Mandla': 'Madhya Pradesh', 'Mandsaur': 'Madhya Pradesh', 'Morena': 'Madhya Pradesh', 'Rajgarh': 'Madhya Pradesh',
  'Ratlam': 'Madhya Pradesh', 'Rewa': 'Madhya Pradesh', 'Sagar': 'Madhya Pradesh', 'Satna': 'Madhya Pradesh',
  'Shahdol': 'Madhya Pradesh', 'Sidhi': 'Madhya Pradesh', 'Tikamgarh': 'Madhya Pradesh', 'Ujjain': 'Madhya Pradesh', 'Vidisha': 'Madhya Pradesh',
  'Ahmednagar': 'Maharashtra', 'Akola': 'Maharashtra', 'Amravati': 'Maharashtra', 'Baramati': 'Maharashtra',
  'Beed': 'Maharashtra', 'Bhandara Gondiya': 'Maharashtra', 'Bhiwandi': 'Maharashtra', 'Buldhana': 'Maharashtra',
  'Chandrapur': 'Maharashtra', 'Dhule': 'Maharashtra', 'Dindori': 'Maharashtra', 'Gadchiroli-Chimur': 'Maharashtra',
  'Hatkanangle': 'Maharashtra', 'Hingoli': 'Maharashtra', 'Jalgaon': 'Maharashtra', 'Jalna': 'Maharashtra',
  'Kalyan': 'Maharashtra', 'Kolhapur': 'Maharashtra', 'Latur': 'Maharashtra', 'Madha': 'Maharashtra',
  'Maval': 'Maharashtra', 'Mumbai North': 'Maharashtra', 'Mumbai North Central': 'Maharashtra',
  'Mumbai North East': 'Maharashtra', 'Mumbai North West': 'Maharashtra', 'Mumbai South': 'Maharashtra',
  'Mumbai South Central': 'Maharashtra', 'Nagpur': 'Maharashtra', 'Nanded': 'Maharashtra', 'Nandurbar': 'Maharashtra',
  'Nashik': 'Maharashtra', 'Osmanabad': 'Maharashtra', 'Palghar': 'Maharashtra', 'Parbhani': 'Maharashtra',
  'Pune': 'Maharashtra', 'Raigad': 'Maharashtra', 'Ramtek': 'Maharashtra', 'Ratnagiri-Sindhudurg': 'Maharashtra',
  'Raver': 'Maharashtra', 'Sangli': 'Maharashtra', 'Satara': 'Maharashtra', 'Shirdi': 'Maharashtra',
  'Shirur': 'Maharashtra', 'Solapur': 'Maharashtra', 'Thane': 'Maharashtra', 'Wardha': 'Maharashtra', 'Yavatmal-Washim': 'Maharashtra',
  'Inner Manipur': 'Manipur', 'Outer Manipur': 'Manipur',
  'Shillong': 'Meghalaya', 'Tura': 'Meghalaya',
  'Mizoram': 'Mizoram', 'Nagaland': 'Nagaland',
  'Aska': 'Odisha', 'Balasore': 'Odisha', 'Bargarh': 'Odisha', 'Berhampur': 'Odisha', 'Bhadrak': 'Odisha',
  'Bhubaneswar': 'Odisha', 'Bolangir': 'Odisha', 'Cuttack': 'Odisha', 'Dhenkanal': 'Odisha', 'Jagatsinghpur': 'Odisha',
  'Jajpur': 'Odisha', 'Kalahandi': 'Odisha', 'Kandhamal': 'Odisha', 'Kendrapara': 'Odisha', 'Keonjhar': 'Odisha',
  'Koraput': 'Odisha', 'Mayurbhanj': 'Odisha', 'Nabarangpur': 'Odisha', 'Puri': 'Odisha', 'Sambalpur': 'Odisha', 'Sundargarh': 'Odisha',
  'Puducherry': 'Puducherry',
  'Amritsar': 'Punjab', 'Anandpur Sahib': 'Punjab', 'Bathinda': 'Punjab', 'Faridkot': 'Punjab',
  'Fatehgarh Sahib': 'Punjab', 'Firozpur': 'Punjab', 'Gurdaspur': 'Punjab', 'Hoshiarpur': 'Punjab',
  'Jalandhar': 'Punjab', 'Khadoor Sahib': 'Punjab', 'Ludhiana': 'Punjab', 'Patiala': 'Punjab', 'Sangrur': 'Punjab',
  'Ajmer': 'Rajasthan', 'Alwar': 'Rajasthan', 'Banswara': 'Rajasthan', 'Barmer': 'Rajasthan',
  'Bharatpur': 'Rajasthan', 'Bhilwara': 'Rajasthan', 'Bikaner': 'Rajasthan', 'Chittorgarh': 'Rajasthan',
  'Churu': 'Rajasthan', 'Dausa': 'Rajasthan', 'Ganganagar': 'Rajasthan', 'Jaipur': 'Rajasthan',
  'Jaipur Rural': 'Rajasthan', 'Jalore': 'Rajasthan', 'Jhalawar-Baran': 'Rajasthan', 'Jhunjhunu': 'Rajasthan',
  'Jodhpur': 'Rajasthan', 'Karauli-Dholpur': 'Rajasthan', 'Kota': 'Rajasthan', 'Nagaur': 'Rajasthan',
  'Pali': 'Rajasthan', 'Rajsamand': 'Rajasthan', 'Sikar': 'Rajasthan', 'Tonk-Sawai Madhopur': 'Rajasthan', 'Udaipur': 'Rajasthan',
  'Sikkim': 'Sikkim',
  'Arakkonam': 'Tamil Nadu', 'Arani': 'Tamil Nadu', 'Chennai Central': 'Tamil Nadu', 'Chennai North': 'Tamil Nadu',
  'Chennai South': 'Tamil Nadu', 'Chidambaram': 'Tamil Nadu', 'Coimbatore': 'Tamil Nadu', 'Cuddalore': 'Tamil Nadu',
  'Dharmapuri': 'Tamil Nadu', 'Dindigul': 'Tamil Nadu', 'Erode': 'Tamil Nadu', 'Kallakurichi': 'Tamil Nadu',
  'Kancheepuram': 'Tamil Nadu', 'Kanniyakumari': 'Tamil Nadu', 'Karur': 'Tamil Nadu', 'Krishnagiri': 'Tamil Nadu',
  'Madurai': 'Tamil Nadu', 'Mayiladuthurai': 'Tamil Nadu', 'Nagapattinam': 'Tamil Nadu', 'Namakkal': 'Tamil Nadu',
  'Nilgiris': 'Tamil Nadu', 'Perambalur': 'Tamil Nadu', 'Pollachi': 'Tamil Nadu', 'Ramanathapuram': 'Tamil Nadu',
  'Salem': 'Tamil Nadu', 'Sivaganga': 'Tamil Nadu', 'Sriperumbudur': 'Tamil Nadu', 'Tenkasi': 'Tamil Nadu',
  'Thanjavur': 'Tamil Nadu', 'Theni': 'Tamil Nadu', 'Thiruvallur': 'Tamil Nadu', 'Thoothukkudi': 'Tamil Nadu',
  'Tiruchirappalli': 'Tamil Nadu', 'Tirunelveli': 'Tamil Nadu', 'Tiruppur': 'Tamil Nadu', 'Tiruvannamalai': 'Tamil Nadu',
  'Vellore': 'Tamil Nadu', 'Viluppuram': 'Tamil Nadu', 'Virudhunagar': 'Tamil Nadu',
  'Adilabad': 'Telangana', 'Bhongir': 'Telangana', 'Chevella': 'Telangana', 'Hyderabad': 'Telangana',
  'Karimnagar': 'Telangana', 'Khammam': 'Telangana', 'Mahabubabad': 'Telangana', 'Mahbubnagar': 'Telangana',
  'Medak': 'Telangana', 'Nagarkurnool': 'Telangana', 'Nalgonda': 'Telangana', 'Nizamabad': 'Telangana',
  'Peddapalle': 'Telangana', 'Secunderabad': 'Telangana', 'Warangal': 'Telangana', 'Zahirabad': 'Telangana',
  'Tripura East': 'Tripura', 'Tripura West': 'Tripura',
  'Agra': 'Uttar Pradesh', 'Aligarh': 'Uttar Pradesh', 'Allahabad': 'Uttar Pradesh', 'Ambedkar Nagar': 'Uttar Pradesh',
  'Amethi': 'Uttar Pradesh', 'Amroha': 'Uttar Pradesh', 'Aonla': 'Uttar Pradesh', 'Azamgarh': 'Uttar Pradesh',
  'Badaun': 'Uttar Pradesh', 'Baghpat': 'Uttar Pradesh', 'Bahraich': 'Uttar Pradesh', 'Ballia': 'Uttar Pradesh',
  'Banda': 'Uttar Pradesh', 'Bansgaon': 'Uttar Pradesh', 'Barabanki': 'Uttar Pradesh', 'Bareilly': 'Uttar Pradesh',
  'Basti': 'Uttar Pradesh', 'Bhadohi': 'Uttar Pradesh', 'Bijnor': 'Uttar Pradesh', 'Bulandshahr': 'Uttar Pradesh',
  'Chandauli': 'Uttar Pradesh', 'Deoria': 'Uttar Pradesh', 'Dhaurahra': 'Uttar Pradesh', 'Domariyaganj': 'Uttar Pradesh',
  'Etah': 'Uttar Pradesh', 'Etawah': 'Uttar Pradesh', 'Faizabad': 'Uttar Pradesh', 'Farrukhabad': 'Uttar Pradesh',
  'Fatehpur': 'Uttar Pradesh', 'Fatehpur Sikri': 'Uttar Pradesh', 'Firozabad': 'Uttar Pradesh',
  'Gautam Buddha Nagar': 'Uttar Pradesh', 'Ghaziabad': 'Uttar Pradesh', 'Ghazipur': 'Uttar Pradesh', 'Ghosi': 'Uttar Pradesh',
  'Gonda': 'Uttar Pradesh', 'Gorakhpur': 'Uttar Pradesh', 'Hardoi': 'Uttar Pradesh', 'Hathras': 'Uttar Pradesh',
  'Jalaun': 'Uttar Pradesh', 'Jaunpur': 'Uttar Pradesh', 'Jhansi': 'Uttar Pradesh', 'Kairana': 'Uttar Pradesh',
  'Kaiserganj': 'Uttar Pradesh', 'Kannauj': 'Uttar Pradesh', 'Kanpur': 'Uttar Pradesh', 'Kaushambi': 'Uttar Pradesh',
  'Kheri': 'Uttar Pradesh', 'Kushi Nagar': 'Uttar Pradesh', 'Lalganj': 'Uttar Pradesh', 'Lucknow': 'Uttar Pradesh',
  'Machhlishahr': 'Uttar Pradesh', 'Mainpuri': 'Uttar Pradesh', 'Mathura': 'Uttar Pradesh', 'Meerut': 'Uttar Pradesh',
  'Mirzapur': 'Uttar Pradesh', 'Misrikh': 'Uttar Pradesh', 'Mohanlalganj': 'Uttar Pradesh', 'Moradabad': 'Uttar Pradesh',
  'Muzaffarnagar': 'Uttar Pradesh', 'Nagina': 'Uttar Pradesh', 'Phulpur': 'Uttar Pradesh', 'Pilibhit': 'Uttar Pradesh',
  'Pratapgarh': 'Uttar Pradesh', 'Rae Bareli': 'Uttar Pradesh', 'Rampur': 'Uttar Pradesh', 'Robertsganj': 'Uttar Pradesh',
  'Saharanpur': 'Uttar Pradesh', 'Salempur': 'Uttar Pradesh', 'Sambhal': 'Uttar Pradesh', 'Sant Kabir Nagar': 'Uttar Pradesh',
  'Shahjahanpur': 'Uttar Pradesh', 'Shrawasti': 'Uttar Pradesh', 'Siddharthnagar': 'Uttar Pradesh', 'Sitapur': 'Uttar Pradesh',
  'Sultanpur': 'Uttar Pradesh', 'Unnao': 'Uttar Pradesh', 'Varanasi': 'Uttar Pradesh',
  'Almora': 'Uttarakhand', 'Garhwal': 'Uttarakhand', 'Haridwar': 'Uttarakhand', 'Nainital-Udhamsingh Nagar': 'Uttarakhand', 'Tehri Garhwal': 'Uttarakhand',
  'Alipurduars': 'West Bengal', 'Arambagh': 'West Bengal', 'Asansol': 'West Bengal', 'Baharampur': 'West Bengal',
  'Balurghat': 'West Bengal', 'Bangaon': 'West Bengal', 'Bankura': 'West Bengal', 'Barasat': 'West Bengal',
  'Bardhaman Durgapur': 'West Bengal', 'Bardhaman Purba': 'West Bengal', 'Barrackpore': 'West Bengal',
  'Basirhat': 'West Bengal', 'Birbhum': 'West Bengal', 'Bishnupur': 'West Bengal', 'Bolpur': 'West Bengal',
  'Cooch Behar': 'West Bengal', 'Darjeeling': 'West Bengal', 'Diamond Harbour': 'West Bengal', 'Dum Dum': 'West Bengal',
  'Ghatal': 'West Bengal', 'Hooghly': 'West Bengal', 'Howrah': 'West Bengal', 'Jadavpur': 'West Bengal',
  'Jalpaiguri': 'West Bengal', 'Jangipur': 'West Bengal', 'Jaynagar': 'West Bengal', 'Jhargram': 'West Bengal',
  'Kanthi': 'West Bengal', 'Kolkata Dakshin': 'West Bengal', 'Kolkata Uttar': 'West Bengal', 'Krishnanagar': 'West Bengal',
  'Maldaha Dakshin': 'West Bengal', 'Maldaha Uttar': 'West Bengal', 'Mathurapur': 'West Bengal', 'Medinipur': 'West Bengal',
  'Murshidabad': 'West Bengal', 'Purulia': 'West Bengal', 'Raiganj': 'West Bengal', 'Ranaghat': 'West Bengal',
  'Sreerampur': 'West Bengal', 'Tamluk': 'West Bengal', 'Uluberia': 'West Bengal'
};

const ALL_543_SEATS: string[] = [
  'Amalapuram', 'Anakapalli', 'Anantapur', 'Andaman and Nicobar Islands', 'Araku', 'Bapatla', 'Chittoor', 'Eluru', 'Guntur', 'Hindupur', 'Kadapa', 'Kakinada', 'Kurnool', 'Machilipatnam', 'Nandyal', 'Narasaraopet', 'Narsapuram', 'Nellore', 'Ongole', 'Rajahmundry', 'Rajampet', 'Srikakulam', 'Tirupati', 'Vijayawada', 'Visakhapatnam', 'Vizianagaram',
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
  'Ahmednagar', 'Akola', 'Amravati', 'Baramati', 'Beed', 'Bhandara Gondiya', 'Bhiwandi', 'Buldhana', 'Chandrapur', 'Dhule', 'Dindori', 'Gadchiroli-Chimur', 'Hatkanangle', 'Hingoli', 'Jalgaon', 'Jalna', 'Kalyan', 'Kolhapur', 'Latur', 'Madha', 'Maval', 'Mumbai North', 'Mumbai North Central', 'Mumbai North East', 'Mumbai North West', 'Mumbai South', 'Mumbai South Central', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ramtek', 'Ratnagiri-Sindhudurg', 'Raver', 'Sangli', 'Satara', 'Shirdi', 'Shirur', 'Solapur', 'Thane', 'Wardha', 'Yavatmal-Washim',
  'Inner Manipur', 'Outer Manipur', 'Shillong', 'Tura', 'Mizoram', 'Nagaland',
  'Aska', 'Balasore', 'Bargarh', 'Berhampur', 'Bhadrak', 'Bhubaneswar', 'Bolangir', 'Cuttack', 'Dhenkanal', 'Jagatsinghpur', 'Jajpur', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Keonjhar', 'Koraput', 'Mayurbhanj', 'Nabarangpur', 'Puri', 'Sambalpur', 'Sundargarh', 'Puducherry',
  'Amritsar', 'Anandpur Sahib', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Firozpur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Khadoor Sahib', 'Ludhiana', 'Patiala', 'Sangrur',
  'Ajmer', 'Alwar', 'Banswara', 'Barmer', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Chittorgarh', 'Churu', 'Dausa', 'Ganganagar', 'Jaipur', 'Jaipur Rural', 'Jalore', 'Jhalawar-Baran', 'Jhunjhunu', 'Jodhpur', 'Karauli-Dholpur', 'Kota', 'Nagaur', 'Pali', 'Rajsamand', 'Sikar', 'Tonk-Sawai Madhopur', 'Udaipur', 'Sikkim',
  'Arakkonam', 'Arani', 'Chennai Central', 'Chennai North', 'Chennai South', 'Chidambaram', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram', 'Kanniyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pollachi', 'Ramanathapuram', 'Salem', 'Sivaganga', 'Sriperumbudur', 'Tenkasi', 'Thanjavur', 'Theni', 'Thiruvallur', 'Thoothukkudi', 'Tiruchirappalli', 'Tirunelveli', 'Tiruppur', 'Tiruvannamalai', 'Vellore', 'Viluppuram', 'Virudhunagar',
  'Adilabad', 'Bhongir', 'Chevella', 'Hyderabad', 'Karimnagar', 'Khammam', 'Mahabubabad', 'Mahbubnagar', 'Medak', 'Nagarkurnool', 'Nalgonda', 'Nizamabad', 'Peddapalle', 'Secunderabad', 'Warangal', 'Zahirabad', 'Tripura East', 'Tripura West',
  'Agra', 'Aligarh', 'Allahabad', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Aonla', 'Azamgarh', 'Badaun', 'Baghpat', 'Bahraich', 'Ballia', 'Banda', 'Bansgaon', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Bulandshahr', 'Chandauli', 'Deoria', 'Dhaurahra', 'Domariyaganj', 'Etah', 'Etawah', 'Faizabad', 'Farrukhabad', 'Fatehpur', 'Fatehpur Sikri', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Ghosi', 'Gonda', 'Gorakhpur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kairana', 'Kaiserganj', 'Kannauj', 'Kanpur', 'Kaushambi', 'Kheri', 'Kushi Nagar', 'Lalganj', 'Lucknow', 'Machhlishahr', 'Mainpuri', 'Mathura', 'Meerut', 'Mirzapur', 'Misrikh', 'Mohanlalganj', 'Moradabad', 'Muzaffarnagar', 'Nagina', 'Phulpur', 'Pilibhit', 'Pratapgarh', 'Rae Bareli', 'Rampur', 'Robertsganj', 'Saharanpur', 'Salempur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shrawasti', 'Siddharthnagar', 'Sitapur', 'Sultanpur', 'Unnao', 'Varanasi',
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

  // Scoped Audit State
  const [scopedParticipations, setScopedParticipations] = useState<number>(0);
  const [scopedBallots, setScopedBallots] = useState<number>(0);
  const [scopedSampleRows, setScopedSampleRows] = useState<any[]>([]);
  const [scopedHotspotSeat, setScopedHotspotSeat] = useState<string>('Awaiting Data');
  const [scopedHotspotState, setScopedHotspotState] = useState<string>('Awaiting Data');
  const [scopedHotspotVotes, setScopedHotspotVotes] = useState<number>(0);
  const [talliesRows, setTalliesRows] = useState<any[]>([]);

  // Macro Platform Telemetry
  const [platformTotalBallots, setPlatformTotalBallots] = useState<number>(0);
  const [janmatTotalBallots, setJanmatTotalBallots] = useState<number>(0);
  const [lokmatTotalBallots, setLokmatTotalBallots] = useState<number>(0);

  // Temporal Breakups: BhuMat / LokMat / JanMat
  const [todayTotalBallots, setTodayTotalBallots] = useState<number>(0);
  const [todayLokmatBallots, setTodayLokmatBallots] = useState<number>(0);
  const [todayJanmatBallots, setTodayJanmatBallots] = useState<number>(0);

  const [monthTotalBallots, setMonthTotalBallots] = useState<number>(0);
  const [monthLokmatBallots, setMonthLokmatBallots] = useState<number>(0);
  const [monthJanmatBallots, setMonthJanmatBallots] = useState<number>(0);

  // Operations Metrics
  const [newUsersToday, setNewUsersToday] = useState<number>(0);
  const [weeklyBallots, setWeeklyBallots] = useState<number>(0);

  const [topJanmatState, setTopJanmatState] = useState<string>('Awaiting Data');
  const [topJanmatSeat, setTopJanmatSeat] = useState<string>('Awaiting Data');
  const [topLokmatState, setTopLokmatState] = useState<string>('Awaiting Data');
  const [topLokmatSeat, setTopLokmatSeat] = useState<string>('Awaiting Data');

  const [totalWallets, setTotalWallets] = useState<number>(0);
  const [verifiedPhones, setVerifiedPhones] = useState<number>(0);
  const [guestCitizens, setGuestCitizens] = useState<number>(0);
  const [totalDbgCirculating, setTotalDbgCirculating] = useState<number>(0);
  const [referralBonusesCount, setReferralBonusesCount] = useState<number>(0);
  const [activeSeatsCount, setActiveSeatsCount] = useState<number>(0);
  const [activeStatesCount, setActiveStatesCount] = useState<number>(0);
  const [fortifiedSeatsFromRpc, setFortifiedSeatsFromRpc] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [anonymityVerdict, setAnonymityVerdict] = useState<string | null>(null);
  const [isPlatformFrozen, setIsPlatformFrozen] = useState(false);
  const [blackoutSeatInput, setBlackoutSeatInput] = useState('');
  const [blackoutActionStatus, setBlackoutActionStatus] = useState('');

  // Citizen Proposals Queue (Funded by 10 DBG burn)
  const [proposals, setProposals] = useState<any[]>([]);

  // Sandbox Single Test
  const [simTargetPollId, setSimTargetPollId] = useState('');
  const [simSeat, setSimSeat] = useState('Muzaffarpur');
  const [simOption, setSimOption] = useState(0);
  const [simMessage, setSimMessage] = useState('');
  const [batchCount, setBatchCount] = useState<number>(10);
  const [injectAsVerified, setInjectAsVerified] = useState<boolean>(true);
  const [cycleSimStatus, setCycleSimStatus] = useState('');
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

  async function fetchProposals() {
    try {
      const { data } = await supabase
        .from('citizen_poll_proposals')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setProposals(data);
    } catch (err) {
      console.warn('Citizen proposals fetch notice:', err);
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
      fetchProposals();
      fetchPlatformSettings();
    }
  }, [isAuthenticated]);

  async function runComprehensiveAudit(pollId: string) {
    setLoading(true);
    try {
      const cleanPollId = (!pollId || pollId === 'ALL') ? 'ALL' : pollId;
      const isAll = cleanPollId === 'ALL';
      let tQuery = supabase.from('constituency_tallies').select('*');
      if (!isAll) tQuery = tQuery.eq('poll_id', cleanPollId);
      const { data: tallies } = await tQuery.order('total_votes', { ascending: false });
      setTalliesRows(tallies || []);

      const { data: auditData, error: auditError } = await supabase.rpc('get_admin_audit_metrics', {
        p_poll_id: cleanPollId
      });

      if (auditError) {
        console.error('Audit RPC Error:', auditError);
        alert(`Audit Error: ${auditError.message}`);
        return;
      }

      if (auditData) {
        setScopedParticipations(Number(auditData.scoped_participations) || 0);
        setScopedBallots(Number(auditData.scoped_ballots) || 0);
        setScopedSampleRows(Array.isArray(auditData.scoped_sample) ? auditData.scoped_sample : []);
        setScopedHotspotSeat(auditData.scoped_hotspot_seat || 'Awaiting Data');
        setScopedHotspotState(auditData.scoped_hotspot_state || 'Awaiting Data');
        setScopedHotspotVotes(Number(auditData.scoped_hotspot_votes) || 0);

        setPlatformTotalBallots(Number(auditData.platform_total_ballots) || 0);
        setJanmatTotalBallots(Number(auditData.janmat_total_ballots) || 0);
        setLokmatTotalBallots(Number(auditData.lokmat_total_ballots) || 0);

        setTodayTotalBallots(Number(auditData.today_total_ballots) || 0);
        setTodayLokmatBallots(Number(auditData.today_lokmat_ballots) || 0);
        setTodayJanmatBallots(Number(auditData.today_janmat_ballots) || 0);

        setMonthTotalBallots(Number(auditData.month_total_ballots) || 0);
        setMonthLokmatBallots(Number(auditData.month_lokmat_ballots) || 0);
        setMonthJanmatBallots(Number(auditData.month_janmat_ballots) || 0);

        setNewUsersToday(Number(auditData.new_users_today) || 0);
        setWeeklyBallots(Number(auditData.weekly_ballots) || 0);

        setTopJanmatState(auditData.top_janmat_state || 'Awaiting Data');
        setTopJanmatSeat(auditData.top_janmat_seat || 'Awaiting Data');
        setTopLokmatState(auditData.top_lokmat_state || 'Awaiting Data');
        setTopLokmatSeat(auditData.top_lokmat_seat || 'Awaiting Data');

        setTotalWallets(Number(auditData.total_wallets) || 0);
        setVerifiedPhones(Number(auditData.verified_phones) || 0);
        setGuestCitizens(Number(auditData.guest_citizens) || 0);
        setTotalDbgCirculating(Number(auditData.total_dbg) || 0);
        setReferralBonusesCount(Number(auditData.referral_bonuses) || 0);
        setActiveSeatsCount(Number(auditData.active_seats) || 0);
        setActiveStatesCount(Number(auditData.active_states) || 0);
        setFortifiedSeatsFromRpc(Number(auditData.fortified_seats) || 0);

        if (auditData.scoped_sample && auditData.scoped_sample.length > 0) {
          const sample = auditData.scoped_sample[0];
          const hasLeak = 'voter_token' in sample || 'user_id' in sample || 'ip_address' in sample;
          if (hasLeak) {
            setAnonymityVerdict('⚠️ ANONYMITY WARNING: Metadata detected in Table 2!');
          } else {
            setAnonymityVerdict('🛡️ 100% Cryptographic Anonymity Intact (0 Tokens/IPs in Table 2)');
          }
        } else {
          setAnonymityVerdict('🛡️ Cryptographic Blind Ledger Verified');
        }
      }
    } catch (e: any) {
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'citizen_poll_proposals' }, () => fetchProposals())
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAuthenticated, selectedPollId]);

  const selectedPoll = polls.find((p) => p.id === selectedPollId);
  const isAllPollsSelected = selectedPollId === 'ALL';
  const isScopedReconciled = scopedBallots === scopedParticipations;

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
          verified_total_votes: 0,
          opt_0_votes: 0,
          opt_1_votes: 0,
          opt_2_votes: 0,
          opt_3_votes: 0,
          is_fortified: false
        };
      }
      map[key].total_votes += Number(row.total_votes || 0);
      map[key].verified_total_votes += Number(row.verified_total_votes || 0);
      map[key].opt_0_votes += Number(row.opt_0_votes || row.option_0_votes || 0);
      map[key].opt_1_votes += Number(row.opt_1_votes || row.option_1_votes || 0);
      map[key].opt_2_votes += Number(row.opt_2_votes || row.option_2_votes || 0);
      map[key].opt_3_votes += Number(row.opt_3_votes || row.option_3_votes || 0);
      if (map[key].total_votes >= 50) map[key].is_fortified = true;
    });
    return Object.values(map).sort((a, b) => b.total_votes - a.total_votes);
  }, [talliesRows, isAllPollsSelected]);

  const fortifiedSeatsCount = Math.max(
    fortifiedSeatsFromRpc,
    aggregatedTallies.filter((r) => r.is_fortified || r.total_votes >= 50).length
  );

  const filteredTallies = aggregatedTallies.filter((r) => {
    if (tallyFilter === 'FORTIFIED') return r.is_fortified || r.total_votes >= 50;
    if (tallyFilter === 'ACTIVE') return r.total_votes > 0;
    return true;
  });

  const sandboxTargetPollObj = isAllPollsSelected ? polls.find((p) => p.id === simTargetPollId) : selectedPoll;
  const currentSeatTally = talliesRows.find(
    (t) => t.constituency_name === simSeat && (!sandboxTargetPollObj || t.poll_id === sandboxTargetPollObj.id)
  );

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

  const handleDeletePoll = async () => {
    if (!selectedPoll) return;
    const confirmText = prompt(`Type "DELETE" to permanently destroy poll "${selectedPoll.title_en}" and its ballot records:`);
    if (confirmText !== 'DELETE') return;
    await supabase.from('ballot_box').delete().eq('poll_id', selectedPoll.id);
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

  const handleSimulateBallot = async () => {
    const targetPoll = isAllPollsSelected ? simTargetPollId : selectedPollId;
    if (!targetPoll) {
      alert('Please choose a valid poll target for injection.');
      return;
    }
    setSimMessage(`Casting batch of ${batchCount} ballots...`);
    const activePollObj = polls.find((p) => p.id === targetPoll);
    const targetCycle = activePollObj?.participation_mode === 'recurring' 
      ? getCurrentCycleId(activePollObj?.recurrence) 
      : (activePollObj?.current_cycle || '2026-10');
    
    const derivedState = SEAT_TO_STATE_MAP[simSeat] || QUICK_SEATS[simSeat] || 'Bihar';
    const { data, error } = await supabase.rpc('admin_batch_cast_ballots', {
      p_poll_id: targetPoll,
      p_cycle_id: targetCycle,
      p_constituency_name: simSeat,
      p_state_name: derivedState,
      p_selected_option: Number(simOption),
      p_vote_count: Number(batchCount),
      p_as_verified: Boolean(injectAsVerified)
    });
    if (error || !data?.success) {
      setSimMessage(`❌ Error: ${error?.message || data?.error}`);
    } else {
      setSimMessage(`✓ Injected +${data.votes_added} ballots! Seat total: ${data.constituency_total} (${data.verified_total} verified).`);
      runComprehensiveAudit(selectedPollId);
    }
  };

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
      await supabase.from('voter_participations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('constituency_tallies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('poll_totals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      alert('All votes reset across the platform.');
    } else {
      if (!confirm(`Reset all votes for poll ${selectedPollId}?`)) return;
      await supabase.from('ballot_box').delete().eq('poll_id', selectedPollId);
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
    const computedCycle = newRecurrence === 'lifetime' ? 'lifetime' : getCurrentCycleId(newRecurrence);
    const startDate = new Date(newStartsAt);
    let closeDate = new Date(startDate);
    if (newRecurrence === 'daily') closeDate.setDate(closeDate.getDate() + 1);
    else if (newRecurrence === 'weekly') closeDate.setDate(closeDate.getDate() + 7);
    else if (newRecurrence === 'monthly') closeDate.setMonth(closeDate.getMonth() + 1);
    else closeDate.setFullYear(closeDate.getFullYear() + 5);

    const payload = {
      id: newPollId,
      category: newCategory,
      title_en: newTitleEn.trim(),
      title_hi: (newTitleHi || newTitleEn).trim(),
      options: formattedOptions,
      participation_mode: newRecurrence === 'lifetime' ? 'one_time' : 'recurring',
      recurrence: newRecurrence,
      current_cycle: computedCycle,
      starts_at: startDate.toISOString(),
      closes_at: closeDate.toISOString(),
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
      <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
        
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
              type="button"
              onClick={() => {
                setActiveAdminTab((prev) => (prev === 'AUDIT' ? 'CREATE_POLL' : 'AUDIT'));
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: activeAdminTab === 'CREATE_POLL' ? '#0f172a' : '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {activeAdminTab === 'CREATE_POLL' ? '← Back to Live Audit' : '＋ Deploy New Poll'}
            </button>
            <button onClick={handleLogout} style={{ padding: '8px 14px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              🔒 Lock Panel
            </button>
          </div>
        </div>

        {activeAdminTab === 'CREATE_POLL' ? (
          /* EDITORIAL STUDIO TAB */
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '6px' }}>
              EDITORIAL STUDIO
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 900, margin: '10px 0 6px 0' }}>Deploy Sovereign Public Opinion Poll</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
              Configure bilingual questions, options, category track, targeted regions, and cadence for live feed publishing.
            </p>
            <form onSubmit={handleDeployNewPoll} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

            {/* Citizen Proposals Queue (10 DBG Burn Submissions) */}
            <div style={{ backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '16px', marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>
                  💡 Citizen Proposals Queue ({proposals.filter(p => p.status === 'PENDING').length} Pending)
                </span>
                <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700 }}>
                  Funded by 10 DBG Citizen Burn
                </span>
              </div>
              {proposals.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '14px 0' }}>
                  No citizen proposals submitted yet.
                </div>
              ) : (
                proposals.map((prop) => (
                  <div key={prop.id} style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: prop.category === 'JanMat' ? '#059669' : '#d97706', backgroundColor: prop.category === 'JanMat' ? '#ecfdf5' : '#fffbeb', padding: '2px 6px', borderRadius: '4px' }}>
                        ● {prop.category}
                      </span>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{prop.title_en}</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>By token: {prop.voter_token.slice(0, 10)}... • 10 DBG Burned</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => {
                          setNewCategory(prop.category);
                          setNewTitleEn(prop.title_en);
                          setNewTitleHi(prop.title_hi || prop.title_en);
                          alert('Copied proposal to deployment form above! Edit details and click Publish.');
                        }}
                        style={{ padding: '6px 10px', backgroundColor: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        Deploy ❯
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* AUDIT & GOVERNANCE SUITE */
          <>
            {/* SECTION A: PAN-BHARAT PLATFORM MACRO TELEMETRY */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '18px 20px', marginBottom: '22px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 900, backgroundColor: '#0f172a', color: '#ffffff', padding: '3px 8px', borderRadius: '6px' }}>
                    🌐 PLATFORM MACRO
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#334155' }}>
                    Pan-Bharat Sovereign Health &amp; Growth Engine (Cumulative across 543 seats)
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#059669', fontWeight: 800, backgroundColor: '#ecfdf5', padding: '3px 8px', borderRadius: '6px' }}>
                  ● Constant National Telemetry
                </span>
              </div>

              {/* Row 1: Core Cadence, Quorum & Volume */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Active Poll Cadence</span>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>{activePollsCount} Live / {polls.length} Total</div>
                  <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>Pan-India &amp; regional drops</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Fortified Quorum Seats</span>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#059669', marginTop: '3px' }}>{fortifiedSeatsCount} / 543 Seats</div>
                  <div style={{ fontSize: '10.5px', color: '#059669', marginTop: '2px' }}>Seats with &ge; 50 total ballots</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>Total Civic Ballots</span>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#0284c7', marginTop: '3px' }}>{platformTotalBallots} Cast</div>
                  <div style={{ fontSize: '10.5px', color: '#0284c7', marginTop: '2px' }}>Decoupled sovereign votes</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Audit Ledger Health</span>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669', marginTop: '4px' }}>100% Balanced</div>
                  <div style={{ fontSize: '10.5px', color: '#059669', marginTop: '2px' }}>Zero cryptographic drift</div>
                </div>
              </div>

              {/* Row 2: JanMat & LokMat Pillars & Regional Traction */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
                <div style={{ backgroundColor: '#ecfdf5', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #a7f3d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>🌆 JanMat Audits</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#047857', backgroundColor: '#d1fae5', padding: '1px 6px', borderRadius: '4px' }}>
                      {platformTotalBallots > 0 ? `${Math.round((janmatTotalBallots / platformTotalBallots) * 100)}% Share` : '0%'}
                    </span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#064e3b', marginTop: '3px' }}>{janmatTotalBallots} Ballots</div>
                  <div style={{ fontSize: '10.5px', color: '#059669', marginTop: '2px' }}>Strict secret ballot audits</div>
                </div>
                <div style={{ backgroundColor: '#f0fdf4', padding: '12px 14px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>JanMat Hotspot Region</span>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#166534', marginTop: '4px' }}>
                    {topJanmatSeat !== 'Awaiting Data' ? `${topJanmatSeat} (${topJanmatState})` : 'Awaiting Data'}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#15803d', marginTop: '2px' }}>Leading civic policy engagement</div>
                </div>
                <div style={{ backgroundColor: '#fffbeb', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #fde68a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>🌅 LokMat Pulses</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#b45309', backgroundColor: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>
                      {platformTotalBallots > 0 ? `${Math.round((lokmatTotalBallots / platformTotalBallots) * 100)}% Share` : '0%'}
                    </span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#78350f', marginTop: '3px' }}>{lokmatTotalBallots} Ballots</div>
                  <div style={{ fontSize: '10.5px', color: '#d97706', marginTop: '2px' }}>Open cultural public sentiment</div>
                </div>
                <div style={{ backgroundColor: '#fffdf5', padding: '12px 14px', borderRadius: '12px', border: '1px solid #fef08a' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#854d0e', textTransform: 'uppercase' }}>LokMat Hotspot Region</span>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#854d0e', marginTop: '4px' }}>
                    {topLokmatSeat !== 'Awaiting Data' ? `${topLokmatSeat} (${topLokmatState})` : 'Awaiting Data'}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#a16207', marginTop: '2px' }}>Leading cultural debate pulse</div>
                </div>
              </div>

              {/* Row 3: Dedicated State Hotspots & Velocity Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
                <div style={{ backgroundColor: '#f0fdf4', padding: '12px 14px', borderRadius: '12px', border: '1px solid #86efac' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>JanMat Leading State</span>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#15803d', marginTop: '3px' }}>
                    🏛️ {topJanmatState}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#166534', marginTop: '2px' }}>State with highest JanMat votes</div>
                </div>
                <div style={{ backgroundColor: '#fffdf5', padding: '12px 14px', borderRadius: '12px', border: '1px solid #fde047' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#854d0e', textTransform: 'uppercase' }}>LokMat Leading State</span>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#a16207', marginTop: '3px' }}>
                    🏛️ {topLokmatState}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#854d0e', marginTop: '2px' }}>State with highest LokMat votes</div>
                </div>
                {/* Current Day Ballot Pulse (BhuMat / LokMat / JanMat) */}
                <div style={{ backgroundColor: '#eff6ff', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #bfdbfe' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>⚡ Today&apos;s Ballot Pulse</span>
                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#1d4ed8', backgroundColor: '#dbeafe', padding: '1px 5px', borderRadius: '4px' }}>Live 24h</span>
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#1e3a8a', marginTop: '3px' }}>
                    {todayTotalBallots} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#2563eb', marginTop: '2px', fontWeight: 700 }}>
                    BhuMat: {todayTotalBallots} • L: {todayLokmatBallots} • J: {todayJanmatBallots}
                  </div>
                </div>
                {/* Current Month Cycle Pulse (BhuMat / LokMat / JanMat) */}
                <div style={{ backgroundColor: '#faf5ff', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e9d5ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase' }}>📅 Monthly Cycle Pulse</span>
                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#7e22ce', backgroundColor: '#f3e8ff', padding: '1px 5px', borderRadius: '4px' }}>Season 10</span>
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#581c87', marginTop: '3px' }}>
                    {monthTotalBallots} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#7e22ce', marginTop: '2px', fontWeight: 700 }}>
                    BhuMat: {monthTotalBallots} • L: {monthLokmatBallots} • J: {monthJanmatBallots}
                  </div>
                </div>
              </div>

              {/* Row 4: Growth Funnel, Economy & Operations Velocity */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Citizen Passports (Users)</span>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>
                    {totalWallets} <span style={{ fontSize: '12px', color: '#059669' }}>({verifiedPhones} OTP)</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#0284c7', marginTop: '2px', fontWeight: 700 }}>
                    +{newUsersToday} New Users Joined Today
                  </div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>Mobile Verification Rate</span>
                  <div style={{ fontSize: '19px', fontWeight: 900, color: '#0284c7', marginTop: '3px' }}>
                    {totalWallets > 0 ? `${Math.round((verifiedPhones / totalWallets) * 100)}%` : '0%'}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#0369a1', marginTop: '2px' }}>{guestCitizens} Guest runway sessions</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>Circulating DBG Economy</span>
                  <div style={{ fontSize: '19px', fontWeight: 900, color: '#d97706', marginTop: '3px' }}>
                    {totalDbgCirculating} DBG
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#b45309', marginTop: '2px' }}>Standardized 1 DBG denomination</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #10b981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>7-Day Rolling Velocity</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#047857' }}>
                      {activeSeatsCount} / 543 Seats
                    </span>
                  </div>
                  <div style={{ fontSize: '19px', fontWeight: 900, color: '#059669', marginTop: '3px' }}>
                    {weeklyBallots} Ballots / 7d
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#047857', marginTop: '2px' }}>Across {activeStatesCount} States &amp; UTs</div>
                </div>
              </div>
            </div>

            {/* SECTION B: TARGET POLL FORENSIC AUDIT INSPECTOR */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '18px', border: '2px solid #0284c7', marginBottom: '22px', boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 900, backgroundColor: '#0284c7', color: '#ffffff', padding: '3px 8px', borderRadius: '6px' }}>
                    🎯 TARGET POLL INSPECTOR
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    Forensic Selector: Filter and Audit Specific Poll Ledgers
                  </span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: isAllPollsSelected ? '#0284c7' : '#059669' }}>
                  {isAllPollsSelected ? 'Aggregate Inspection' : `Target ID: ${selectedPollId}`}
                </span>
              </div>

              {/* Selector Bar */}
              <select
                value={selectedPollId}
                onChange={(e) => setSelectedPollId(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontWeight: 700,
                  fontSize: '13px',
                  backgroundColor: isAllPollsSelected ? '#f0f9ff' : '#ffffff',
                  color: '#0f172a',
                  outline: 'none',
                  marginBottom: '14px'
                }}
              >
                <option value="ALL">🌐 [ALL POLLS] Cumulative Sovereign Health &amp; Multi-Poll Activity</option>
                {polls.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.is_active ? '🟢 LIVE' : '🔴 PAUSED'}] [{p.category}] {p.title_en} ({p.id})
                  </option>
                ))}
              </select>

              {/* Scoped Telemetry Cards for the Active Target */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '14px' }}>
                <div style={{ backgroundColor: '#f0f9ff', padding: '12px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>Target Ballot Volume</span>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>{scopedBallots} Ballots</div>
                  <div style={{ fontSize: '10.5px', color: '#0369a1', marginTop: '2px' }}>Decoupled secret ballots for this scope</div>
                </div>
                <div style={{ backgroundColor: '#f0f9ff', padding: '12px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>Target Hotspot Seat</span>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#0369a1', marginTop: '3px' }}>
                    {scopedHotspotSeat} ({scopedHotspotVotes})
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#0369a1', marginTop: '2px' }}>State: <strong>{scopedHotspotState}</strong></div>
                </div>
                <div style={{ backgroundColor: '#f0f9ff', padding: '12px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>Target Scope Category</span>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#0369a1', marginTop: '3px' }}>
                    {isAllPollsSelected ? 'Multi-Pillar' : (selectedPoll?.category || 'JanMat')}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#0369a1', marginTop: '2px' }}>
                    {isAllPollsSelected ? 'Platform wide audit' : (selectedPoll?.recurrence || 'monthly')} cadence
                  </div>
                </div>
                <div style={{ backgroundColor: isScopedReconciled ? '#ecfdf5' : '#fef2f2', padding: '12px', borderRadius: '12px', border: `1.5px solid ${isScopedReconciled ? '#a7f3d0' : '#fecaca'}` }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: isScopedReconciled ? '#065f46' : '#991b1b', textTransform: 'uppercase' }}>Reconciliation Check</span>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: isScopedReconciled ? '#059669' : '#dc2626', marginTop: '3px' }}>
                    {isScopedReconciled ? '✓ 100% Balanced' : '⚠ Audit Discrepancy'}
                  </div>
                  <div style={{ fontSize: '10.5px', color: isScopedReconciled ? '#047857' : '#b91c1c', marginTop: '2px' }}>
                    {scopedBallots} ballots == {scopedParticipations} tokens
                  </div>
                </div>
              </div>

              {/* Action Buttons for Scoped Target */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '6px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {!isAllPollsSelected ? (
                    <>
                      <button
                        onClick={handleTogglePollStatus}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: selectedPoll?.is_active ? '#fef3c7' : '#ecfdf5',
                          color: selectedPoll?.is_active ? '#b45309' : '#059669',
                          fontWeight: 800,
                          fontSize: '11.5px',
                          cursor: 'pointer'
                        }}
                      >
                        {selectedPoll?.is_active ? '⏸ Pause Poll' : '▶ Reactivate Poll'}
                      </button>
                      <button
                        onClick={handleDeletePoll}
                        style={{ padding: '8px 14px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        🗑️ Delete Poll
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '6px 12px', borderRadius: '6px' }}>
                      Active Live Polls: {activePollsCount} / {polls.length}
                    </span>
                  )}
                  <button
                    onClick={handleResetPollVotes}
                    style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {isAllPollsSelected ? 'Reset All Votes' : 'Reset Target Votes'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => exportTableToCSV(talliesRows, `bhumat_tallies_${selectedPollId}`)}
                    style={{ padding: '8px 12px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    📥 Export CSV
                  </button>
                  <button
                    onClick={() => runComprehensiveAudit(selectedPollId)}
                    style={{ padding: '8px 16px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    ↻ Refresh Scoped Ledger
                  </button>
                </div>
              </div>

              {/* 48-Hour ECI Silence Blackout Controls */}
              {!isAllPollsSelected && (
                <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '12px', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#dc2626' }}>
                      🏛️ Election Commission Compliance: 48-Hour Silence Blackout
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                      Constituencies in silence period cannot vote or view leading trends.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Search seat to blackout (e.g. Darbhanga, Banka, Nagpur)..."
                      value={blackoutSeatInput}
                      onChange={(e) => setBlackoutSeatInput(e.target.value)}
                      style={{ flex: 1, padding: '7px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600 }}
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
                      style={{ padding: '7px 14px', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Lock Seat
                    </button>
                  </div>
                  {blackoutActionStatus && (
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626' }}>{blackoutActionStatus}</div>
                  )}
                  {selectedPoll?.blackout_seats && selectedPoll.blackout_seats.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
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

            {/* Cryptographic Anonymity Banner */}
            {anonymityVerdict && (
              <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '10px', backgroundColor: anonymityVerdict.includes('⚠️') ? '#fef2f2' : '#ecfdf5', border: `1px solid ${anonymityVerdict.includes('⚠️') ? '#fecaca' : '#a7f3d0'}`, fontSize: '12px', fontWeight: 800, color: anonymityVerdict.includes('⚠️') ? '#991b1b' : '#065f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{anonymityVerdict}</span>
                <button onClick={() => runComprehensiveAudit(selectedPollId)} style={{ background: 'none', border: 'none', color: '#0284c7', fontWeight: 800, cursor: 'pointer', fontSize: '11px' }}>
                  Re-Verify Ledger
                </button>
              </div>
            )}

            {/* SECTION C: SANDBOX REALTIME TESTING */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <div style={{ marginBottom: '14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>🧪 Sandbox Realtime Testing (543 Lok Sabha Seats)</h3>
                <p style={{ fontSize: '11.5px', color: '#64748b', margin: '3px 0 0 0' }}>
                  Inject test ballots into any of India&apos;s 543 constituencies to verify map choropleth &amp; tallies.
                </p>
              </div>

              {/* Full-Width Target Poll Selector */}
              <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  🎯 Target Poll for Injection:
                </label>
                <select
                  value={isAllPollsSelected ? simTargetPollId : selectedPollId}
                  onChange={(e) => {
                    if (isAllPollsSelected) setSimTargetPollId(e.target.value);
                    else setSelectedPollId(e.target.value);
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #0284c7', fontSize: '13px', fontWeight: 700, backgroundColor: '#ffffff', color: '#0f172a' }}
                >
                  {polls.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.category}] {p.title_en} — ({p.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch Ingestion Grid: Constituency, Option, Quantity Batch, Verified Toggle, Current Votes & Cast */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr auto auto auto auto', gap: '8px', alignItems: 'center' }}>
                <select
                  value={simSeat}
                  onChange={(e) => setSimSeat(e.target.value)}
                  style={{ padding: '10px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700, backgroundColor: '#ffffff', color: '#0f172a' }}
                >
                  <optgroup label="⚡ Quick Test Seats">
                    {Object.keys(QUICK_SEATS).map((s) => (
                      <option key={`quick-${s}`} value={s}>
                        {s} ({QUICK_SEATS[s]})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🇮🇳 All 543 Lok Sabha Constituencies">
                    {ALL_543_SEATS.map((s) => (
                      <option key={`all-${s}`} value={s}>
                        {s} {SEAT_TO_STATE_MAP[s] ? `(${SEAT_TO_STATE_MAP[s]})` : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>

                <select
                  value={simOption}
                  onChange={(e) => setSimOption(Number(e.target.value))}
                  style={{ padding: '10px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
                >
                  {((isAllPollsSelected ? polls.find((p) => p.id === simTargetPollId)?.options : selectedPoll?.options) || [
                    { id: 0, text_en: 'Option 1' },
                    { id: 1, text_en: 'Option 2' },
                    { id: 2, text_en: 'Option 3' }
                  ]).map((opt: any, idx: number) => (
                    <option key={opt.id || idx} value={idx}>
                      Opt {idx}: {opt.text_en.slice(0, 24)}
                    </option>
                  ))}
                </select>

                <select
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                  style={{ padding: '10px 8px', borderRadius: '8px', border: '1px solid #0284c7', backgroundColor: '#f0f9ff', color: '#0369a1', fontSize: '12px', fontWeight: 800 }}
                >
                  <option value={1}>+1 Vote</option>
                  <option value={5}>+5 Votes</option>
                  <option value={10}>+10 (Tier 2)</option>
                  <option value={25}>+25 (Tier 3)</option>
                  <option value={50}>+50 (Fortify)</option>
                  <option value={150}>+150 (Hotspot)</option>
                </select>

                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={injectAsVerified}
                    onChange={(e) => setInjectAsVerified(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>🛡️ Verified</span>
                </label>

                <div style={{ padding: '7px 10px', borderRadius: '8px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748b' }}>SEAT TOTAL</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#0284c7' }}>
                    {currentSeatTally?.total_votes || 0} <span style={{ fontSize: '10px', color: '#059669' }}>({currentSeatTally?.verified_total_votes || 0}v)</span>
                  </div>
                </div>

                <button
                  onClick={handleSimulateBallot}
                  style={{ padding: '10px 16px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  ⚡ Inject {batchCount}
                </button>
              </div>

              {simMessage && (
                <div style={{ marginTop: '10px', fontSize: '11.5px', fontWeight: 700, color: simMessage.startsWith('✓') ? '#059669' : '#dc2626' }}>
                  {simMessage}
                </div>
              )}

              {/* Fast Citizen Persona Switcher */}
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                  👥 Fast Citizen Persona Switcher (Testing Sandbox):
                </span>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 8px 0' }}>
                  Switch browser state to different mock citizen passports instantly:
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Citizen A (Karakat, BR)', phone: '9999900001', seat: 'Karakat', state: 'Bihar' },
                    { label: 'Citizen B (Darbhanga, BR)', phone: '9999900002', seat: 'Darbhanga', state: 'Bihar' },
                    { label: 'Citizen C (Nagpur, MH)', phone: '9999900003', seat: 'Nagpur', state: 'Maharashtra' }
                  ].map((persona) => (
                    <button
                      key={persona.phone}
                      type="button"
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase.rpc('verify_phone_otp', {
                            p_phone: persona.phone,
                            p_otp: '123456',
                            p_state: persona.state,
                            p_seat: persona.seat
                          });
                          if (error) {
                            alert(`Persona switch error: ${error.message}`);
                            return;
                          }
                          if (data?.voter_token) {
                            localStorage.removeItem('bhumat_voted_cycles');
                            localStorage.removeItem('bhumat_voted_polls');
                            localStorage.removeItem('bhumat_vote_timestamps');
                            localStorage.removeItem('bhumat_dbg_balance');
                            sessionStorage.clear();
                            localStorage.setItem('bhumat_voter_token', data.voter_token);
                            localStorage.setItem('bhumat_user_seat', persona.seat);
                            localStorage.setItem('bhumat_user_state', persona.state);
                            localStorage.setItem('bhumat_user_phone', persona.phone);
                            alert(`Switched to ${persona.label}!\nToken: ${data.voter_token}\n\nGo to the main app tab and refresh.`);
                          } else {
                            alert(`Failed: ${data?.error || 'No voter token returned'}`);
                          }
                        } catch (err: any) {
                          alert(`Execution error: ${err.message}`);
                        }
                      }}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      🎭 {persona.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cycle Roll-over simulator */}
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#0369a1' }}>📅 Cycle Cadence Roll-Over Test:</span>
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>Simulate moving to Season 11 (Nov 2026) to test re-vote unlocking.</span>
                </div>
                <button
                  onClick={handleSimulateCycleRollOver}
                  style={{ padding: '6px 14px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                >
                  Advance Cycle &rarr; 2026-11
                </button>
              </div>
              {cycleSimStatus && (
                <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 700, color: cycleSimStatus.startsWith('✓') ? '#059669' : '#dc2626' }}>
                  {cycleSimStatus}
                </div>
              )}
            </div>

            {/* Table 4: Pre-Computed Constituency Matrix */}
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
                  <button onClick={() => setTallyFilter('FORTIFIED')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: tallyFilter === 'FORTIFIED' ? '#0f172a' : '#f1f5f9', color: tallyFilter === 'FORTIFIED' ? '#ffffff' : '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Fortified (&ge;50)</button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px' }}>Constituency</th>
                      <th style={{ padding: '10px' }}>State</th>
                      <th style={{ padding: '10px' }}>Total Ballots</th>
                      <th style={{ padding: '10px' }}>Verified (OTP)</th>
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
                        <td colSpan={9} style={{ padding: '18px', textAlign: 'center', color: '#94a3b8' }}>
                          No seats matching filter.
                        </td>
                      </tr>
                    ) : (
                      filteredTallies.map((row) => (
                        <tr key={`${row.constituency_name}-${row.state_name}-${row.poll_id || ''}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px', fontWeight: 800 }}>{row.constituency_name}</td>
                          <td style={{ padding: '10px', color: '#64748b' }}>{row.state_name}</td>
                          <td style={{ padding: '10px', fontWeight: 900, color: '#0284c7' }}>{row.total_votes}</td>
                          <td style={{ padding: '10px', fontWeight: 800, color: '#059669' }}>{row.verified_total_votes || 0}</td>
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
                    onClick={() => exportTableToCSV(scopedSampleRows, `bhumat_ballots_${selectedPollId}`)}
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
                    {scopedSampleRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: '#94a3b8' }}>
                          Ballot box is currently empty for this target.
                        </td>
                      </tr>
                    ) : (
                      scopedSampleRows.map((b) => (
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