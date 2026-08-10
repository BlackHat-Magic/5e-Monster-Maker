<script module lang="ts">
	let getAnimationsFallbackUsers = 0;
	let originalGetAnimationsDescriptor: PropertyDescriptor | undefined;

	function acquireGetAnimationsFallback(): () => void {
		if (typeof Element === 'undefined') return () => {};
		if (getAnimationsFallbackUsers === 0 && typeof Element.prototype.getAnimations === 'function') return () => {};
		if (getAnimationsFallbackUsers === 0) {
			originalGetAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
			Object.defineProperty(Element.prototype, 'getAnimations', {
				configurable: true,
				value: () => [],
				writable: true,
			});
		}
		getAnimationsFallbackUsers += 1;
		let released = false;
		return () => {
			if (released) return;
			released = true;
			getAnimationsFallbackUsers -= 1;
			if (getAnimationsFallbackUsers > 0) return;
			if (originalGetAnimationsDescriptor) Object.defineProperty(Element.prototype, 'getAnimations', originalGetAnimationsDescriptor);
			else Reflect.deleteProperty(Element.prototype, 'getAnimations');
			originalGetAnimationsDescriptor = undefined;
		};
	}
</script>

<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { onMount, tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { replacementEpoch } from '$lib/state/monster-store';
	import { appendRepeatableKey, createRepeatableKeyState, moveListItem, removeListItem, repeatableFocusTarget, repeatablePrimitiveKey, syncRepeatableKeys, updateListItem, type RepeatableKeyState } from './editor-core';

	type Props = {
		items: readonly T[];
		label: string;
		addLabel?: string;
		headingId?: string;
		headingTag?: 'h2' | 'h3';
		createItem: () => T;
		getItemName?: (item: T, index: number) => string;
		onItemsChange: (items: T[], keys?: readonly string[]) => void;
		children: Snippet<[T, number, (item: T) => void]>;
	};

	let { items, label, addLabel = 'Add item', headingId, headingTag = 'h3', createItem, getItemName, onItemsChange, children }: Props = $props();
	function createInitialKeyState(): RepeatableKeyState {
		return createRepeatableKeyState(items.length);
	}

	let keyState = $state(createInitialKeyState());
	let collapsedKeys = $state(new Set<string>());
	let pointerId = $state<number | null>(null);
	let pointerDragKey = $state<string | null>(null);
	let pointerDragName = $state<string | null>(null);
	let pointerOriginalKeys = $state<string[] | null>(null);
	let pointerDisplayItems = $state<T[] | null>(null);
	let pointerDisplayKeys = $state<string[] | null>(null);
	let dropTargetIndex = $state<number | null>(null);
	let keyboardDragIndex = $state<number | null>(null);
	let keyboardOriginalItems = $state<T[] | null>(null);
	let keyboardOriginalKeys = $state<string[] | null>(null);
	let keyboardDragName = $state<string | null>(null);
	let dragStatus = $state('');
	let reducedMotion = $state(true);
	let sectionElement: HTMLElement | null = null;
	let pointerCaptureHandle: HTMLElement | null = null;
	let expectedItemSignature = '';
	let pendingLocalSignature: string | null = null;
	let lastReplacementEpoch: number | undefined;
	let displayItems = $derived(pointerDisplayItems ?? items);
	let displayKeys = $derived(pointerDisplayKeys ?? keyState.keys);

	function ensureItemKeys(): void {
		syncRepeatableKeys(keyState, items.length);
	}

	function itemSignature(value: readonly T[]): string {
		return JSON.stringify(value) ?? '';
	}

	function pruneCollapsedKeys(): void {
		const keys = new Set(keyState.keys);
		const next = new Set([...collapsedKeys].filter((key) => keys.has(key)));
		if (next.size !== collapsedKeys.size) collapsedKeys = next;
	}

	function resetKeyboardDrag(): void {
		keyboardDragIndex = null;
		keyboardOriginalItems = null;
		keyboardOriginalKeys = null;
		keyboardDragName = null;
	}

	function resetPointerDrag(clearDisplay = true): void {
		const capturedHandle = pointerCaptureHandle;
		const capturedPointerId = pointerId;
		pointerId = null;
		pointerCaptureHandle = null;
		pointerDragKey = null;
		pointerDragName = null;
		pointerOriginalKeys = null;
		dropTargetIndex = null;
		if (clearDisplay) {
			pointerDisplayItems = null;
			pointerDisplayKeys = null;
		}
		releasePointerCapture(capturedHandle, capturedPointerId);
	}

	function resetDragState(): void {
		resetPointerDrag();
		resetKeyboardDrag();
	}

	$effect.pre(() => {
		const epoch = $replacementEpoch;
		const currentSignature = itemSignature(items);
		const replaced = lastReplacementEpoch !== undefined && lastReplacementEpoch !== epoch;
		if (replaced) {
			keyState = createInitialKeyState();
			collapsedKeys = new Set();
			resetDragState();
			dragStatus = '';
			expectedItemSignature = currentSignature;
			pendingLocalSignature = null;
		} else {
			ensureItemKeys();
			pruneCollapsedKeys();
			const pointerActive = pointerDragKey !== null;
			const localDisplayPending = pointerDisplayItems !== null;
			const dragActive = pointerActive || keyboardDragIndex !== null;
			if ((dragActive || localDisplayPending) && currentSignature !== expectedItemSignature && currentSignature !== pendingLocalSignature) {
				resetDragState();
				dragStatus = '';
				expectedItemSignature = currentSignature;
				pendingLocalSignature = null;
			}
			if (currentSignature === expectedItemSignature) {
				pendingLocalSignature = null;
				if (!pointerActive && pointerDisplayItems !== null) {
					pointerDisplayItems = null;
					pointerDisplayKeys = null;
				}
			} else if (!dragActive && pointerDisplayItems === null) {
				expectedItemSignature = currentSignature;
				pendingLocalSignature = null;
			}
		}
		lastReplacementEpoch = epoch;
	});

	function itemKey(_item: T, index: number): string {
		return displayKeys[index] ?? repeatablePrimitiveKey(index);
	}

	function itemName(item: T, index: number): string {
		return getItemName?.(item, index)?.trim() || `${label} ${index + 1}`;
	}

	function addItem(): void {
		resetPointerDrag();
		resetKeyboardDrag();
		ensureItemKeys();
		appendRepeatableKey(keyState);
		commitItems([...displayItems, createItem()]);
	}

	function updateItem(index: number, item: T): void {
		ensureItemKeys();
		const nextItems = updateListItem(displayItems, index, item);
		if (pointerDragKey !== null) {
			pointerDisplayItems = nextItems;
			return;
		}
		commitItems(nextItems);
	}

	async function removeItem(index: number): Promise<void> {
		resetPointerDrag();
		resetKeyboardDrag();
		ensureItemKeys();
		const nextItems = removeListItem(displayItems, index);
		keyState.keys = removeListItem(displayKeys, index);
		pruneCollapsedKeys();
		commitItems(nextItems);
		await tick();
		const focusTarget = repeatableFocusTarget(index, nextItems.length);
		const heading = directChild('repeatable__heading');
		const itemsContainer = directChild('repeatable__items');
		const element = focusTarget.kind === 'add'
			? heading?.querySelector<HTMLElement>('[data-repeatable-add]')
			: itemsContainer?.children[focusTarget.index] as HTMLElement | undefined;
		if (element && typeof element.focus === 'function') element.focus();
	}

	function isOwnListEvent(event: Event): boolean {
		const target = event.target;
		const currentTarget = event.currentTarget;
		return target instanceof Element
			&& currentTarget instanceof HTMLElement
			&& target.closest('.repeatable') === sectionElement
			&& currentTarget.closest('.repeatable') === sectionElement;
	}

	function reorderItem(from: number, to: number): void {
		ensureItemKeys();
		keyState.keys = moveListItem(displayKeys, from, to);
		commitItems(moveListItem(displayItems, from, to));
	}

	function commitItems(nextItems: T[]): void {
		expectedItemSignature = itemSignature(nextItems);
		pendingLocalSignature = expectedItemSignature;
		onItemsChange(nextItems, [...keyState.keys]);
	}

	function toggleCollapsed(key: string): void {
		const next = new Set(collapsedKeys);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		collapsedKeys = next;
	}

	function releasePointerCapture(element: HTMLElement | null, id: number | null): void {
		if (!element || id === null) return;
		try {
			if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
		} catch {
			// Synthetic pointer events and already-lost captures are safe to ignore.
		}
	}

	function startPointerDrag(key: string, event: PointerEvent): void {
		if (keyboardDragIndex !== null || pointerDragKey !== null || !isOwnListEvent(event)) return;
		if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
		const index = displayKeys.indexOf(key);
		if (index < 0) return;

		event.preventDefault();
		ensureItemKeys();
		pointerId = event.pointerId;
		pointerDragKey = key;
		pointerDragName = itemName(displayItems[index], index);
		pointerOriginalKeys = [...displayKeys];
		pointerDisplayItems = [...displayItems];
		pointerDisplayKeys = [...displayKeys];
		dropTargetIndex = null;
		dragStatus = `Dragging ${pointerDragName}.`;
		const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
		if (!handle) {
			resetPointerDrag();
			return;
		}
		pointerCaptureHandle = handle;
		try {
			handle.setPointerCapture(event.pointerId);
		} catch {
			// Browsers can reject capture for synthetic or already-ended pointers.
		}
	}

	function pointerMove(event: PointerEvent): void {
		if (pointerDragKey === null || event.pointerId !== pointerId) return;
		event.preventDefault();
		const itemsContainer = directChild('repeatable__items');
		const rows = Array.from(itemsContainer?.children ?? []).filter((element): element is HTMLElement =>
			element instanceof HTMLElement && element.matches('[data-repeatable-row]')
		);
		if (rows.length === 0) return;

		const containerTop = itemsContainer?.getBoundingClientRect().top ?? 0;
		const targetIndex = rows.findIndex((row) => {
			return event.clientY <= containerTop + row.offsetTop + row.offsetHeight / 2;
		});
		const nextIndex = targetIndex < 0 ? rows.length - 1 : targetIndex;
		const from = displayKeys.indexOf(pointerDragKey);
		if (from < 0) return;
		dropTargetIndex = nextIndex;
		if (from === nextIndex) return;

		pointerDisplayItems = moveListItem(displayItems, from, nextIndex);
		pointerDisplayKeys = moveListItem(displayKeys, from, nextIndex);
		dragStatus = `${pointerDragName} is at position ${nextIndex + 1}.`;
		void tick().then(() => {
			if (pointerDragKey !== null && pointerId === event.pointerId && pointerCaptureHandle) {
				try {
					pointerCaptureHandle.setPointerCapture(event.pointerId);
				} catch {
					cancelPointerDrag();
				}
			}
		});
	}

	function cancelPointerDrag(): void {
		if (pointerDragKey === null) return;
		resetPointerDrag();
		if (keyboardDragIndex === null) dragStatus = '';
	}

	function finishPointerDrag(event: PointerEvent): void {
		if (pointerDragKey === null || event.pointerId !== pointerId) return;
		event.preventDefault();
		const name = pointerDragName ?? '';
		const finalItems = pointerDisplayItems;
		const finalKeys = pointerDisplayKeys;
		const originalKeys = pointerOriginalKeys;
		const finalIndex = finalKeys?.indexOf(pointerDragKey) ?? -1;
		const changed = Boolean(finalKeys && originalKeys && finalKeys.some((key, index) => key !== originalKeys[index]));
		if (changed && finalItems && finalKeys && finalIndex >= 0) {
			keyState.keys = [...finalKeys];
			commitItems([...finalItems]);
			resetPointerDrag(false);
			dragStatus = `${name} moved to position ${finalIndex + 1}.`;
		} else {
			resetPointerDrag();
			if (keyboardDragIndex === null) dragStatus = '';
		}
	}

	function handlePointerCancel(event: PointerEvent): void {
		if (pointerDragKey === null || event.pointerId !== pointerId) return;
		cancelPointerDrag();
	}

	function handleLostPointerCapture(event: PointerEvent): void {
		if (pointerDragKey === null || event.pointerId !== pointerId) return;
		void tick().then(() => {
			if (pointerDragKey === null || event.pointerId !== pointerId) return;
			if (!pointerCaptureHandle?.hasPointerCapture(event.pointerId)) cancelPointerDrag();
		});
	}

	function handleForKey(key: string): HTMLElement | undefined {
		return Array.from(sectionElement?.querySelectorAll<HTMLElement>('[data-repeatable-drag-handle]') ?? [])
			.find((element) => element.dataset.repeatableKey === key && element.closest('.repeatable') === sectionElement);
	}

	async function focusHandle(key: string): Promise<void> {
		await tick();
		handleForKey(key)?.focus();
	}

	async function moveKeyboardItem(direction: -1 | 1): Promise<void> {
		if (keyboardDragIndex === null) return;
		const nextIndex = keyboardDragIndex + direction;
		if (nextIndex < 0 || nextIndex >= items.length) return;
		const from = keyboardDragIndex;
		const key = keyState.keys[from];
		const name = keyboardDragName ?? itemName(items[from], from);
		reorderItem(from, nextIndex);
		keyboardDragIndex = nextIndex;
		dragStatus = `${name} is at position ${nextIndex + 1}. Press Space to drop or Escape to cancel.`;
		await focusHandle(key);
	}

	async function handleKeydown(index: number, event: KeyboardEvent): Promise<void> {
		if (pointerDragKey !== null) {
			if (event.key === 'Escape') {
				event.preventDefault();
				cancelPointerDrag();
			} else if (event.key === ' ' || event.key === 'Spacebar') {
				event.preventDefault();
			}
			return;
		}
		if (event.key === ' ' || event.key === 'Spacebar') {
			event.preventDefault();
			if (keyboardDragIndex === null) {
				ensureItemKeys();
				const name = itemName(items[index], index);
				keyboardOriginalItems = [...items];
				keyboardOriginalKeys = [...keyState.keys];
				keyboardDragName = name;
				keyboardDragIndex = index;
				dragStatus = `Grabbed ${name}. Use ArrowUp or ArrowDown to move, Space to drop, or Escape to cancel.`;
			} else if (keyboardDragIndex === index) {
				const name = keyboardDragName ?? itemName(items[index], index);
				resetKeyboardDrag();
				dragStatus = `${name} dropped at position ${index + 1}.`;
			}
			return;
		}
		if (keyboardDragIndex !== index) return;
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault();
			await moveKeyboardItem(event.key === 'ArrowUp' ? -1 : 1);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			const originalItems = keyboardOriginalItems;
			const originalKeys = keyboardOriginalKeys;
			const grabbedKey = keyState.keys[index];
			const name = keyboardDragName ?? itemName(items[index], index);
			if (originalItems && originalKeys) {
				keyState.keys = [...originalKeys];
				commitItems([...originalItems]);
			}
			resetKeyboardDrag();
			dragStatus = `${name} movement cancelled.`;
			await focusHandle(grabbedKey ?? originalKeys?.[index] ?? '');
		}
	}

	function directChild(className: string): HTMLElement | undefined {
		const child = Array.from(sectionElement?.children ?? []).find((element) => element.classList.contains(className));
		return child instanceof HTMLElement ? child : undefined;
	}

	onMount(() => {
		const releaseGetAnimationsFallback = acquireGetAnimationsFallback();
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return releaseGetAnimationsFallback;
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const update = () => { reducedMotion = mediaQuery.matches; };
		update();
		mediaQuery.addEventListener?.('change', update);
		return () => {
			mediaQuery.removeEventListener?.('change', update);
			releaseGetAnimationsFallback();
		};
	});
