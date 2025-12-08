import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import versionIncrement from "./plugins/version-increment.js";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionIncrement()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/database"],
        },
      },
    },
  },
});
