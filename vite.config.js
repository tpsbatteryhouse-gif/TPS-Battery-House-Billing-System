import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('jspdf') || id.includes('html2canvas')) {
            return 'pdf-vendor';
          }
          if (id.includes('firebase')) {
            return 'firebase-vendor';
          }
          if (id.includes('lucide-react')) {
            return 'icons-vendor';
          }
        },
      },
    },
  },
})