</script>

	<svelte:document onpointermove={pointerMove} onpointerup={finishPointerDrag} onpointercancel={handlePointerCancel} onlostpointercapture={handleLostPointerCapture} />

	<section bind:this={sectionElement} class="repeatable" aria-label={label}>
	<div class="repeatable__heading">
		<div>
			<svelte:element this={headingTag} id={headingId} class="repeatable__title" aria-label={label}>
				{label}<span class="repeatable__count" aria-live="polite" aria-label={`${items.length} entries`}>{items.length}</span>
			</svelte:element>
		</div>
		<button class="editor-button editor-button--accent" type="button" onclick={addItem} aria-label={addLabel} data-repeatable-add>
			<span aria-hidden="true">+</span>{addLabel}
		</button>
	</div>

	{#if items.length === 0}
		<div class="repeatable__empty" role="status">No {label.toLowerCase()} yet. Add the first entry to begin.</div>
	{:else}
		<div class="repeatable__items">
			{#each displayItems as item, index (itemKey(item, index))}
				{@const name = itemName(item, index)}
				{@const key = itemKey(item, index)}
				<article
					class="repeatable__item"
					class:repeatable__item--dragging={pointerDragKey === key}
					tabindex="-1"
					data-repeatable-row={index}
					aria-label={`${name}, item ${index + 1} of ${displayItems.length}`}
					animate:flip={{ duration: reducedMotion ? 0 : 180 }}
				>
					{#if pointerDragKey !== null && dropTargetIndex === index}
						<div class="repeatable__insertion" data-repeatable-insertion aria-hidden="true"></div>
					{/if}
					<div class="repeatable__item-bar">
						<strong>{name}</strong>
						<div class="repeatable__controls">
							<button
								class="editor-icon-button repeatable__drag-handle"
								class:repeatable__drag-handle--dragging={pointerDragKey === key || keyboardDragIndex === index}
								type="button"
								data-repeatable-drag-handle
								data-repeatable-key={key}
								aria-label={`Drag ${name}`}
								aria-pressed={keyboardDragIndex === index}
								aria-grabbed={keyboardDragIndex === index}
								title="Drag to reorder"
								onpointerdown={(event) => startPointerDrag(key, event)}
								onkeydown={(event) => handleKeydown(index, event)}
							>
								<span aria-hidden="true">drag</span>
							</button>
							<button
								class="editor-icon-button repeatable__collapse"
								type="button"
								onclick={() => toggleCollapsed(key)}
								aria-label={`${collapsedKeys.has(key) ? 'Expand' : 'Collapse'} ${name}`}
								aria-expanded={!collapsedKeys.has(key)}
								data-repeatable-collapse
								title={collapsedKeys.has(key) ? 'Expand' : 'Collapse'}
							>
								<span aria-hidden="true">{collapsedKeys.has(key) ? '+' : '-'}</span>
							</button>
							<button class="editor-icon-button editor-icon-button--danger" type="button" onclick={() => removeItem(index)} aria-label={`Remove ${name}`} title="Remove">×</button>
						</div>
					</div>
					<div class="repeatable__body" hidden={collapsedKeys.has(key)}>
						{@render children(item, index, (next: T) => updateItem(index, next))}
					</div>
				</article>
			{/each}
		</div>
	{/if}
	<div class="repeatable__live-status" aria-live="polite" aria-atomic="true" data-repeatable-live-status>{dragStatus}</div>
</section>

<style>
	.repeatable { display: grid; gap: 14px; }
	.repeatable__heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 1px solid var(--border); padding-bottom: 13px; }
	.repeatable__title { display: flex; align-items: baseline; gap: 10px; margin: 0; font-family: var(--font-display); font-size: 1rem; letter-spacing: -0.02em; }
	.repeatable__title:is(h2) { color: var(--foreground); font-size: clamp(1.9rem, 3.8vw, 3.25rem); line-height: 0.96; letter-spacing: -0.08em; }
	.repeatable__title:is(h3) { color: var(--foreground); font-size: 1rem; line-height: normal; letter-spacing: -0.02em; }
	.repeatable__count { color: var(--accent); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; }
	.repeatable__empty { border: 1px dashed var(--border); padding: 18px; color: var(--muted-foreground); font-size: 0.8rem; }
	.repeatable__items { position: relative; display: grid; gap: 10px; min-width: 0; }
	.repeatable__item { position: relative; min-width: 0; border: 1px solid var(--border); background: color-mix(in srgb, var(--card) 78%, var(--bg)); }
	.repeatable__item--dragging { opacity: 0.72; }
	.repeatable__insertion { position: absolute; z-index: 1; top: -6px; right: 8px; left: 8px; height: 3px; border-radius: 99px; background: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 24%, transparent); pointer-events: none; }
	.repeatable__item-bar { display: flex; align-items: center; gap: 9px; min-height: 38px; border-bottom: 1px solid var(--border); padding: 0 8px; background: color-mix(in srgb, var(--muted) 55%, transparent); }
	.repeatable__item-bar strong { overflow: hidden; flex: 1; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-display); font-size: 0.72rem; }
	.repeatable__controls { display: flex; gap: 2px; }
	.repeatable__drag-handle { touch-action: none; cursor: grab; min-width: 42px; font-size: 0.58rem; letter-spacing: 0.05em; text-transform: uppercase; }
	.repeatable__drag-handle:active { cursor: grabbing; background: var(--accent); color: var(--accent-foreground); }
	.repeatable__drag-handle--dragging { cursor: grabbing; background: var(--foreground); color: var(--card); }
	.repeatable__collapse { font-size: 1rem; line-height: 1; }
	.repeatable__body { display: grid; gap: 13px; padding: 14px; }
	.repeatable__live-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
	@media (max-width: 560px) { .repeatable__heading { align-items: stretch; flex-direction: column; gap: 13px; } .repeatable__heading .editor-button { align-self: flex-start; } }
</style>
