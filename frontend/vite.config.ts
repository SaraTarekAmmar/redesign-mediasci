import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    allowedHosts: [
      "5173-i04qt2bh6yec0orfhrnya-6e12f491.sg1.manus.computer",
      "5174-i04qt2bh6yec0orfhrnya-6e12f491.sg1.manus.computer",
      "5174-i235xfmoitmtojuwoaent-66470ead.us4.manus.computer"
    ],
    proxy: {
      "/api": "http://127.0.0.1:8001",
      "/spa": "http://127.0.0.1:8001",
      "/locale": "http://127.0.0.1:8001",
      "/sanctum": "http://127.0.0.1:8001",
      "/storage": "http://127.0.0.1:8001",
      "/attachments": "http://127.0.0.1:8001"
    }
  }
});
