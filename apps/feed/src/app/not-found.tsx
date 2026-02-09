import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto mt-10 max-w-xl rounded-lg border border-border/40 bg-card p-6 text-center">
      <h1 className="font-display text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This resource is not available.
      </p>
      <Link
        href="/"
        className="mt-4 inline-flex rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent"
      >
        Back to feed
      </Link>
    </div>
  );
}
