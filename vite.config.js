import { defineConfig } from 'vite';

// Project is served from https://<user>.github.io/hereweare3d/, so assets
// need to resolve under that subpath rather than the domain root.
export default defineConfig({
  base: '/hereweare3d/',
});
