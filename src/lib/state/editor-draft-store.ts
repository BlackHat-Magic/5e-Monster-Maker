import { get, writable, type Readable } from 'svelte/store';

const pendingDrafts = new Set<string>();
const pendingState = writable(false);

function keyFor(owner: string, field: string): string {
	return `${owner}:${field}`;
}

function syncPendingState(): void {
	pendingState.set(pendingDrafts.size > 0);
}

export const hasPendingEditorDrafts: Readable<boolean> = { subscribe: pendingState.subscribe };

export function markEditorDraft(owner: string, field: string): void {
	pendingDrafts.add(keyFor(owner, field));
	syncPendingState();
}

export function clearEditorDraft(owner: string, field: string): void {
	pendingDrafts.delete(keyFor(owner, field));
	syncPendingState();
}

export function clearEditorDrafts(owner: string): void {
	for (const key of pendingDrafts) {
		if (key.startsWith(`${owner}:`)) pendingDrafts.delete(key);
	}
	syncPendingState();
}

export function hasPendingEditorDraft(): boolean {
	return get(hasPendingEditorDrafts);
}
