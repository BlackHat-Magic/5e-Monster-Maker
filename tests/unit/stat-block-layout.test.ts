import { describe, expect, it } from "vitest";
import styles from "../../src/lib/components/preview/stat-block.css?inline";

describe("stat-block layout", () => {
  it("uses a shared one-column width and balanced responsive two-column flow", () => {
    expect(styles).toMatch(/\.stat-block\s*\{\s*width:\s*min\(100%,\s*400px\);/);
    expect(styles).toMatch(/\.stat-block\.stat-block--two-column\s*\{\s*width:\s*min\(100%,\s*800px\);\s*\}/);
    expect(styles).toMatch(
      /\.stat-block--two-column\s+\.stat-block__body\s*\{\s*column-count:\s*2;\s*column-gap:\s*20px;\s*column-fill:\s*balance;\s*\}/,
    );
    expect(styles).toMatch(
      /\.stat-block--two-column\s+\.stat-block__challenge,\s*\.stat-block--two-column\s+\.preview-section__intro,\s*\.stat-block--two-column\s+\.preview-action\s*\{\s*break-inside:\s*avoid;\s*\}/,
    );
    expect(styles).toMatch(/\.stat-block--two-column\s+\.preview-section h3\s*\{\s*break-after:\s*avoid;\s*\}/);
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{\s*\.stat-block\.stat-block--two-column\s*\{\s*width:\s*min\(100%,\s*400px\);\s*\}\s*\.stat-block--two-column\s+\.stat-block__body\s*\{\s*column-count:\s*1;\s*\}\s*\}/,
    );
  });
});
