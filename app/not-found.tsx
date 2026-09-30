// Global not-found experience — used for invalid/unknown place slugs
// and any other missing route.

import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-50">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-base text-surface-600 dark:text-surface-400">
        This destination or page could not be found. It may have been removed, or the link may be
        incorrect.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href="/explore" className="btn-primary">
          Explore places
        </Link>
        <Link href="/" className="btn-outline">
          Go home
        </Link>
      </div>
    </main>
  );
}
