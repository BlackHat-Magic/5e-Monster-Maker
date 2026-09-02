import { describe, expect, it } from "vitest";
import styles from "../../src/lib/components/preview/stat-block.css?inline";

describe("stat-block layout", () => {
  it("uses a shared width and explicit responsive two-panel grid", () => {
    expect(styles).toMatch(/\.stat-block\s*\{\s*width:\s*min\(100%,\s*400px\);/);
    expect(styles).toMatch(/\.stat-block\.stat-block--two-column\s*\{\s*width:\s*min\(100%,\s*800px\);\s*\}/);
    expect(styles).toMatch(
      /\.stat-block--two-column\s+\.stat-block__panels\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\);\s*gap:\s*20px;\s*align-items:\s*start;\s*\}/,
    );
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{\s*\.stat-block\.stat-block--two-column\s*\{\s*width:\s*min\(100%,\s*400px\);\s*\}\s*\.stat-block--two-column\s+\.stat-block__panels\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);\s*gap:\s*0;\s*\}\s*\}/,
    );
    expect(styles).not.toContain("column-count");
    expect(styles).not.toContain("column-fill");
  });
});
