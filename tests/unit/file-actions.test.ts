import { describe, expect, it } from "vitest";
import { createDefaultMonster } from "../../src/lib/monster/defaults";
import { formatTomlWarning, IMPORT_SIZE_LIMIT, isImportTooLarge, needsDraftConfirmation } from "../../src/lib/components/app-shell/file-actions";

describe("FileActions draft confirmation guard", () => {
  it("requires confirmation for both New and Reset when the draft is populated", () => {
    const draft = { ...createDefaultMonster(), name: "Populated draft" };

    expect(needsDraftConfirmation(draft)).toBe(true);
  });

  it("allows a fresh default draft through immediately", () => {
    expect(needsDraftConfirmation(createDefaultMonster())).toBe(false);
  });

  it("rejects imports above the 5 MiB limit before reading them", () => {
    expect(isImportTooLarge(IMPORT_SIZE_LIMIT)).toBe(false);
    expect(isImportTooLarge(IMPORT_SIZE_LIMIT + 1)).toBe(true);
  });

  it("formats warning paths and messages for the import notice", () => {
    expect(formatTomlWarning({ path: "action[0].spells[1][0]", message: "Expected a non-negative safe integer; the value was replaced with 0." })).toBe(
      "action[0].spells[1][0]: Expected a non-negative safe integer; the value was replaced with 0.",
    );
  });
});
