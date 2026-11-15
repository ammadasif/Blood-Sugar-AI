import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative assets resolution on GitHub Pages
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'charts': ['recharts'],
          'excel-export': ['xlsx'],
          'pdf-export': ['jspdf', 'jspdf-autotable'],
          'icons': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
});
