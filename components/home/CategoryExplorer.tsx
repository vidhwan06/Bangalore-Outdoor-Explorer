// Category Explorer
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { placeCategorySchema, type PlaceCategory } from '@/lib/validation/schemas';

const categoryMeta = [
  { key: 'trek', label: 'Treks', icon: '🏔️', category: 'TREK' as PlaceCategory, color: 'primary' },
  { key: 'waterfall', label: 'Waterfalls', icon: '💧', category: 'WATERFALL' as PlaceCategory, color: 'blue' },
  { key: 'lake', label: 'Lakes', icon: '🏞️', category: 'LAKE' as PlaceCategory, color: 'cyan' },
  { key: 'fort', label: 'Forts', icon: '🏰', category: 'FORT' as PlaceCategory, color: 'amber' },
  { key: 'viewpoint', label: 'Viewpoints', icon: '🌄', category: 'VIEWPOINT' as PlaceCategory, color: 'orange' },
  { key: 'camping', label: 'Camping', icon: '⛺', category: 'CAMPING' as PlaceCategory, color: 'green' },
  { key: 'cycling', label: 'Cycling', icon: '🚴', category: 'CYCLING' as PlaceCategory, color: 'purple' },
  { key: 'hidden_gem', label: 'Hidden Gems', icon: '✨', category: 'HIDDEN_GEM' as PlaceCategory, color: 'pink' },
  { key: 'hike', label: 'Hikes', icon: '🥾', category: 'HIKE' as PlaceCategory, color: 'emerald' },
  { key: 'mountain', label: 'Mountains', icon: '⛰️', category: 'MOUNTAIN' as PlaceCategory, color: 'rose' },
  { key: 'forest', label: 'Forests', icon: '🌲', category: 'FOREST' as PlaceCategory, color: 'teal' },
  { key: 'cave', label: 'Caves', icon: '🕳️', category: 'CAVE' as PlaceCategory, color: 'indigo' },
  { key: 'scenic_drive', label: 'Scenic Drives', icon: '🛣️', category: 'SCENIC_DRIVE' as PlaceCategory, color: 'violet' },
] as const;

interface CategoryExplorerProps {
  categoryCounts: Record<string, number>;
}

export function CategoryExplorer({ categoryCounts }: CategoryExplorerProps) {
  return (
    <section className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="animate-in mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl dark:text-surface-50">
            Explore by Category
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-surface-600 dark:text-surface-400">
            13 outdoor categories defined. Click a category to explore destinations within 50 km of Bengaluru.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
          {categoryMeta.map((cat) => {
            const count = categoryCounts[cat.category] ?? 0;
            return (
              <Link
                key={cat.key}
                href={`/explore?category=${cat.key}`}
                className="card-interactive group p-6 text-center transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
              >
                <div
                  className={cn(
                    'mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl transition-transform duration-300 group-hover:scale-110',
                    `bg-${cat.color}-100 dark:bg-${cat.color}-900/30`
                  )}
                >
                  {cat.icon}
                </div>
                <h3 className="group-hover:text-primary font-semibold text-surface-900 transition-colors dark:text-surface-500 dark:group-hover:text-primary-400">
                  {cat.label}
                </h3>
                <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                  {count} place{count === 1 ? '' : 's'}
                </p>
              </Link>
            );
          })}
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
