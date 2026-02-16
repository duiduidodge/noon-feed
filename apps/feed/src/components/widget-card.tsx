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
        'rounded-2xl overflow-hidden border border-border/40 bg-surface/20 backdrop-blur-md shadow-sm',
        className
      )}
    >
      {/* Accent Top Gradient */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-60" />

      <div className="flex items-center justify-between px-5 py-4 border-b border-border/30 bg-surface/10">
        <h2 className="font-display text-sm font-bold tracking-widest text-foreground uppercase flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          {title}
        </h2>
        {headerRight}
      </div>
      <div className="bg-surface/5">{children}</div>
    </div>
  );
}
