import type { Metadata, Viewport } from 'next';


export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a'
};

export const metadata: Metadata = {
  title: 'BhuMat - The Live Sentiment Scoreboard of Bharat',
  description: 'Real-time, verified public opinion mapped across all 543 Lok Sabha constituencies with zero GPS tracking and 100% secret ballot privacy.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://vote.bhumat.com'),
  manifest: '/manifest.json',
  alternates: {
    canonical: 'https://vote.bhumat.com',
  },
  openGraph: {
    title: 'BhuMat - The Live Sentiment Scoreboard of Bharat',
    description: 'Vote on daily 8:00 AM cultural pulses and 8:00 PM civic audits across all 543 Lok Sabha seats.',
    url: 'https://vote.bhumat.com',
    siteName: 'BhuMat',
    images: [
      {
        url: '/api/og?seat=Bharat&state=National&verdict=Live%20Consensus&pct=64',
        width: 1200,
        height: 630,
        alt: 'BhuMat 543 Consensus Grid'
      }
    ],
    locale: 'en_IN',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BhuMat - The Live Sentiment Scoreboard of Bharat',
    description: 'Zero GPS Tracking • 100% Secret Ballot • All 543 Lok Sabha Constituencies',
    images: ['/api/og?seat=Bharat&state=National&verdict=Live%20Consensus&pct=64']
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ overflowX: 'hidden', maxWidth: '100vw' }}>
      <head>
        <style>{`
          html, body {
            overflow-x: hidden !important;
            max-width: 100vw !important;
            width: 100% !important;
            position: relative;
            touch-action: pan-y;
            -webkit-overflow-scrolling: touch;
          }
          *, *::before, *::after {
            box-sizing: border-box;
          }
        `}</style>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f8fafc', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>
        {children}
      </body>
    </html>
  );
}