// CTA Section
import Link from 'next/link';

export function CTASection() {
  return (
    <section className="bg-primary-600 py-16 lg:py-24 dark:bg-primary-700">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-primary-700/90 p-8 text-center md:p-12 lg:p-16">
          <div className="animate-in relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Ready to Explore?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-100">
              Discover treks, waterfalls, forts, and hidden gems near Bengaluru. Free to browse.
              No account required. Community-driven roadmap.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/explore"
                className="btn w-full bg-white px-8 py-3 text-base text-primary-700 hover:bg-primary-50 active:bg-primary-100 sm:w-auto"
              >
                Start Exploring Now
              </Link>
              <Link
                href="/explore"
                className="btn w-full border-2 border-white px-8 py-3 text-base text-white hover:bg-white/10 active:bg-white/20 sm:w-auto"
              >
                Open Map View
              </Link>
            </div>

            <p className="mt-6 text-sm text-primary-200">
              Browse without an account • Future features: save places, log visits, contribute
            </p>
          </div>

          {/* Decorative background elements */}
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary-500/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-primary-400/10 blur-3xl" />
            <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-500/5 blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
