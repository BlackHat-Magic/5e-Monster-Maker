import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html>");
const storageData = new Map<string, string>();
const storage: Storage = {
  get length() {
    return storageData.size;
  },
  clear: () => storageData.clear(),
  getItem: (key) => storageData.get(key) ?? null,
  key: (index) => [...storageData.keys()][index] ?? null,
  removeItem: (key) => storageData.delete(key),
  setItem: (key, value) => storageData.set(key, String(value)),
};
Object.defineProperty(dom.window, "localStorage", { configurable: true, value: storage });
Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window, writable: true });
Object.defineProperty(globalThis, "document", { configurable: true, value: dom.window.document, writable: true });
const browserWindow = dom.window as unknown as Record<string, unknown>;
const browserGlobals: Record<string, unknown> = {
  Element: browserWindow.Element,
  HTMLElement: browserWindow.HTMLElement,
  Node: browserWindow.Node,
  Text: browserWindow.Text,
  Comment: browserWindow.Comment,
  Document: browserWindow.Document,
  Event: browserWindow.Event,
  CustomEvent: browserWindow.CustomEvent,
  MouseEvent: browserWindow.MouseEvent,
  KeyboardEvent: browserWindow.KeyboardEvent,
  navigator: browserWindow.navigator,
};
for (const [name, value] of Object.entries(browserGlobals)) {
  Object.defineProperty(globalThis, name, { configurable: true, value });
}
