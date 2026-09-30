/** @jest-environment jsdom */
// Component tests for the discovery search/filter controls

import { render, screen, fireEvent } from '@testing-library/react';
import {
  DiscoveryControls,
  type DiscoveryControlsProps,
  type DiscoveryFormValues,
} from '@/components/explore/DiscoveryControls';

const baseValues: DiscoveryFormValues = {
  latitude: '12.9716',
  longitude: '77.5946',
  radiusMeters: 10000,
  category: '',
  difficulty: '',
};

function renderControls(overrides: Partial<DiscoveryControlsProps> = {}) {
  const props: DiscoveryControlsProps = {
    values: baseValues,
    onValuesChange: jest.fn(),
    onSearch: jest.fn(),
    onUseCurrentLocation: jest.fn(),
    isLoading: false,
    ...overrides,
  };
  render(<DiscoveryControls {...props} />);
  return props;
}

describe('DiscoveryControls', () => {
  it('renders labelled, accessible controls', () => {
    renderControls();

    expect(screen.getByLabelText('Latitude')).toBeInTheDocument();
    expect(screen.getByLabelText('Longitude')).toBeInTheDocument();
    expect(screen.getByLabelText('Search radius')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Difficulty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search places/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use current location/i })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: /search and filters/i })).toBeInTheDocument();
  });

  it('emits radius, category and difficulty changes', () => {
    const { onValuesChange } = renderControls();

    fireEvent.change(screen.getByLabelText('Search radius'), { target: { value: '25000' } });
    expect(onValuesChange).toHaveBeenCalledWith({ radiusMeters: 25000 });

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'TREK' } });
    expect(onValuesChange).toHaveBeenCalledWith({ category: 'TREK' });

    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: '3' } });
    expect(onValuesChange).toHaveBeenCalledWith({ difficulty: '3' });
  });

  it('emits coordinate edits', () => {
    const { onValuesChange } = renderControls();

    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '13.0' } });
    expect(onValuesChange).toHaveBeenCalledWith({ latitude: '13.0' });

    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '77.6' } });
    expect(onValuesChange).toHaveBeenCalledWith({ longitude: '77.6' });
  });

  it('triggers the search when submitted', () => {
    const { onSearch } = renderControls();

    fireEvent.click(screen.getByRole('button', { name: /search places/i }));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('requests the current location without submitting the form', () => {
    const { onSearch, onUseCurrentLocation } = renderControls();

    fireEvent.click(screen.getByRole('button', { name: /use current location/i }));
    expect(onUseCurrentLocation).toHaveBeenCalledTimes(1);
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('shows coordinate validation errors', () => {
    renderControls({ fieldErrors: { latitude: 'Latitude is required' } });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Latitude is required');
    expect(screen.getByLabelText('Latitude')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a location message when geolocation fails', () => {
    renderControls({ locationMessage: 'Location permission denied. Enter coordinates manually.' });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Location permission denied. Enter coordinates manually.'
    );
  });

  it('disables and marks the search button busy while loading', () => {
    renderControls({ isLoading: true });

    const button = screen.getByRole('button', { name: /search places/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
