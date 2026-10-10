const fs = require('fs');
const https = require('https');
const path = require('path');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  console.log('1. Fetching Delimitation Crosswalk (DataMeet)...');
  const crosswalkCsv = await fetchUrl(
    'https://raw.githubusercontent.com/datameet/india-election-data/master/constituencies/2008-constituencies.csv'
  );

  console.log('2. Fetching 2024 Lok Sabha Winners (ECI/OpenCity)...');
  const winnersCsv = await fetchUrl(
    'https://data.opencity.in/dataset/85a345c6-78c0-4f57-adfc-236c726c5456/resource/3e96ed32-9b97-4c5b-9201-7807d90b20e5/download/2a4e0925-0903-4857-902b-9a57cfb78094.csv'
  );

  const outputDir = path.join(__dirname, '../public/data');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(path.join(outputDir, 'raw_pc_ac_crosswalk.csv'), crosswalkCsv);
  fs.writeFileSync(path.join(outputDir, 'raw_2024_winners.csv'), winnersCsv);

  console.log('✓ Successfully downloaded raw official datasets to /public/data');
  console.log('  - public/data/raw_pc_ac_crosswalk.csv');
  console.log('  - public/data/raw_2024_winners.csv');
}

run().catch(console.error);