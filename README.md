<div align="center">

# 5e Monster Maker

D&D 5e/5.5e Monster Stat Block Maker Using a [TOML format](https://github.com/BlackHat-Magic/Obsidian-Stat-Blocks) for Portable Monster Files, Loosely Inspired by [Tetra-Cube's Stat Block Generator](https://tetra-cube.com/dnd/dnd-statblock.html) and [GiffyGlyph's Monster Maker](https://www.giffyglyph.com/monstermaker/app/)

</div>


## Overview

D&D 5e/5.5e Monster Stat Block Maker Using a [TOML format](https://github.com/BlackHat-Magic/Obsidian-Stat-Blocks) for Portable Monster Files, Loosely Inspired by [Tetra-Cube's Stat Block Generator](https://tetra-cube.com/dnd/dnd-statblock.html) and [GiffyGlyph's Monster Maker](https://www.giffyglyph.com/monstermaker/app/)

### Current Features

- Edit identity, feature, basics, statistics, proficiencies, languages, traits, actions, bonus actions, reactions, legendary actions, villain actions, and mythic actions.
- Import and export the app's portable monster TOML format.
- Render Markdown descriptions and monster tokens in the stat block preview.
- Keep a local browser draft and theme preference without a server.

### Software Stack

- TypeScript, Svelte 5, and SvelteKit
- Cloudflare-compatible output through `@sveltejs/adapter-cloudflare`
- Vitest, Testing Library, and Playwright for verification
- No database or backend service

## Local Development

Install [Bun](https://bun.sh/), then install the locked dependencies:

```sh
bun install --frozen-lockfile
```

Start the Vite development server:

```sh
bun run dev
```

Run type checking and Svelte diagnostics:

```sh
bun run check
```

Run the unit and component tests:

```sh
bun run test
```

Install the Chromium browser used by Playwright once per environment, then run end-to-end tests:

```sh
bunx playwright install chromium
bun run test:e2e
```

Build the Cloudflare adapter output and serve the regular Vite production preview:

```sh
bun run build
bun run preview
```

To exercise the built Cloudflare Worker locally instead, build first and start Wrangler:

```sh
bun run build
bunx wrangler dev
```

Wrangler reads `wrangler.jsonc`, serves the generated `.svelte-kit/cloudflare/_worker.js`, and exposes the generated assets locally.

The Worker configuration enables the `nodejs_compat` compatibility flag because the generated SvelteKit Worker references `node:async_hooks`. Do not add the older `nodejs_als` flag; it is not required by this build.

## Cloudflare Pages

Cloudflare Pages can deploy this repository through its Git integration. Create or select a Pages project, connect the repository, and use these build settings:

- Framework preset: SvelteKit
- Build command: `bun run build`
- Build output directory: `.svelte-kit/cloudflare`

The output directory is produced by `@sveltejs/adapter-cloudflare`; it is not `dist`. Pages deploys the result after the build, so no separate deploy command is needed. The Pages project and its production branch are selected in the Cloudflare dashboard.

The application itself requires no database, backend, or Cloudflare account. Drafts and theme settings are browser-local, so a Pages deployment does not provide shared storage, authentication, or server-side persistence. A Cloudflare account is only needed to create and deploy a Pages site or Worker.

## Cloudflare Worker Deployment

The checked-in `wrangler.jsonc` is the Worker deployment configuration. It points Wrangler at the adapter output and its assets:

- Worker entry: `.svelte-kit/cloudflare/_worker.js`
- Static asset directory: `.svelte-kit/cloudflare`
- Worker name: `5e-monster-maker`
- Compatibility flag: `nodejs_compat` for the generated `node:async_hooks` dependency

Before deploying, authenticate Wrangler and confirm the account it will use. Do not put API tokens or other credentials in this repository:

```sh
bunx wrangler login
bunx wrangler whoami
bun run build
bunx wrangler deploy
```

The Cloudflare account must have permission to create or update Workers. The `name` in `wrangler.jsonc` is the Worker/project name and must be changed if another name is required. If the login has access to multiple accounts, select the intended account in Wrangler or add the non-secret `account_id` to `wrangler.jsonc`; no account ID is required when Wrangler can infer the account unambiguously. A Cloudflare account and an appropriately named Worker are required for this deployment path, but no database or backend binding is required by this application.

## Portable Monster Files

TOML is the portable file format for moving a monster between browsers, machines, and deployments. Import and export cover the app's normalized monster schema:

- Identity and flags, including legendary, villain, and mythic descriptions
- Basics such as size, type, tag, alignment, and flavor
- Armor, hit dice, speed, ability scores, and other statistics
- Saves, skills, expertise, resistances, immunities, senses, and challenge
- Languages and all supported trait/action sections: abilities, actions, bonus actions, reactions, legendary actions, villain actions, and mythic actions

The importer accepts TOML tables matching that schema. Unknown keys are ignored with warnings, while invalid types, enum values, array shapes, or required action fields are replaced, dropped, or reported with warnings where possible. Malformed TOML, a non-table TOML root, an unreadable file, or an import larger than 5 MiB produces an error and leaves the current draft unchanged. This release does not claim import/export compatibility with Tetra-Cube, Improved Initiative, JSON, or GMBinder files.

## Local Persistence and Themes

The current monster draft is stored in browser `localStorage` under `monster-maker.draft`; theme mode and palette preferences are stored there as well. Nothing is uploaded, synchronized, or recoverable from another browser unless the user exports a TOML file. Clearing site data or using a different browser removes access to the local draft.

Available palettes include Catppuccin, Nord, Strawberry, Gruvbox, and Rose Pine in light and dark variants, plus Dracula in dark mode. Light/dark mode can follow the system preference initially and can then be changed in the app.

## Architecture

The application is a client-rendered, prerendered SvelteKit app. Svelte components provide the editor shell, section editors, and stat block preview. The monster and theme stores own browser-local state. Focused TypeScript modules normalize monster data, calculate derived statistics, render sanitized Markdown, and serialize/validate the portable TOML projection. The Cloudflare adapter packages the static output and Worker entry used by both Pages and Wrangler.

## Testing

- `bun run test` runs Vitest unit tests and Svelte component tests in the configured browser-like environment.
- `bun run test:e2e` runs the Playwright browser flows. Install Chromium first with `bunx playwright install chromium`.
- `bun run check` runs SvelteKit synchronization, TypeScript checking, and Svelte diagnostics.
- `bun run build` verifies that the Cloudflare adapter output can be generated.

This project is licensed under the [GNU Affero General Public License v3](LICENSE.md).
