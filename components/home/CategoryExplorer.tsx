// Category Explorer
import Link from 'next/link';
import { cn } from '@/lib/utils';

const categories = [
  { key: 'trek', label: 'Treks', icon: '🏔️', count: 45, color: 'primary' },
  { key: 'waterfall', label: 'Waterfalls', icon: '💧', count: 32, color: 'blue' },
  { key: 'lake', label: 'Lakes', icon: '🏞️', count: 28, color: 'cyan' },
  { key: 'fort', label: 'Forts', icon: '🏰', count: 18, color: 'amber' },
  { key: 'viewpoint', label: 'Viewpoints', icon: '🌄', count: 22, color: 'orange' },
  { key: 'camping', label: 'Camping', icon: '⛺', count: 15, color: 'green' },
  { key: 'cycling', label: 'Cycling', icon: '🚴', count: 12, color: 'purple' },
  { key: 'hidden_gem', label: 'Hidden Gems', icon: '✨', count: 8, color: 'pink' },
] as const;

export function CategoryExplorer() {
  return (
    <section className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="animate-in mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl dark:text-surface-50">
            Explore by Category
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-surface-600 dark:text-surface-400">
            13 curated outdoor categories across Bengaluru and the surrounding 150km region. Each
            destination includes trails, conditions, permits & nearby facilities.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
          {categories.map((category) => (
            <Link
              key={category.key}
              href={`/explore?category=${category.key}`}
              className="card-interactive group p-6 text-center transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
            >
              <div
                className={cn(
                  'mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl transition-transform duration-300 group-hover:scale-110',
                  `bg-${category.color}-100 dark:bg-${category.color}-900/30`
                )}
              >
                {category.icon}
              </div>
              <h3 className="group-hover:text-primary font-semibold text-surface-900 transition-colors dark:text-surface-500 dark:group-hover:text-primary-400">
                {category.label}
              </h3>
              <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                {category.count} places
              </p>
            </Link>
          ))}
        </div>

        <div className="animate-in mt-8 text-center">
          <Link href="/explore" className="btn-outline inline-flex items-center gap-2">
            View All Categories
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
