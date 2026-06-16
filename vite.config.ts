import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works at the project-pages URL
// (https://<user>.github.io/AdamVaultOS/) without configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
  // TEMPORARY (chasing a production-only startup crash): ship an unminified
  // bundle + sourcemaps so the ErrorBoundary's on-screen stack names the exact
  // file/function. Revert to the default minified build once it's resolved.
  build: { minify: false, sourcemap: true },
})
