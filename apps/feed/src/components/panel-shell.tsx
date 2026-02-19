import { cn } from '@/lib/utils';

interface PanelShellProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

/**
 * Outer box for the LlamaFeed-style panel layout.
 * Provides rounded corners, border, and subtle shadow.
 * Does NOT set overflow — each child component manages its own scroll.
 */
export function PanelShell({ children, className, id }: PanelShellProps) {
  return (
    <div
      id={id}
      className={cn(
        'flex flex-col min-h-0',
        'rounded-2xl border border-border/50',
        'bg-card/72 backdrop-blur-sm',
        'column-panel',
        className
      )}
    >
      {children}
    </div>
  );
}
