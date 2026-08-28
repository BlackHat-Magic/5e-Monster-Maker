import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "$lib": new URL("./src/lib", import.meta.url).pathname,
    },
    conditions: ["browser"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/bun.setup.ts"],
    css: {
      include: /\.css\?inline$/,
    },
    include: ["tests/**/*.{test,spec}.ts", "tests/**/*.dom.ts"],
    exclude: ["tests/e2e/**"],
		server: {
			deps: {
				inline: ["svelte", "@hugeicons/svelte"],
			},
		},
    transformMode: {
      web: [/\.svelte$/],
    },
  },
});
