// Why Choose Us
import { cn } from '@/lib/utils';

const features = [
  {
    icon: '✅',
    title: 'Verified Sources & Trust Scores',
    description:
      'Official sources tracked per destination. Every place has a trust level (Verified, Community Submitted, etc.) and trust score.',
    color: 'green',
  },
  {
    icon: '🗺️',
    title: 'Map-First Discovery',
    description:
      'Interactive map with clustered markers, category/difficulty/radius filters, and viewport-based discovery.',
    color: 'blue',
  },
  {
    icon: '🔒',
    title: 'Location Privacy',
    description:
      'Sensitive destinations use approximate coordinates. Visibility levels control public vs. restricted access.',
    color: 'red',
  },
  {
    icon: '📍',
    title: 'Structured Place Data',
    description:
      'Rich destination records: difficulty, distance, elevation, opening hours, entry fees, parking, water, network, permits.',
    color: 'purple',
  },
  {
    icon: '🔍',
    title: 'Powerful Search & Filters',
    description:
      'Filter by category, difficulty, distance, status. Search within 50 km radius or explore by map viewport.',
    color: 'orange',
  },
  {
    icon: '📸',
    title: 'Photos & Official Sources',
    description:
      'Multiple photos per destination with primary image. Verified official sources linked with contact details.',
    color: 'indigo',
  },
  {
    icon: '📱',
    title: 'Responsive & Accessible',
    description:
      'Mobile-first design with map/list toggle, keyboard navigation, and semantic HTML for screen readers.',
    color: 'teal',
  },
  {
    icon: '🛠️',
    title: 'Built for Extensibility',
    description:
      'Provider abstractions for maps, weather, routing, storage, auth. Ready for Phase 3 conditions, routes, and AI features.',
    color: 'yellow',
  },
] as const;

export function WhyChooseUs() {
  return (
    <section className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="animate-in mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl dark:text-surface-50">
            Why Bengaluru Outdoor Explorer?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-surface-600 dark:text-surface-400">
            A trust-first platform for outdoor discovery. Structured data, map-based exploration, and
            privacy-aware design — built on PostgreSQL/PostGIS with a modular architecture.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="card animate-in p-6"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div
                className={cn(
                  'mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl',
                  `bg-${feature.color}-100 dark:bg-${feature.color}-900/30`
                )}
              >
                {feature.icon}
              </div>
              <h3 className="mb-2 font-semibold text-surface-900 dark:text-surface-500">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-surface-600 dark:text-surface-400">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
