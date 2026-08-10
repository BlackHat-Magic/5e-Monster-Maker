<script lang="ts">
	import { tick } from 'svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Add01Icon } from '@hugeicons/core-free-icons';
	import { insertTokenAtSelection, TOKEN_GROUPS, tokenPickerKeyAction, tokenText, type TokenOption } from './action-editor-core';

	type Props = {
		idPrefix: string;
		textarea: HTMLTextAreaElement | null;
		onInsert: (value: string) => void;
	};

	let { idPrefix, textarea, onInsert }: Props = $props();
	let open = $state(false);
	let activeIndex = $state(0);
	let triggerElement: HTMLButtonElement | null = null;
	let dialogElement = $state<HTMLDivElement | null>(null);
	let selectionStart = 0;
	let selectionEnd = 0;
	let options = $derived(TOKEN_GROUPS.flatMap((group) => group.options));
	let dialogId = $derived(`${idPrefix}-token-picker`);
	let headingId = $derived(`${idPrefix}-token-picker-heading`);
	let hintId = $derived(`${idPrefix}-token-picker-hint`);

	function groupId(groupId: string): string {
		return `${idPrefix}-token-group-${groupId}`;
	}

	function rememberSelection(): void {
		if (!textarea) return;
		selectionStart = textarea.selectionStart ?? textarea.value.length;
		selectionEnd = textarea.selectionEnd ?? selectionStart;
	}

	function openPicker(): void {
		rememberSelection();
		activeIndex = 0;
		open = true;
	}

	function closePicker(): void {
		open = false;
		void tick().then(() => triggerElement?.focus());
	}

	function choose(option: TokenOption): void {
		if (!textarea) return;
		const result = insertTokenAtSelection(textarea.value, selectionStart, selectionEnd, option.token);
		onInsert(result.value);
		open = false;
		void tick().then(() => {
			if (!textarea) return;
			textarea.focus();
			textarea.setSelectionRange(result.caret, result.caret);
		});
	}

	function handleKeydown(event: KeyboardEvent): void {
		const result = tokenPickerKeyAction(event.key, activeIndex, options.length);
		if (!result.handled) return;
		event.preventDefault();
		activeIndex = result.activeIndex;
		if (result.action === 'close') closePicker();
		if (result.action === 'choose') {
			const option = options[activeIndex];
			if (option) choose(option);
		}
	}

	$effect(() => {
		if (!open) return;
		void tick().then(() => {
			const option = dialogElement?.querySelector<HTMLElement>(`[data-token-index="${activeIndex}"]`);
			option?.focus();
		});
	});
</script>

<div class="token-picker">
	<button bind:this={triggerElement} class="token-picker__trigger" type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId} aria-label="Insert a monster token" onclick={openPicker} onmousedown={rememberSelection}>
		<HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} aria-hidden="true" />
		<span>Insert token</span>
	</button>

	{#if open}
		<div id={dialogId} bind:this={dialogElement} class="token-picker__dialog" role="dialog" aria-labelledby={headingId} aria-describedby={hintId} aria-modal="false" tabindex="-1" onkeydown={handleKeydown}>
			<div class="token-picker__heading">
				<div><h4 id={headingId}>Insert token</h4></div>
				<button class="token-picker__close" type="button" aria-label="Close token picker" onclick={closePicker}>×</button>
			</div>
			<p id={hintId} class="token-picker__hint">Arrow keys browse. Enter inserts at the description caret or replaces its selection.</p>
			<div class="token-picker__groups">
				{#each TOKEN_GROUPS as group, groupIndex}
					<section class="token-picker__group" aria-labelledby={groupId(group.id)}>
						<h5 id={groupId(group.id)}>{group.label}</h5>
						<div class="token-picker__options">
							{#each group.options as option, optionIndex}
								{@const flatIndex = TOKEN_GROUPS.slice(0, groupIndex).reduce((count, entry) => count + entry.options.length, 0) + optionIndex}
								<button class:active={activeIndex === flatIndex} class="token-picker__option" type="button" data-token-index={flatIndex} onclick={() => choose(option)} onmouseenter={() => (activeIndex = flatIndex)}>
									<span>{option.label}</span><code>{tokenText(option.token)}</code>
								</button>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.token-picker { position: relative; }
	.token-picker__trigger, .token-picker__close, .token-picker__option { border: 1px solid var(--border); background: var(--card); color: var(--foreground); cursor: pointer; }
	.token-picker__trigger { display: inline-flex; align-items: center; gap: 7px; min-height: 30px; padding: 0 9px; color: var(--accent); font-family: var(--font-display); font-size: 0.65rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
	.token-picker__trigger:hover, .token-picker__close:hover, .token-picker__option:hover, .token-picker__option.active { border-color: var(--accent); background: var(--muted); }
	.token-picker__dialog { position: absolute; z-index: 40; top: calc(100% + 7px); left: 0; width: min(590px, calc(100vw - 42px)); border: 1px solid var(--border); background: var(--card); padding: 13px; box-shadow: 10px 10px 0 color-mix(in srgb, var(--foreground) 10%, transparent); }
	.token-picker__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--border); padding-bottom: 9px; }
	.token-picker__heading h4 { margin: 3px 0 0; font-family: var(--font-display); font-size: 0.95rem; }
	.token-picker__close { width: 25px; height: 25px; padding: 0; font-size: 1.1rem; line-height: 1; }
	.token-picker__hint { margin: 10px 0; color: var(--muted-foreground); font-size: 0.72rem; }
	.token-picker__groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; max-height: min(430px, 60vh); overflow-y: auto; padding-right: 3px; }
	.token-picker__group { min-width: 0; }
	.token-picker__group h5 { margin: 0 0 6px; color: var(--muted-foreground); font-family: var(--font-display); font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; }
	.token-picker__options { display: grid; gap: 3px; }
	.token-picker__option { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 7px; align-items: center; width: 100%; padding: 6px 7px; text-align: left; font-size: 0.72rem; }
	.token-picker__option code { color: var(--accent); font-size: 0.65rem; white-space: nowrap; }
	@media (max-width: 560px) { .token-picker__dialog { position: fixed; top: 50%; left: 21px; width: calc(100vw - 42px); transform: translateY(-50%); } .token-picker__groups { grid-template-columns: 1fr; } }
</style>
