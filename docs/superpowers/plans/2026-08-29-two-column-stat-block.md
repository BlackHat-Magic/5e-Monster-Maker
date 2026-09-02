# Two-Column Stat Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted `two_column` option in TOML and the Basics editor, with an explicit two-panel preview and visual exports.

**Architecture:** Store only the user’s layout preference as `Monster.two_column`; derive the panel boundary from deterministic preview-content weights without DOM measurement or persisted split data. In two-column mode, render an explicit grid whose left panel owns the complete stat-block prelude and first whole `PreviewSection` blocks while the right panel owns the remainder. Keep one-column direct children unchanged and use the same component path for live preview and visual exports.

**Tech Stack:** Svelte 5, TypeScript, CSS grid, TOML via `smol-toml`, Vitest, Playwright, Bun.

---

### Task 1: Add the persisted layout field

**Files:**
- Modify: `src/lib/monster/types.ts:119-145`
- Modify: `src/lib/monster/defaults.ts:14-44,309-347`
- Modify: `src/lib/monster/toml.ts:14-36,309-320,393-425`
- Test: `tests/unit/two-column.test.ts`

- [ ] **Step 1: Add the optional Monster field**

Add `two_column?: boolean` near the other top-level display flags in `Monster`:

```ts
export interface Monster {
  name?: string;
  shortened_name?: string;
  shortened_plural?: string;
  proper_noun?: boolean;
  two_column?: boolean;
```

- [ ] **Step 2: Add normalization and TOML validation tests**

Create `tests/unit/two-column.test.ts` with tests that establish the expected contract:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultMonster, normalizeMonster } from "../../src/lib/monster/defaults";
import { exportMonsterToml, importMonsterToml } from "../../src/lib/monster/toml";

describe("two-column layout persistence", () => {
  it("defaults missing or invalid values to one column", () => {
    expect(createDefaultMonster().two_column).toBe(false);
    expect(normalizeMonster({ two_column: "yes" }).two_column).toBe(false);
  });

  it("round-trips an enabled two-column layout through TOML", () => {
    const source = exportMonsterToml(normalizeMonster({ name: "Wide Monster", two_column: true }));
    expect(source).toContain("two_column = true");

    const result = importMonsterToml(source);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toEqual([]);
      expect(result.monster.two_column).toBe(true);
    }
  });

  it("warns and falls back when two_column is not boolean", () => {
    const result = importMonsterToml("two_column = \"true\"\n");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.monster.two_column).toBe(false);
      expect(result.warnings).toContainEqual({
        path: "two_column",
        message: "Expected a boolean; the value was replaced with the default.",
      });
    }
  });
});
```

- [ ] **Step 3: Run the new tests and verify they fail**

Run: `bun run test -- tests/unit/two-column.test.ts`

Expected: FAIL because the Monster type, normalizer, and TOML projection do not yet include `two_column`.

- [ ] **Step 4: Normalize and validate the field**

Make these exact data-flow changes:

1. Add `"two_column"` to `TOP_LEVEL_KEYS`.
2. Add `two_column: false` to `createDefaultMonster()`.
3. Add `two_column: booleanValue(ownValue(source, "two_column"), defaults.two_column ?? false)` to `normalizeMonster()`.
4. Add `"two_column"` to the top-level boolean validation list in `collectInvalidWarnings()`.
5. Define `TOP_LEVEL_SCALAR_KEYS` containing the existing ten scalar keys plus `"two_column"`, and use it instead of `TOP_LEVEL_KEYS.slice(0, 10)` in `exportProjection()`.

The scalar key list must be:

```ts
const TOP_LEVEL_SCALAR_KEYS = [
  "name",
  "shortened_name",
  "shortened_plural",
  "proper_noun",
  "is_legendary",
  "legendary_description",
  "is_villain",
  "villain_description",
  "is_mythic",
  "mythic_description",
  "two_column",
] as const;
```

- [ ] **Step 5: Run the new tests and verify they pass**

Run: `bun run test -- tests/unit/two-column.test.ts`

Expected: 3 tests pass.

- [ ] **Step 6: Commit the persistence contract**

```bash
git add src/lib/monster/types.ts src/lib/monster/defaults.ts src/lib/monster/toml.ts tests/unit/two-column.test.ts
git commit -m "feat: persist two-column stat block preference"
```

### Task 2: Add the Basics editor control

**Files:**
- Modify: `src/lib/components/editor/BasicsEditor.svelte:15-24,54-59`
- Test: `tests/components/basics-editor.test.ts`

- [ ] **Step 1: Add the checkbox test**

Create a jsdom component test that mounts `BasicsEditor`, verifies the default, changes the checkbox, and verifies the store:

```ts
// @vitest-environment jsdom
import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import BasicsEditor from "../../src/lib/components/editor/BasicsEditor.svelte";
import { get } from "svelte/store";
import { monster, resetMonster } from "../../src/lib/state/monster-store";

