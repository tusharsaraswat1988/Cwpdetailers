import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "../../lib/address-model/src/**/*.test.ts"],
    testTimeout: 15000,
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/cwp",
    },
  },
});
