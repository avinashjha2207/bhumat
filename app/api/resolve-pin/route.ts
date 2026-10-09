import { NextResponse } from 'next/server';

interface CandidateSeat {
  name: string;
  state: string;
  pc_code?: string;
}

// Canonical Directory (80% direct locks, 20% border overlaps)
const PIN_CROSSWALK: Record<string, CandidateSeat[]> = {
  // 500005: Himayatnagar / Domalguda / Musheerabad
  '500005': [
    { name: 'Secunderabad', state: 'Telangana', pc_code: '08-TG' },
    { name: 'Hyderabad', state: 'Telangana', pc_code: '09-TG' }
  ],
  // 560017: HAL / Vimanapura / Kodihalli
  '560017': [
    { name: 'Bangalore Central', state: 'Karnataka', pc_code: '25-KA' },
    { name: 'Bangalore South', state: 'Karnataka', pc_code: '26-KA' }
  ],
  '500001': [{ name: 'Hyderabad', state: 'Telangana', pc_code: '09-TG' }],
  '500003': [{ name: 'Secunderabad', state: 'Telangana', pc_code: '08-TG' }],
  '560001': [{ name: 'Bangalore Central', state: 'Karnataka', pc_code: '25-KA' }],
  '400001': [{ name: 'Mumbai South', state: 'Maharashtra', pc_code: '31-MH' }],
  '400601': [{ name: 'Thane', state: 'Maharashtra', pc_code: '25-MH' }],
  '110001': [{ name: 'New Delhi', state: 'Delhi', pc_code: '04-DL' }],
  '846004': [{ name: 'Darbhanga', state: 'Bihar', pc_code: '14-BR' }],
  '250001': [{ name: 'Meerut', state: 'Uttar Pradesh', pc_code: '10-UP' }]
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pin = searchParams.get('pin')?.trim();

  if (!pin || pin.length !== 6) {
    return NextResponse.json({ candidates: [], error: 'Invalid PIN length' }, { status: 400 });
  }

  // 1. Direct verified crosswalk
  if (PIN_CROSSWALK[pin]) {
    return NextResponse.json({ candidates: PIN_CROSSWALK[pin] });
  }

  // 2. Postal Circle Defaults
  const prefix2 = pin.substring(0, 2);
  let fallbackCandidates: CandidateSeat[] = [];

  switch (prefix2) {
    case '50':
      fallbackCandidates = [
        { name: 'Secunderabad', state: 'Telangana', pc_code: '08-TG' },
        { name: 'Hyderabad', state: 'Telangana', pc_code: '09-TG' }
      ];
      break;
    case '56':
      fallbackCandidates = [
        { name: 'Bangalore Central', state: 'Karnataka', pc_code: '25-KA' },
        { name: 'Bangalore South', state: 'Karnataka', pc_code: '26-KA' }
      ];
      break;
    case '40':
      fallbackCandidates = [{ name: 'Mumbai South', state: 'Maharashtra', pc_code: '31-MH' }];
      break;
    case '11':
      fallbackCandidates = [{ name: 'New Delhi', state: 'Delhi', pc_code: '04-DL' }];
      break;
    case '84':
      fallbackCandidates = [{ name: 'Darbhanga', state: 'Bihar', pc_code: '14-BR' }];
      break;
    case '25':
      fallbackCandidates = [{ name: 'Meerut', state: 'Uttar Pradesh', pc_code: '10-UP' }];
      break;
    default:
      fallbackCandidates = [];
  }

  return NextResponse.json({ candidates: fallbackCandidates });
}