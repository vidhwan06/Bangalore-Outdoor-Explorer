import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
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
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#171717' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-surface-50 text-surface-900 transition-colors duration-200 dark:bg-surface-950 dark:text-surface-50">
        {children}
      </body>
    </html>
  );
}
