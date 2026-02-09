import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'CryptoFeed — Real-time Crypto Intelligence',
  description: 'Live cryptocurrency news feed with market prices and sentiment analysis',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
