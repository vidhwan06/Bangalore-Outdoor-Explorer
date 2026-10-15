import type { Metadata, Viewport } from 'next';
import { Newsreader, Manrope, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-newsreader',
  weight: ['400', '500'],
});

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'Bengaluru Outdoor Explorer',
    template: '%s | Bengaluru Outdoor Explorer',
  },
  description:
    'The living outdoor map of Bengaluru. Discover treks, waterfalls, lakes, forts, and hidden gems within 150km of Bengaluru.',
  keywords: [
    'Bengaluru',
    'trekking',
    'hiking',
    'outdoor',
    'waterfalls',
    'camping',
    'nature',
    'Karnataka',
  ],
  authors: [{ name: 'Bengaluru Outdoor Explorer' }],
  creator: 'Bengaluru Outdoor Explorer',
  publisher: 'Bengaluru Outdoor Explorer',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://bengaluruoutdoor.in',
    siteName: 'Bengaluru Outdoor Explorer',
    title: 'Bengaluru Outdoor Explorer',
    description: 'The living outdoor map of Bengaluru. Everything you need before you leave.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Bengaluru Outdoor Explorer',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bengaluru Outdoor Explorer',
    description: 'The living outdoor map of Bengaluru.',
    images: ['/og-image.png'],
  },
  verification: {
    google: 'google-site-verification-code',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F1E9' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1513' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${manrope.variable} ${jetbrainsMono.variable} antialiased`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-background text-on-background transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}