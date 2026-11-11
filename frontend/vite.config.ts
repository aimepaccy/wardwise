/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Unit tests run in Kigali time on every machine, so tests about local dates (weeks) mean the same everywhere.
// Set here, before the test workers start, so they inherit it.
if (process.env.VITEST) process.env.TZ = 'Africa/Kigali'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // Unit tests run in Node; fake-indexeddb stands in for the browser's database.
  test: {
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
  },
})
