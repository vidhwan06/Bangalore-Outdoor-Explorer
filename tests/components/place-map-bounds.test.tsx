/** @jest-environment jsdom */
// Prop plumbing between the public PlaceMap wrapper and the map engine:
// the parent's onBoundsChange callback must reach the engine untouched.
// (The moveend -> bounds conversion itself is covered by map-bounds-reporter.)

import { fireEvent, render, screen } from '@testing-library/react';
import { PlaceMap } from '@/components/map/PlaceMap';
import { MAP_TEST_POINTS } from '../fixtures/map-places';

jest.mock('@/components/map/PlaceMapInner', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props: {
      places?: Array<{ id: string }>;
      onBoundsChange?: (bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
      }) => void;
    }) =>
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'map-engine-proxy',
          onClick: () =>
            props.onBoundsChange?.({ north: 13.1, south: 12.9, east: 77.7, west: 77.4 }),
        },
        `markers:${props.places?.length ?? 0}`
      ),
  };
});

describe('PlaceMap viewport plumbing', () => {
  it('forwards onBoundsChange to the map engine', async () => {
    const onBoundsChange = jest.fn();
    render(<PlaceMap places={[]} onBoundsChange={onBoundsChange} />);

    const engine = await screen.findByTestId('map-engine-proxy');
    fireEvent.click(engine);

    expect(onBoundsChange).toHaveBeenCalledTimes(1);
    expect(onBoundsChange).toHaveBeenCalledWith({
      north: 13.1,
      south: 12.9,
      east: 77.7,
      west: 77.4,
    });
  });

  it('passes the marker set through to the map engine unchanged', async () => {
    render(<PlaceMap places={MAP_TEST_POINTS} />);

    expect(await screen.findByTestId('map-engine-proxy')).toHaveTextContent(
      `markers:${MAP_TEST_POINTS.length}`
    );
  });
});
