import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { DashboardShell } from '@/components/dashboard-shell';

export const metadata: Metadata = {
  title: 'Crypto News Dashboard',
  description: 'Manage and monitor crypto news content',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-body text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only z-[100] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to main content
        </a>
        <Providers>
          <DashboardShell>{children}</DashboardShell>
        </Providers>
      </body>
    </html>
  );
}
