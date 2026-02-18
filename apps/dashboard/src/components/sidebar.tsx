'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Newspaper,
  Rss,
  BarChart3,
  ShieldAlert,
  Download,
  PenSquare,
  X,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Articles', href: '/articles', icon: Newspaper },
  { name: 'My Posts', href: '/posts', icon: PenSquare },
  { name: 'Sources', href: '/sources', icon: Rss },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Reliability', href: '/reliability', icon: ShieldAlert },
  { name: 'Export', href: '/export', icon: Download },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  const isRouteActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-card transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-6">
          <span className="text-lg font-semibold">Crypto News</span>
          <button
            aria-label="Close navigation"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            onClick={onCloseMobile}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = isRouteActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onCloseMobile}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground">Crypto News Bot v1.0.0</p>
        </div>
      </aside>
    </>
  );
}
