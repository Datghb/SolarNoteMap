import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    exclude: ['vendor/**', 'node_modules/**', 'dist/**'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries into separate chunks
          'three': ['three', '@react-three/fiber', '@react-three/drei'],
          'pdf': ['pdfjs-dist'],
          'supabase': ['@supabase/supabase-js'],
          'openai': ['openai'],
          'xyflow': ['@xyflow/react'],
          'vendor': ['react', 'react-dom', 'tailwindcss', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
