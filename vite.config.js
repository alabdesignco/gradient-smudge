import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    lib: {
      entry: 'src/main.js',
      name: 'GradientSmudge',
      formats: ['iife'],
      fileName: () => 'app.js',
    },
    rollupOptions: {
      output: {
        // inline assets (noise.png, gradient.jpg) as base64 so the
        // bundle is a single self-contained file
        inlineDynamicImports: true,
      },
    },
    assetsInlineLimit: Infinity,
  },
})
