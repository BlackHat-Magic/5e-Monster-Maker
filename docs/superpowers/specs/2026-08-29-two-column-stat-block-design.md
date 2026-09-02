# Two-Column Stat Block

## Goal

Allow monsters to opt into a wide two-panel stat block from the Basics editor and persist that choice in TOML.

## Data And Persistence

Add an optional `two_column` boolean to `Monster`. Normalization defaults missing or invalid values to `false`. TOML import accepts the top-level key and warns when it is not boolean; TOML export writes the normalized boolean alongside the other top-level scalar values. Existing local draft persistence will retain the field automatically.

## Preview And Export

The Basics checkbox updates the monster store. `StatBlockPreview` and the browser export renderer pass the normalized flag into `StatBlock`, which adds a two-column modifier class. One-column blocks remain capped at 400px; two-column blocks expand to 800px max and collapse to one grid column below the mobile breakpoint.

In two-column mode, `StatBlock` renders an explicit panel grid. The left panel contains the complete header, core statistics, ability score table, additional fields, challenge/proficiency row, and the first lower `PreviewSection` blocks. The right panel contains the remaining complete `PreviewSection` blocks. A pure content-weight estimator selects the closest section boundary without DOM measurement; when at least two sections exist, it always keeps one whole section on each side, so a dominant prelude may intentionally make the left panel taller rather than forcing equal heights. The persistence model stores only the boolean preference. One-column mode retains its existing direct-child structure, and normal app previews collapse the panel grid to one column at narrow widths.

Standalone HTML preserves the measured wrapper at desktop widths, but its narrow-viewport media rules override the inline wrapper width, height, and clipping so the document becomes responsive and collapses to one panel column. Standalone SVG remains fixed-size and uses the measured two-panel grid regardless of viewport size.

## Verification

Add tests for normalization, TOML round-tripping and invalid values, Basics checkbox updates, preview class application, and two-column CSS/export behavior. Run the focused tests, `bun run check`, the production build, and `git diff --check`.
