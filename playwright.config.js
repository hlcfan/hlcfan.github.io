import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:4000",
    // CI has no GPU. Force the software GL path so WebGL2 is always available.
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: {
    command: "bundle exec jekyll serve --no-watch --port 4000 --host 127.0.0.1",
    url: "http://127.0.0.1:4000/",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
