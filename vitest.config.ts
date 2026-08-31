import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 10000,
    fileParallelism: false,
    sequence: { concurrent: false },
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
