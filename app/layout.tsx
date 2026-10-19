import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a'
};

export const metadata: Metadata = {
  title: "BhuMat - Bharat's Sovereign Public Opinion Grid",
  description: "Independent sovereign consensus grid across all 543 Lok Sabha parliamentary seats in Bharat. Cast your ballot on daily civic audits and cultural pulses.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://vote.bhumat.com'),
  openGraph: {
    title: "BhuMat - Bharat's Sovereign Public Opinion Grid",
    description: "Real-time democratic consensus across all 543 Lok Sabha seats.",
    url: 'https://vote.bhumat.com',
    siteName: 'BhuMat',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: "BhuMat Sovereign Grid Preview"
      }
    ],
    locale: 'en_IN',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: "BhuMat — Bharat's Sovereign Public Opinion Grid",
    description: "Real-time democratic consensus across all 543 Lok Sabha seats.",
    images: ['/api/og']
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
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f8fafc' }}>
        {children}
      </body>
    </html>
  );
}