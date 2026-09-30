/** @jest-environment jsdom */
// Tests for the global not-found experience used by /places/[slug].

import { render, screen } from '@testing-library/react';
import NotFound from '@/app/not-found';

describe('Global not-found page', () => {
  it('renders a friendly 404 without leaking internals', () => {
    render(<NotFound />);

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText(/could not be found/i)).toBeInTheDocument();
    expect(screen.queryByText(/prisma|database|sql/i)).not.toBeInTheDocument();
  });

  it('offers navigation back into the product', () => {
    render(<NotFound />);

    expect(screen.getByRole('link', { name: 'Explore places' })).toHaveAttribute(
      'href',
      '/explore'
    );
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  });
});
