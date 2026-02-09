import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="rounded-lg border bg-card p-10 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The page you requested does not exist.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
