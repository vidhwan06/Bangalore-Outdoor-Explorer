// Why Choose Us
import { cn } from '@/lib/utils';

const features = [
  {
    icon: '✅',
    title: 'Verified Information',
    description:
      'Official sources, verified contributors & community cross-checks. Every destination has a trust score.',
    color: 'green',
  },
  {
    icon: '🗺️',
    title: 'Map-First Discovery',
    description:
      'Interactive map with clustered markers, filters, offline support & GPS navigation to trailheads.',
    color: 'blue',
  },
  {
    icon: '🌤️',
    title: 'Real-Time Conditions',
    description:
      'Live weather, trail conditions, crowd levels & hazard alerts from official & community sources.',
    color: 'yellow',
  },
  {
    icon: '🎫',
    title: 'Permit & Access Info',
    description:
      'Up-to-date permit requirements, entry fees, timings, group limits & booking links.',
    color: 'purple',
  },
  {
    icon: '🍽️',
    title: 'Nearby Essentials',
    description: 'Food, fuel, hospitals, parking, water & accommodation near every destination.',
    color: 'orange',
  },
  {
    icon: '🤖',
    title: 'AI Trip Planner',
    description:
      'Constraint-based itinerary generation with deterministic ranking — not hallucinated suggestions.',
    color: 'pink',
  },
  {
    icon: '🔒',
    title: 'Location Privacy',
    description:
      'Sensitive ecosystems & private property protected with approximate coordinates & access controls.',
    color: 'red',
  },
  {
    icon: '👥',
    title: 'Community Powered',
    description:
      'Visit logs, trail reports, photos & verification — all attributed, timestamped & moderated.',
    color: 'indigo',
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
            Not just a directory. A living platform built on trust, real-time data & community
            verification.
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
