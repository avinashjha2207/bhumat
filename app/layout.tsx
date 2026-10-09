import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://bhumat.vercel.app'
  ),
  title: 'BhuMat — Spatially Mapping Public Sentiment Across 543 Lok Sabha Seats',
  description: 'Bharat’s sovereign civic consensus platform. Verified secret ballot audits across every parliamentary seat.',
  openGraph: {
    title: 'BhuMat — Drishti Pan-Bharat Scoreboard',
    description: 'Track real-time Lok Sabha consensus audits across 543 parliamentary seats.',
    url: 'https://bhumat.vercel.app',
    siteName: 'BhuMat',
    images: [
      {
        url: '/api/og?seat=Bharat&state=National&verdict=Live%20Consensus&pct=64',
        width: 1200,
        height: 630,
        alt: 'BhuMat Pan-Bharat Consensus Scoreboard'
      }
    ],
    locale: 'en_IN',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BhuMat — Drishti Pan-Bharat Scoreboard',
    description: 'Track real-time Lok Sabha consensus audits across 543 parliamentary seats.',
    images: ['/api/og?seat=Bharat&state=National&verdict=Live%20Consensus&pct=64']
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f8fafc' }}>
        {children}
      </body>
    </html>
  );
}