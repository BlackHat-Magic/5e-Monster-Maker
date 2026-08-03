<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import { appendRepeatableKey, createRepeatableKeyState, moveListItem, removeListItem, repeatableFocusTarget, repeatablePrimitiveKey, syncRepeatableKeys, updateListItem, type RepeatableKeyState } from './editor-core';

	type Props = {
		items: readonly T[];
		label: string;
		addLabel?: string;
		createItem: () => T;
		getItemName?: (item: T, index: number) => string;
		onItemsChange: (items: T[], keys?: readonly string[]) => void;
		children: Snippet<[T, number, (item: T) => void]>;
	};

	let { items, label, addLabel = 'Add item', createItem, getItemName, onItemsChange, children }: Props = $props();
	function createInitialKeyState(): RepeatableKeyState {
		return createRepeatableKeyState(items.length);
	}

	let keyState = $state(createInitialKeyState());
	let sectionElement: HTMLElement | null = null;

	function ensureItemKeys(): void {
		syncRepeatableKeys(keyState, items.length);
	}

	$effect.pre(() => {
		items.length;
		ensureItemKeys();
	});

	function itemKey(_item: T, index: number): string {
		return keyState.keys[index] ?? repeatablePrimitiveKey(index);
	}

	function itemName(item: T, index: number): string {
		return getItemName?.(item, index)?.trim() || `${label} ${index + 1}`;
	}

	function addItem(): void {
		ensureItemKeys();
		appendRepeatableKey(keyState);
		onItemsChange([...items, createItem()], [...keyState.keys]);
	}

	function updateItem(index: number, item: T): void {
		ensureItemKeys();
		onItemsChange(updateListItem(items, index, item), [...keyState.keys]);
	}

	async function removeItem(index: number): Promise<void> {
		ensureItemKeys();
		const nextItems = removeListItem(items, index);
		keyState.keys = removeListItem(keyState.keys, index);
		onItemsChange(nextItems, [...keyState.keys]);
		await tick();
		const focusTarget = repeatableFocusTarget(index, nextItems.length);
		const element = focusTarget.kind === 'add'
			? sectionElement?.querySelector<HTMLElement>('[data-repeatable-add]')
			: sectionElement?.querySelector<HTMLElement>(`[data-repeatable-row="${focusTarget.index}"]`);
		if (element && typeof element.focus === 'function') element.focus();
	}

	function moveItem(index: number, direction: -1 | 1): void {
		ensureItemKeys();
		keyState.keys = moveListItem(keyState.keys, index, index + direction);
		onItemsChange(moveListItem(items, index, index + direction), [...keyState.keys]);
	}
</script>

<section bind:this={sectionElement} class="repeatable" aria-label={label}>
	<div class="repeatable__heading">
		<div>
			<p class="section-label">Repeatable field</p>
			<h3>{label}<span class="repeatable__count">{items.length.toString().padStart(2, '0')}</span></h3>
		</div>
		<button class="editor-button editor-button--accent" type="button" onclick={addItem} aria-label={addLabel} data-repeatable-add>
			<span aria-hidden="true">+</span>{addLabel}
		</button>
	</div>

	{#if items.length === 0}
		<div class="repeatable__empty" role="status">No {label.toLowerCase()} yet. Add the first entry to begin.</div>
	{:else}
		<div class="repeatable__items">
			{#each items as item, index (itemKey(item, index))}
				{@const name = itemName(item, index)}
				<article class="repeatable__item" tabindex="-1" data-repeatable-row={index} aria-label={`${name}, item ${index + 1} of ${items.length}`}>
					<div class="repeatable__item-bar">
						<span class="repeatable__index">{String(index + 1).padStart(2, '0')}</span>
						<strong>{name}</strong>
						<div class="repeatable__controls">
							<button class="editor-icon-button" type="button" onclick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`Move ${name} up`} title="Move up">↑</button>
							<button class="editor-icon-button" type="button" onclick={() => moveItem(index, 1)} disabled={index === items.length - 1} aria-label={`Move ${name} down`} title="Move down">↓</button>
							<button class="editor-icon-button editor-icon-button--danger" type="button" onclick={() => removeItem(index)} aria-label={`Remove ${name}`} title="Remove">×</button>
						</div>
					</div>
					<div class="repeatable__body">
						{@render children(item, index, (next: T) => updateItem(index, next))}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.repeatable { display: grid; gap: 14px; }
	.repeatable__heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--border); padding-bottom: 11px; }
	.repeatable__heading h3 { display: flex; align-items: baseline; gap: 10px; margin: 3px 0 0; font-family: var(--font-display); font-size: 1rem; letter-spacing: -0.02em; }
	.repeatable__count { color: var(--accent); font-size: 0.7rem; letter-spacing: 0.08em; }
	.repeatable__empty { border: 1px dashed var(--border); padding: 18px; color: var(--muted-foreground); font-size: 0.8rem; }
	.repeatable__items { display: grid; gap: 10px; }
	.repeatable__item { border: 1px solid var(--border); background: color-mix(in srgb, var(--card) 78%, var(--bg)); }
	.repeatable__item-bar { display: flex; align-items: center; gap: 9px; min-height: 38px; border-bottom: 1px solid var(--border); padding: 0 8px; background: color-mix(in srgb, var(--muted) 55%, transparent); }
	.repeatable__item-bar strong { overflow: hidden; flex: 1; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-display); font-size: 0.72rem; }
	.repeatable__index { color: var(--accent); font-family: var(--font-display); font-size: 0.65rem; font-weight: 800; }
	.repeatable__controls { display: flex; gap: 2px; }
	.repeatable__body { display: grid; gap: 13px; padding: 14px; }
	.editor-button, .editor-icon-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--border); background: var(--card); color: var(--foreground); cursor: pointer; font-family: var(--font-display); font-size: 0.68rem; font-weight: 750; }
	.editor-button { min-height: 32px; padding: 0 10px; }
	.editor-button--accent { border-color: var(--accent); background: var(--accent); color: var(--card); }
	.editor-icon-button { width: 26px; height: 26px; padding: 0; }
	.editor-button:hover, .editor-icon-button:hover:not(:disabled) { border-color: var(--accent); background: var(--muted); color: var(--foreground); }
	.editor-button--accent:hover { background: var(--foreground); color: var(--card); }
	.editor-icon-button--danger:hover:not(:disabled) { border-color: #c2414d; color: #c2414d; }
	.editor-button:disabled, .editor-icon-button:disabled { cursor: not-allowed; opacity: 0.34; }
	@media (max-width: 560px) { .repeatable__heading { align-items: flex-start; flex-direction: column; } }
</style>
