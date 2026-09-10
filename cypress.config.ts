import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    supportFile: false,
    video: false,
    // `next dev` compiles each route on first request, which can outlast the
    // default 4s assertion timeout on a cold CI runner.
    defaultCommandTimeout: 10000,
    retries: { runMode: 2, openMode: 0 },
  },
});
