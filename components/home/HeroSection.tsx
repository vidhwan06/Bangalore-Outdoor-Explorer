// Hero Section
import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 to-surface-50 py-20 lg:py-32 dark:from-primary-950/20 dark:to-surface-950">
      <div
        className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5 dark:opacity-10"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-surface-50/50 to-transparent dark:from-surface-950/50"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="animate-in mx-auto max-w-3xl text-center">
          <span className="bg-primary/10 text-primary dark:bg-primary/20 mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
            </span>
            Live outdoor data • Community verified
          </span>

          <h1 className="mb-6 text-4xl font-bold tracking-tight text-surface-900 sm:text-5xl lg:text-6xl dark:text-surface-50">
            The Living Outdoor Map of
            <br />
            <span className="text-primary">Bengaluru</span>
          </h1>

          <p className="mx-auto mb-8 max-w-2xl text-lg text-surface-600 dark:text-surface-400">
            Discover treks, waterfalls, lakes, forts & hidden gems within 150km of Bengaluru.
            Real-time conditions, permits, routes & community insights — everything you need before
            you leave.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/explore" className="btn-primary w-full px-8 py-3 text-base sm:w-auto">
              Start Exploring
            </Link>
            <Link href="/map" className="btn-outline w-full px-8 py-3 text-base sm:w-auto">
              Open Map
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-surface-500 dark:text-surface-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-surface-900 dark:text-surface-500">150km</span>
              <span>Radius Coverage</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-surface-900 dark:text-surface-500">13</span>
              <span>Categories</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-surface-900 dark:text-surface-500">
                Real-time
              </span>
              <span>Conditions</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-surface-900 dark:text-surface-500">
                Community
              </span>
              <span>Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Background decorative elements */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-surface-50 to-transparent dark:from-surface-950"
        aria-hidden="true"
      />
    </section>
  );
}
