import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  // Mimics Next.js: notFound() unwinds the render — tests assert this marker
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

// Mock next/image - simple mock that returns a string to avoid JSX parsing issues
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    return `mock-image-${props.src || 'unknown'}`;
  },
}));
