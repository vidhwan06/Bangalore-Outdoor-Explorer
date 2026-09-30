// Search & filter controls for the discovery page.
// Presentational only — values and handlers come from the container component.

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  CATEGORY_OPTIONS,
  DIFFICULTY_OPTIONS,
  MAX_RADIUS_METERS,
  RADIUS_OPTIONS,
} from '@/features/places/discovery';

export interface DiscoveryFormValues {
  latitude: string;
  longitude: string;
  radiusMeters: number;
  category: string;
  difficulty: string;
}

export interface DiscoveryControlsProps {
  values: DiscoveryFormValues;
  onValuesChange: (patch: Partial<DiscoveryFormValues>) => void;
  onSearch: () => void;
  onUseCurrentLocation: () => void;
  isLoading: boolean;
  fieldErrors?: { latitude?: string; longitude?: string };
  locationMessage?: string | null;
}

export function DiscoveryControls({
  values,
  onValuesChange,
  onSearch,
  onUseCurrentLocation,
  isLoading,
  fieldErrors,
  locationMessage,
}: DiscoveryControlsProps) {
  return (
    <form
      aria-label="Search and filters"
      className="card p-4 md:p-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSearch();
      }}
    >
      <fieldset className="m-0 border-0 p-0">
        <legend className="p-0 text-sm font-semibold text-surface-900 dark:text-surface-50">
          Starting point &amp; filters
        </legend>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Latitude"
            type="number"
            step="any"
            min={-90}
            max={90}
            inputMode="decimal"
            value={values.latitude}
            placeholder="12.9716"
            error={fieldErrors?.latitude}
            onChange={(event) => onValuesChange({ latitude: event.target.value })}
          />

          <Input
            label="Longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            inputMode="decimal"
            value={values.longitude}
            placeholder="77.5946"
            error={fieldErrors?.longitude}
            onChange={(event) => onValuesChange({ longitude: event.target.value })}
          />

          <Select
            label="Search radius"
            options={RADIUS_OPTIONS}
            value={String(values.radiusMeters)}
            onChange={(event) => onValuesChange({ radiusMeters: Number(event.target.value) })}
          />

          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={values.category}
            onChange={(event) => onValuesChange({ category: event.target.value })}
          />

          <Select
            label="Difficulty"
            options={DIFFICULTY_OPTIONS}
            value={values.difficulty}
            helperText="Matches a single difficulty level"
            onChange={(event) => onValuesChange({ difficulty: event.target.value })}
          />

          <div className="flex flex-wrap items-start gap-2 md:col-span-2 lg:col-span-3">
            <Button type="submit" className="btn-primary" loading={isLoading} aria-busy={isLoading}>
              Search places
            </Button>
            <Button type="button" className="btn-outline" onClick={onUseCurrentLocation}>
              Use current location
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-xs text-surface-500 dark:text-surface-400">
            Defaults to central Bengaluru. Coordinates are in decimal degrees; maximum radius is{' '}
            {MAX_RADIUS_METERS / 1000}&nbsp;km.
          </p>
          {locationMessage && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {locationMessage}
            </p>
          )}
        </div>
      </fieldset>
    </form>
  );
}
