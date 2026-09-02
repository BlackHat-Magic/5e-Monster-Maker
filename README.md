<div align="center">

# 5e Monster Maker

D&D 5e/5.5e Monster Stat Block Maker Using a [TOML format](https://github.com/BlackHat-Magic/Obsidian-Stat-Blocks) for Portable Monster Files, Loosely Inspired by [Tetra-Cube's Stat Block Generator](https://tetra-cube.com/dnd/dnd-statblock.html) and [GiffyGlyph's Monster Maker](https://www.giffyglyph.com/monstermaker/app/)

</div>


## Overview

D&D 5e/5.5e Monster Stat Block Maker Using a [TOML format](https://github.com/BlackHat-Magic/Obsidian-Stat-Blocks) for Portable Monster Files, Loosely Inspired by [Tetra-Cube's Stat Block Generator](https://tetra-cube.com/dnd/dnd-statblock.html) and [GiffyGlyph's Monster Maker](https://www.giffyglyph.com/monstermaker/app/)

### Current Features

- Edit identity, basics, statistics, proficiencies, languages, traits, actions, bonus actions, reactions, and the individual Legendary, Villain, and Mythic sections.
- Configure Legendary, Villain, and Mythic independently with each section's classification checkbox, introduction, and action list.
- Work preview-first in a single-column layout with the live stat block preview above the editor at every viewport size.
- Show Max Dex only when Add Dexterity modifier is enabled, while preserving its value when the control is hidden and restored.
- Import and export the app's portable monster TOML format plus visual PNG, WebP, AVIF, SVG, and HTML formats.
- Keep the preview theme separate from the site theme; site theme changes synchronize the preview, with the CSS-only Monster Manual smooth theme and a textured theme also available.
- Choose an export-dialog theme independently; it defaults to the current preview theme. WebP and AVIF controls are disabled when the browser cannot encode them.
- Export offline-ready HTML and SVG with embedded CSS; textured Monster Manual exports also embed texture data, and visual files are cropped to the stat-block boundaries.
- Render Markdown descriptions and monster tokens in the stat block preview.
- Keep a local browser draft and theme preference without a server.

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

The Basics editor can persist an explicit two-panel stat block with the top-level TOML flag:

```toml
two_column = true
```

When enabled, the stat block uses an approximately 800px-wide grid with two explicit vertical panels. The left panel contains the header, core statistics, ability scores, additional fields, challenge row, and the first complete trait/action sections; the remaining complete sections continue in the right panel. The section boundary is estimated deterministically from preview content and returns to one panel column on narrow screens.

Visual exports are available in PNG, WebP, AVIF, SVG, and standalone HTML in addition to TOML. The preview theme is independent from the site theme, although changing the site theme synchronizes the preview. The Monster Manual smooth theme is CSS-only, while the textured theme embeds texture data. The export dialog theme is independent and defaults to the current preview theme. WebP and AVIF controls are disabled when browser encoding is unavailable. HTML and SVG embed their CSS for offline use, and textured Monster Manual HTML/SVG exports also embed texture data. Visual files are cropped to the stat-block boundaries.

## Testing

- `bun run test` runs Vitest unit tests and Svelte component tests in the configured browser-like environment.
- `bun run test:e2e` runs the Playwright browser flows, including real browser PNG, WebP/AVIF availability, SVG, and standalone HTML downloads with offline-content and crop checks. Install Chromium first with `bunx playwright install chromium`.
- `bun run check` runs SvelteKit synchronization, TypeScript checking, and Svelte diagnostics.
- `bun run build` verifies that the Cloudflare adapter output can be generated.

This project is licensed under the [GNU Affero General Public License v3](LICENSE.md).
