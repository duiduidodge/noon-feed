import { clsx } from 'clsx';

interface WidgetCardProps {
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function WidgetCard({ title, headerRight, children, className }: WidgetCardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl overflow-hidden border border-border/50 bg-card/50',
        className
      )}
    >
      {/* Accent top line */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <h2 className="font-display text-sm font-semibold tracking-wide text-foreground uppercase">
          {title}
        </h2>
        {headerRight}
      </div>
      <div>{children}</div>
    </div>
  );
}
