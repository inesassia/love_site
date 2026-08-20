import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    // Run test files sequentially within a single thread. Several test files share one
    // real Postgres database and reuse literal fixture emails (e.g. alice@example.com);
    // running files in parallel worker threads let one file's resetDb()/inserts race
    // another's, causing intermittent FK violations and unique-constraint collisions.
    singleThread: true,
  },
})
