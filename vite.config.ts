// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

if (process.argv.includes("build") && !process.argv.includes("development")) {
  process.env.NODE_ENV = "production";
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: process.env.LOVABLE_SANDBOX
    ? undefined
    : {
        preset: "node-server",
        output: {
          dir: "dist",
          serverDir: "dist/server",
          publicDir: "dist/public",
        },
      },
  vite: {
    oxc: {
      jsx: {
        runtime: "automatic",
        development: false,
      },
    },
    plugins: [
      {
        name: "strip-node-modules-use-client",
        enforce: "pre",
        transform(code, id) {
          if (id.includes("node_modules") && (code.includes('"use client"') || code.includes("'use client'"))) {
            return {
              code: code.replace(/^\s*["']use client["'];?\s*/gm, ""),
              map: null,
            };
          }
          return null;
        },
      },
    ],
    build: {
      rolldownOptions: {
        onwarn(warning, warn) {
          if (
            warning.code === "MODULE_LEVEL_DIRECTIVE" ||
            warning.message?.includes('"use client"')
          ) {
            return;
          }
          warn(warning);
        },
      },
      rollupOptions: {
        onwarn(warning, warn) {
          if (
            warning.code === "MODULE_LEVEL_DIRECTIVE" ||
            warning.message?.includes('"use client"')
          ) {
            return;
          }
          warn(warning);
        },
      },
    },
  },
});
