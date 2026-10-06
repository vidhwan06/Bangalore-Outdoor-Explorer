import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({
  dir: './',
});

const config: Config = {
  testEnvironment: 'node', // Changed to node by default for database tests

  // Integration tests run against a real, REMOTE Postgres, so Jest's 5s default
  // is not enough for a hook that inserts fixtures or cleans them up. A hook
  // that times out leaves its rows behind, and those rows then break unrelated
  // suites on the next run — so this must comfortably exceed the slowest
  // observed database round trip. Suites that issue many sequential queries
  // raise their own ceiling further; see the note there.
  testTimeout: 120_000,

  // The integration suites share one database and insert/delete rows in the same
  // tables. Assertions such as "paging through the result set returns each row
  // exactly once", or "a 1km radius around this point contains zero places", are
  // only meaningful while no other suite is mutating the table mid-assertion.
  // Running the workers serially makes the database-backed tests deterministic;
  // it costs wall-clock time, not correctness.
  maxWorkers: 1,

  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/tests/**/*.test.{ts,tsx}'],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'features/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};

export default createJestConfig(config);
