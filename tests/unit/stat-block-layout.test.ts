import { describe, expect, it } from "vitest";
import styles from "../../src/lib/components/preview/stat-block.css?inline";

describe("stat-block layout", () => {
  it("uses a shared one-column width and balanced responsive two-column flow", () => {
    expect(styles).toContain("width: min(100%, 400px)");
    expect(styles).toContain("width: min(100%, 800px)");
    expect(styles).toContain("column-count: 2");
    expect(styles).toContain("column-gap: 20px");
    expect(styles).toContain("column-fill: balance");
    expect(styles).toContain("break-inside: avoid");
    expect(styles).toContain("break-after: avoid");
    expect(styles).toContain("@media (max-width: 720px)");
    expect(styles).toContain("column-count: 1");
  });
});
