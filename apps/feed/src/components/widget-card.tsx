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
        'glass rounded-lg overflow-hidden',
        'shadow-[0_0_1px_hsl(var(--accent)/0.1),0_4px_24px_hsl(0_0%_0%/0.3)]',
        className
      )}
    >
      {/* Accent top line */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

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
