// Discovery page header — title, context and what users can discover.

export function DiscoveryHeader() {
  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
          Outdoor discovery
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl dark:text-surface-50">
          Explore the outdoors around Bengaluru
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-surface-600 dark:text-surface-400">
          Search treks, hills, waterfalls, lakes and hidden gems within 50&nbsp;km of your starting
          point. Every result shows distance, difficulty and how much the information can be trusted
          — everything you need before you leave.
        </p>
      </div>
    </header>
  );
}
