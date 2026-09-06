import type { Component } from "svelte";

// Deferred resources: modules and assets that are not needed for first paint.
// They stay out of the initial bundle via dynamic import() and are warmed by
// prefetchDeferredResources() once the page is interactive, so first use
// (export, import, tab switch, textured theme) rarely waits on the network.
// Every loader caches its promise, so a user action racing the prefetch
// dedupes to a single fetch.

type TomlModule = typeof import("$lib/monster/toml");
type ExportRendererModule = typeof import("$lib/monster/export-renderer");

let tomlModulePromise: Promise<TomlModule> | null = null;
let exportRendererPromise: Promise<ExportRendererModule> | null = null;

export function loadTomlModule(): Promise<TomlModule> {
  return (tomlModulePromise ??= import("$lib/monster/toml"));
}

export function loadExportRendererModule(): Promise<ExportRendererModule> {
  return (exportRendererPromise ??= import("$lib/monster/export-renderer"));
}

export type LazyEditorModule = { default: Component<any> };

let statsEditorPromise: Promise<LazyEditorModule> | null = null;
let proficienciesEditorPromise: Promise<LazyEditorModule> | null = null;
let languagesEditorPromise: Promise<LazyEditorModule> | null = null;
let actionSectionEditorPromise: Promise<LazyEditorModule> | null = null;

export function loadStatsEditor(): Promise<LazyEditorModule> {
  return (statsEditorPromise ??= import("$lib/components/editor/StatsEditor.svelte"));
}

export function loadProficienciesEditor(): Promise<LazyEditorModule> {
  return (proficienciesEditorPromise ??= import("$lib/components/editor/ProficienciesEditor.svelte"));
}

export function loadLanguagesEditor(): Promise<LazyEditorModule> {
  return (languagesEditorPromise ??= import("$lib/components/editor/LanguagesEditor.svelte"));
}

export function loadActionSectionEditor(): Promise<LazyEditorModule> {
  return (actionSectionEditorPromise ??= import("$lib/components/editor/ActionSectionEditor.svelte"));
}

// Theme textures. The parchment ships AVIF-first with a JPEG fallback via
// image-set(), and the browser fetches only the format it decodes — but the
// prefetch cannot know which one that is, so both parchment URLs are warmed
// alongside the rule bar.
const TEXTURE_URLS = ["/statblockparch.avif", "/statblockparch.jpg", "/statblockbar.jpg"];

let prefetchStarted = false;

function warmResources(): void {
  void loadTomlModule().catch(() => {});
  void loadExportRendererModule().catch(() => {});
  void loadStatsEditor().catch(() => {});
  void loadProficienciesEditor().catch(() => {});
  void loadLanguagesEditor().catch(() => {});
  void loadActionSectionEditor().catch(() => {});
  if (typeof Image !== "undefined") {
    for (const url of TEXTURE_URLS) {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
    }
  }
}

// Idempotent and browser-guarded. Runs after first paint (idle or window
// load) so prefetching never competes with time-to-usable.
export function prefetchDeferredResources(): void {
  if (prefetchStarted || typeof window === "undefined") return;
  prefetchStarted = true;
  const schedule = (): void => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => warmResources(), { timeout: 2500 });
    } else {
      window.setTimeout(warmResources, 0);
    }
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
}
