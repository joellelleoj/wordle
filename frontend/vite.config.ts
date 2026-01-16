// vite.config.ts - Windows-compatible configuration
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "public"),

  server: {
    port: 3000,
    host: "0.0.0.0", // Better than host: true
    strictPort: true,
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@services": path.resolve(__dirname, "src/services"),
      "@types": path.resolve(__dirname, "src/types"),
      "@styles": path.resolve(__dirname, "src/styles"),
      "@pages": path.resolve(__dirname, "src/pages"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "/src": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2020", // Match your tsconfig
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
  // Explicitly handle file system issues
  esbuild: {
    target: "es2020",
  },
});
