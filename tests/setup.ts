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
}));

// Mock next/image - simple mock that returns a string to avoid JSX parsing issues
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.IMGHTMLAttributes<HTMLImageElement>) => {
    return `mock-image-${props.src || 'unknown'}`;
  },
}));
