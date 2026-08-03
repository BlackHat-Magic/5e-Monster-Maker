import { get, writable, type Readable, type Writable } from "svelte/store";
import { createDefaultMonster, normalizeMonster } from "../monster/defaults";
import type { EditorSection, Monster } from "../monster/types";

export type Notice = { kind: "status" | "error"; message: string };

const STORAGE_KEY = "monster-maker.draft";

function hasBrowserStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function readStoredMonster(): Monster {
  if (!hasBrowserStorage()) return createDefaultMonster();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultMonster();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return createDefaultMonster();
    return normalizeMonster(parsed);
  } catch {
    return createDefaultMonster();
  }
}

const monsterState = writable(readStoredMonster());
const replacementEpochState = writable(0);
export const replacementEpoch: Readable<number> = { subscribe: replacementEpochState.subscribe };
let hydrating = false;

function setMonster(next: Monster): void {
  const replacement = normalizeMonster(next);
  monsterState.set(replacement);
  if (!hydrating) persistMonster(replacement);
}

export const monster: Writable<Monster> = {
  subscribe: monsterState.subscribe,
  set: setMonster,
  update: (updater) => setMonster(updater(normalizeMonster(get(monsterState)))),
};
export const selectedSection: Writable<EditorSection> = writable("identity");
export const notice: Writable<Notice | null> = writable(null);

export function persistMonster(value: Monster): void {
  if (!hasBrowserStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeMonster(value)));
  } catch {
    // Storage may be disabled or full; the in-memory draft remains usable.
  }
}

export function replaceMonster(next: Monster): void {
  monster.set(next);
  replacementEpochState.update((epoch) => epoch + 1);
}

export function resetMonster(): void {
  replaceMonster(createDefaultMonster());
}

export function restoreMonster(): void {
  const restored = readStoredMonster();
  hydrating = true;
  try {
    monster.set(restored);
    replacementEpochState.update((epoch) => epoch + 1);
  } finally {
    hydrating = false;
  }
}

export function currentMonster(): Monster {
  return normalizeMonster(get(monster));
}
