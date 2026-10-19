import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { payload, pin } = body;

    const masterPin = process.env.NEXT_PUBLIC_ADMIN_PIN || 'bhumat2026';
    if (pin !== masterPin) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid Admin PIN' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://exzvzwlqbygftclsyecq.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4enZ6d2xxYnlnZnRjbHN5ZWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwODAwMzAsImV4cCI6MjEwNzY1NjAzMH0.u6RDlcvqWXDcX2FOW-Rj4SANBL7ZWgg76WgcX2-DI2I';

    const serverClient = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await serverClient.rpc('deploy_new_poll', {
      p_payload: payload
    });

    if (error || data?.success === false) {
      return NextResponse.json({ success: false, error: error?.message || data?.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, poll_id: data?.poll_id || payload?.id });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}