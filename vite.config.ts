import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const fallbackNodeModules = 'd:/ALL/Cyber Wolf/a2z-academy/a2z academy v10/a2z academy v10/node_modules';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^firebase\/(.*)/, replacement: `${fallbackNodeModules}/firebase/$1` },
      { find: /^firebase$/, replacement: `${fallbackNodeModules}/firebase` },
      { find: /^@firebase\/(.*)/, replacement: `${fallbackNodeModules}/@firebase/$1` },
      { find: /^idb$/, replacement: `${fallbackNodeModules}/idb` },
    ],
  },
});
