'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './sidebar';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            aria-label="Open navigation"
            className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
            Menu
          </button>
        </header>
        <main id="main-content" className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
