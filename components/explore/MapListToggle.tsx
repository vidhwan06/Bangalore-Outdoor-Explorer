'use client';

// Mobile Map/List toggle for /explore page.
// Visible only on small screens (< lg). Desktop always shows both views side by side.

import { cn } from '@/lib/utils';

export type MapListView = 'map' | 'list';

export interface MapListToggleProps {
  /** Currently active view. */
  view: MapListView;
  /** Called when the user changes the view. */
  onChange: (view: MapListView) => void;
  /** Whether there are results to show on the map. Affects disabled state. */
  hasMapResults?: boolean;
}

export function MapListToggle({ view, onChange, hasMapResults = true }: MapListToggleProps) {
  return (
    <div
      role="group"
      aria-label="Switch between map and list view"
      className="lg:hidden mb-4 flex items-center justify-center gap-2"
    >
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={view === 'list'}
        className={cn(
          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2',
          view === 'list'
            ? 'bg-primary-600 text-white'
            : 'bg-surface-100 text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-200 dark:hover:bg-surface-700'
        )}
      >
        List
      </button>
      <button
        type="button"
        onClick={() => onChange('map')}
        aria-pressed={view === 'map'}
        disabled={!hasMapResults}
        className={cn(
          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          view === 'map'
            ? 'bg-primary-600 text-white'
            : 'bg-surface-100 text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-200 dark:hover:bg-surface-700'
        )}
      >
        Map
      </button>
    </div>
  );
}