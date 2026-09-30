/** @jest-environment jsdom */
// Verifies the explore page is wired to the new map component with
// synthetic fixtures (Phase 2C.1 — no viewport/API sync yet).

import { fireEvent, render, screen } from '@testing-library/react';
import { ExploreDiscovery } from '@/components/explore/ExploreDiscovery';

describe('ExploreDiscovery map integration', () => {
  it('renders the map panel with synthetic markers next to the results', async () => {
    render(<ExploreDiscovery />);

    expect(screen.getByRole('complementary', { name: 'Map' })).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Interactive map' })).toBeInTheDocument();

    // Synthetic fixture markers (not real places)
    expect(await screen.findByLabelText('Test Peak')).toBeInTheDocument();
    expect(await screen.findByLabelText('Second Hill')).toBeInTheDocument();
    expect(
      await screen.findByLabelText('Riverside Test Point (approximate location)')
    ).toBeInTheDocument();
  });

  it('keeps the discovery results behaviour intact alongside the map', async () => {
    render(<ExploreDiscovery />);

    expect(
      screen.getByRole('heading', { level: 2, name: /ready when you are/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Latitude')).toBeInTheDocument();
    expect(await screen.findByLabelText('Test Peak')).toBeInTheDocument();
  });

  it('selects a marker through the selection callback', async () => {
    render(<ExploreDiscovery />);

    const marker = await screen.findByLabelText('Test Peak');
    expect(marker).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(marker);

    expect(await screen.findByLabelText('Test Peak')).toHaveAttribute('aria-pressed', 'true');
  });
});
