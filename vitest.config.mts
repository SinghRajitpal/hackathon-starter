import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["features/**/*.test.ts"],
    environment: "node",
    // Live Supabase tests read the same .env.local as the app and skip when it is absent.
    env: loadEnv("test", process.cwd(), ""),
  },
});
