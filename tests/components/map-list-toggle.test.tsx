/** @jest-environment jsdom */
// Tests for the mobile Map/List toggle component.

import { fireEvent, render, screen } from '@testing-library/react';
import { MapListToggle } from '@/components/explore/MapListToggle';

describe('MapListToggle', () => {
  it('renders both List and Map buttons', () => {
    render(<MapListToggle view="list" onChange={jest.fn()} />);

    expect(screen.getByRole('group', { name: /switch between map and list view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument();
  });

  it('shows List as active by default', () => {
    render(<MapListToggle view="list" onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows Map as active when view is map', () => {
    render(<MapListToggle view="map" onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange when List button is clicked', () => {
    const onChange = jest.fn();
    render(<MapListToggle view="map" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(onChange).toHaveBeenCalledWith('list');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('calls onChange when Map button is clicked', () => {
    const onChange = jest.fn();
    render(<MapListToggle view="list" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(onChange).toHaveBeenCalledWith('map');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('disables Map button when hasMapResults is false', () => {
    render(<MapListToggle view="list" onChange={jest.fn()} hasMapResults={false} />);

    expect(screen.getByRole('button', { name: 'Map' })).toBeDisabled();
  });

  it('enables Map button when hasMapResults is true', () => {
    render(<MapListToggle view="list" onChange={jest.fn()} hasMapResults={true} />);

    expect(screen.getByRole('button', { name: 'Map' })).not.toBeDisabled();
  });

  it('has keyboard focus styles', () => {
    render(<MapListToggle view="list" onChange={jest.fn()} />);

    const listButton = screen.getByRole('button', { name: 'List' });
    expect(listButton).toHaveClass('focus:ring-2');
    expect(listButton).toHaveClass('focus:ring-primary-600');
  });
});