let mounted: ReturnType<typeof mount> | undefined;

beforeEach(() => resetMonster());
afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.replaceChildren();
});

describe("BasicsEditor layout control", () => {
  it("updates the persisted two-column preference", () => {
    mounted = mount(BasicsEditor, { target: document.body });
    flushSync();

    const toggle = document.querySelector<HTMLInputElement>("#monster-two-column");
    expect(toggle?.checked).toBe(false);

    toggle?.click();
    flushSync();

    expect(toggle?.checked).toBe(true);
    expect(get(monster).two_column).toBe(true);
  });
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run: `bun run test -- tests/components/basics-editor.test.ts`

Expected: FAIL because the checkbox does not exist.

- [ ] **Step 3: Add the Basics checkbox**

Add a top-level update helper:

```ts
function updateTwoColumn(event: Event): void {
  monster.update((current) => ({
    ...current,
    two_column: (event.currentTarget as HTMLInputElement).checked,
  }));
}
```

Render it between the Basics grid and flavor field using the existing editor check-card pattern:

```svelte
<div class="editor-check-card editor-check-card--inline">
  <label class="editor-check" for="monster-two-column">
    <input id="monster-two-column" type="checkbox" checked={$monster.two_column ?? false} onchange={updateTwoColumn} />
    <span>Two-column stat block</span>
  </label>
</div>
```

Use help text in the surrounding Basics section only if the established component pattern requires it; do not add a second layout control elsewhere in the UI.

- [ ] **Step 4: Run the component test and verify it passes**

Run: `bun run test -- tests/components/basics-editor.test.ts`

Expected: 1 test passes.

- [ ] **Step 5: Commit the UI control**

```bash
git add src/lib/components/editor/BasicsEditor.svelte tests/components/basics-editor.test.ts
git commit -m "feat: add two-column basics control"
```

### Task 3: Thread layout state and explicit panels through preview and export

**Files:**
- Modify: `src/lib/components/preview/StatBlock.svelte`
- Modify: `src/lib/monster/preview.ts`
- Modify: `src/lib/components/preview/StatBlockPreview.svelte:22-59`
- Modify: `src/lib/monster/export-renderer.ts:518-525`
- Test: `tests/components/preview.dom.ts`

- [ ] **Step 1: Add the explicit panel regression test**

Extend the direct stat-block DOM test to mount with `twoColumn: true` and assert:

```ts
expect(article?.classList.contains("stat-block--two-column")).toBe(true);
expect(article?.querySelectorAll(":scope > .stat-block__panels > .stat-block__panel")).toHaveLength(2);
```

- [ ] **Step 2: Run the preview test and verify it fails**

Run: `bun run test -- tests/components/preview.dom.ts`

Expected: FAIL because the explicit panel markup and section split are not implemented.

- [ ] **Step 3: Add the optional StatBlock prop and explicit panel markup**

Add `twoColumn?: boolean` to `StatBlock` props and default it to `false`. Add the class directive:

```svelte
let { preview, theme, idPrefix, twoColumn = false }: Props = $props();

<article class="stat-block" class:stat-block--two-column={twoColumn} ...>
```

In two-column mode, render the header, core statistics, ability table, lower fields, challenge row, and first complete `PreviewSection` blocks in the left panel. Render remaining complete sections in the right panel. Add a pure helper in `src/lib/monster/preview.ts` that estimates section weight from markdown text and returns `{ left, right }` arrays. It must not read the DOM or return a persisted split index. Keep the existing direct-child sequence for one-column mode.

```svelte
<div class="stat-block__panels">
  <div class="stat-block__panel stat-block__panel--left">
    <!-- complete prelude, lower fields, challenge, and first sections -->
  </div>
  <div class="stat-block__panel stat-block__panel--right">
    <!-- remaining complete sections -->
  </div>
</div>
```

- [ ] **Step 4: Pass the preference from live preview and visual exports**

In `StatBlockPreview.svelte`, pass `twoColumn={currentMonster.two_column ?? false}` to `StatBlock`.

In `export-renderer.ts`, pass `twoColumn: monster.two_column ?? false` to the offscreen `StatBlock` mount.

- [ ] **Step 5: Run the preview and renderer tests**

Run: `bun run test -- tests/components/preview.dom.ts tests/unit/export-renderer.test.ts`

Expected: all tests pass, including the new class assertion.

- [ ] **Step 6: Commit the state plumbing**

```bash
git add src/lib/components/preview/StatBlock.svelte src/lib/components/preview/StatBlockPreview.svelte src/lib/monster/export-renderer.ts tests/components/preview.dom.ts
git commit -m "feat: thread two-column layout through previews"
```

### Task 4: Implement explicit responsive panel grid

**Files:**
- Modify: `src/lib/components/preview/stat-block.css:1-245`
- Test: `tests/unit/stat-block-layout.test.ts`

- [ ] **Step 1: Add CSS contract tests**

Create a small CSS contract test that imports `stat-block.css?inline` and verifies the layout primitives are present:

```ts
import { describe, expect, it } from "vitest";
import styles from "../../src/lib/components/preview/stat-block.css?inline";

describe("stat-block layout", () => {
  it("uses a shared width and explicit responsive two-panel grid", () => {
    expect(styles).toContain("width: min(100%, 400px)");
    expect(styles).toContain("width: min(100%, 800px)");
    expect(styles).toContain("display: grid");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr)");
  });
});
```

- [ ] **Step 2: Run the CSS test and verify it fails**

Run: `bun run test -- tests/unit/stat-block-layout.test.ts`

Expected: FAIL because the two-column rules do not yet exist.

- [ ] **Step 3: Add the explicit grid layout rules**

Keep the base `.stat-block` at `width: min(100%, 400px)`. Add the following rules after the existing theme-specific rules so they can override the 400px one-column width:

```css
.stat-block--two-column {
  width: min(100%, 800px);
}

.stat-block--two-column .stat-block__panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

@media (max-width: 720px) {
  .stat-block--two-column {
    width: min(100%, 400px);
  }

  .stat-block--two-column .stat-block__panels {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
}
```

Do not use JavaScript measurements or store pixel positions. The pure preview helper owns the section boundary, while CSS grid owns panel widths and responsive collapse.

- [ ] **Step 4: Run the CSS test and verify it passes**

Run: `bun run test -- tests/unit/stat-block-layout.test.ts`

Expected: 1 test passes.

- [ ] **Step 5: Commit the layout implementation**

```bash
git add src/lib/components/preview/stat-block.css tests/unit/stat-block-layout.test.ts
git commit -m "feat: render stat block panel grid"
```

### Task 5: Add browser coverage and verify the complete feature

**Files:**
- Modify: `tests/e2e/monster-maker.spec.ts`
- Inspect: `README.md`

- [ ] **Step 1: Add the live UI/browser regression test**

Add a test that checks the Basics control, enables it, verifies the live stat block modifier, explicit panel count, two-column grid, and narrow-screen collapse, exports TOML, and confirms the exported file contains `two_column = true`:

```ts
test("enables and exports an explicit two-panel stat block", async ({ page }) => {
  const basics = page.getByRole("tab", { name: "Basics", exact: true });
  await basics.click();

  const toggle = page.getByRole("checkbox", { name: "Two-column stat block", exact: true });
  await toggle.check();

  const statBlock = page.locator(".stat-block");
  await expect(statBlock).toHaveClass(/stat-block--two-column/);
  await expect(statBlock.locator(".stat-block__panels > .stat-block__panel")).toHaveCount(2);
  await expect.poll(() => statBlock.locator(".stat-block__panels").evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length)).toBe(2);

  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export stat block", exact: true });
  await dialog.getByRole("radio", { name: "TOML", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  const content = new TextDecoder().decode(await downloadBytes(download));
  expect(content).toContain("two_column = true");
});
```

Use the test file’s existing `downloadBytes` helper so the assertion stays independent of temporary file paths.

- [ ] **Step 2: Run focused browser coverage**

Run: `bunx playwright test tests/e2e/monster-maker.spec.ts -g "two-column"`

Expected: PASS. If the default port is occupied, run the existing Playwright suite against a temporary alternate-port config without changing the committed config.

- [ ] **Step 3: Update documentation**

Add the `two_column = true` TOML example and explain that the Basics option renders a deterministic section-based two-panel grid while reverting to one grid column on narrow screens.

- [ ] **Step 4: Run final verification**

Run:

```bash
bun run test -- tests/unit/two-column.test.ts tests/components/basics-editor.test.ts tests/components/preview.dom.ts tests/unit/stat-block-layout.test.ts tests/unit/stat-block-themes.test.ts tests/unit/export.test.ts tests/unit/export-renderer.test.ts
bun run check
bun run build
git diff --check
git status --short --untracked-files=all
```

Expected: all focused tests pass, check and build succeed, diff check is clean, and only intentionally committed changes remain.

- [ ] **Step 5: Commit documentation and browser coverage**

```bash
git add README.md tests/e2e/monster-maker.spec.ts
git commit -m "test: cover two-column stat block exports"
```
