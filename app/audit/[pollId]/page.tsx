import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ pollId: string }>;
  searchParams: Promise<{ seat?: string; state?: string; verdict?: string; pct?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { pollId } = await params;
  const { seat = 'Bharat', state = 'National', verdict = 'Live Consensus', pct = '62' } = await searchParams;

  const ogImageUrl = `https://bhumat.com/api/og?seat=${encodeURIComponent(seat)}&state=${encodeURIComponent(state)}&verdict=${encodeURIComponent(verdict)}&pct=${pct}`;

  return {
    title: `${seat} Lok Sabha Audit Verdict | BhuMat`,
    description: `Public sentiment audit for ${seat} (${state}): ${verdict} (${pct}%). Cast your verified secret ballot on BhuMat.`,
    openGraph: {
      title: `${seat} Voted: ${verdict} (${pct}%)`,
      description: `Track how 543 Parliamentary seats are voting in real time on BhuMat.`,
      url: `https://bhumat.com/audit/${pollId}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${seat} Consensus Scorecard`
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: `${seat} Lok Sabha Audit Verdict | BhuMat`,
      images: [ogImageUrl]
    }
  };
}

export default async function AuditRedirectPage({ searchParams }: Props) {
  const { seat, state } = await searchParams;
  if (seat && state) {
    redirect(`/?sharedSeat=${encodeURIComponent(seat)}&sharedState=${encodeURIComponent(state)}`);
  }
  redirect('/');
}