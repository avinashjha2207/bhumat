const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSeed() {
  console.log("Reading seed_official_eci_2024.sql...");
  const sqlPath = path.join(__dirname, 'seed_official_eci_2024.sql');
  
  if (!fs.existsSync(sqlPath)) {
    console.error("File not found at", sqlPath);
    return;
  }
  
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log("Executing SQL migration via Supabase RPC...");
  // Using Supabase Postgres query execution or direct upsert
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.error("Error executing SQL:", error.message);
  } else {
    console.log("✓ Successfully seeded public.constituency_dossiers!");
  }
}

runSeed();