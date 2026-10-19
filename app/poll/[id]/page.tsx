export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { supabase } from '../../utils/supabaseClient';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ seat?: string; state?: string; ref?: string; lang?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { seat = 'Bharat', state = '', lang = 'EN' } = await searchParams;

  const { data: poll } = await supabase
    .from('polls')
    .select('*')
    .eq('id', id)
    .single();

  if (!poll) {
    return {
      title: 'BhuMat — Bharat Sovereign Public Opinion Grid',
      description: 'Cast your vote across all 543 Lok Sabha constituencies.',
    };
  }

  const title = lang === 'HI' ? poll.title_hi : poll.title_en;

  // Retrieve seat tally if specified
  let leadText = lang === 'HI' ? 'मतदान जारी' : 'Voting in Progress';
  let leadPct = '0';
  let totalVotes = '0';
  let winningIdx = 0; // <--- Lifted to outer scope!

  if (seat && seat !== 'Bharat') {
    const { data: tally } = await supabase
      .from('constituency_tallies')
      .select('*')
      .eq('poll_id', id)
      .eq('constituency_name', seat)
      .single();

    if (tally && tally.total_votes > 0) {
      totalVotes = String(tally.total_votes);
      let highest = -1;
      (poll.options || []).forEach((_: any, idx: number) => {
        const c = Number(tally[`opt_${idx}_votes`] ?? tally[`option_${idx}_votes`]) || 0;
        if (c > highest) {
          highest = c;
          winningIdx = idx;
        }
      });
      if (highest > 0) {
        leadPct = String(Math.round((highest / tally.total_votes) * 100));
        leadText = lang === 'HI' ? poll.options[winningIdx]?.text_hi : poll.options[winningIdx]?.text_en;
      }
    }
  }

  const ogUrl = new URL('https://vote.bhumat.com/api/og');
  ogUrl.searchParams.set('seat', seat);
  if (state) ogUrl.searchParams.set('state', state);
  ogUrl.searchParams.set('category', poll.category || 'JanMat');
  ogUrl.searchParams.set('title', title);
  ogUrl.searchParams.set('lead', leadText);
  ogUrl.searchParams.set('pct', leadPct);
  ogUrl.searchParams.set('total', totalVotes);
  ogUrl.searchParams.set('lang', lang);
  ogUrl.searchParams.set('optIdx', String(winningIdx));

  return {
    title: `${seat} Consensus: ${title} | BhuMat`,
    description: `Leading stance in ${seat}: ${leadText} (${leadPct}%). Cast your sovereign vote on BhuMat.`,
    openGraph: {
      title: `${seat} Consensus: ${title} | BhuMat`,
      description: `Leading stance in ${seat}: ${leadText} (${leadPct}%). Cast your sovereign vote across all 543 seats.`,
      url: `https://vote.bhumat.com/poll/${id}?seat=${encodeURIComponent(seat)}`,
      siteName: 'BhuMat',
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${seat} Consensus Scorecard`,
        },
      ],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${seat} Consensus: ${title} | BhuMat`,
      description: `Leading stance in ${seat}: ${leadText} (${leadPct}%).`,
      images: [ogUrl.toString()],
    },
  };
}

export default async function PollSharePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { seat, ref } = await searchParams;

  // Seamless redirect into root application while carrying deep-link context
  const targetParams = new URLSearchParams();
  if (id) targetParams.set('poll', id);
  if (seat) targetParams.set('seat', seat);
  if (ref) targetParams.set('ref', ref);

  redirect(`/?${targetParams.toString()}`);
}