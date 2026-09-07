<script lang="ts">
	import { onMount, tick } from 'svelte';
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

	function pickerContains(target: EventTarget | null): boolean {
		if (!(target instanceof Node)) return false;
		return Boolean(triggerElement?.contains(target) || dialogElement?.contains(target));
	}

	onMount(() => {
		// Bespoke popover: close on outside pointer interaction or when focus
		// leaves the picker entirely (mirrors FieldHelp's dismissal contract).
		function closeOutside(event: PointerEvent): void {
			const target = event.target;
			if (!open || !(target instanceof Element) || pickerContains(target)) return;
			open = false;
			triggerElement?.focus();
		}
		function closeWhenFocusLeaves(event: FocusEvent): void {
			if (!open || pickerContains(event.relatedTarget)) return;
			open = false;
		}
		document.addEventListener('pointerdown', closeOutside, true);
		document.addEventListener('focusout', closeWhenFocusLeaves, true);
		return () => {
			document.removeEventListener('pointerdown', closeOutside, true);
			document.removeEventListener('focusout', closeWhenFocusLeaves, true);
		};
	});

	$effect(() => {
		if (!open) return;
		void tick().then(() => {
			const option = dialogElement?.querySelector<HTMLElement>(`[data-token-index="${activeIndex}"]`);
			option?.focus();
		});
	});
</script>

<div class="token-picker relative">
	<button bind:this={triggerElement} class="token-picker__trigger inline-flex min-h-[30px] cursor-pointer items-center gap-[7px] border border-border bg-card px-[9px] font-display text-[0.65rem] font-extrabold tracking-[0.04em] text-accent uppercase hover:border-accent hover:bg-muted" type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId} aria-label="Insert a monster token" onclick={openPicker} onmousedown={rememberSelection}>
		<HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} aria-hidden="true" />
		<span>Insert token</span>
	</button>

	{#if open}
		<div id={dialogId} bind:this={dialogElement} class="token-picker__dialog absolute top-[calc(100%+7px)] left-0 z-[40] w-[min(590px,calc(100vw-42px))] border border-border bg-card p-[13px] text-foreground shadow-[10px_10px_0_color-mix(in_srgb,var(--foreground)_10%,transparent)] max-[560px]:fixed max-[560px]:top-1/2 max-[560px]:left-[21px] max-[560px]:w-[calc(100vw-42px)] max-[560px]:-translate-y-1/2" role="dialog" aria-labelledby={headingId} aria-describedby={hintId} aria-modal="false" tabindex="-1" onkeydown={handleKeydown}>
			<div class="token-picker__heading flex items-start justify-between gap-3 border-b border-border pb-[9px]">
				<div><h4 id={headingId} class="m-0 mt-[3px] font-display text-[0.95rem]">Insert token</h4></div>
				<button class="token-picker__close h-[25px] w-[25px] cursor-pointer border border-border bg-card p-0 text-[1.1rem] leading-none text-foreground hover:border-accent hover:bg-muted" type="button" aria-label="Close token picker" onclick={closePicker}>×</button>
			</div>
			<p id={hintId} class="token-picker__hint mx-0 my-[10px] text-[0.72rem] text-muted-foreground">Arrow keys browse. Enter inserts at the description caret or replaces its selection.</p>
			<div class="token-picker__groups grid grid-cols-[repeat(2,minmax(0,1fr))] gap-[13px] overflow-y-auto pr-[3px] max-h-[min(430px,60vh)] max-[560px]:grid-cols-1">
				{#each TOKEN_GROUPS as group, groupIndex}
					<section class="token-picker__group min-w-0" aria-labelledby={groupId(group.id)}>
						<h5 id={groupId(group.id)} class="m-0 mb-[6px] font-display text-[0.62rem] tracking-[0.08em] text-muted-foreground uppercase">{group.label}</h5>
						<div class="token-picker__options grid gap-[3px]">
							{#each group.options as option, optionIndex}
								{@const flatIndex = TOKEN_GROUPS.slice(0, groupIndex).reduce((count, entry) => count + entry.options.length, 0) + optionIndex}
								<button class:active={activeIndex === flatIndex} class="token-picker__option grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-[7px] border border-border bg-card px-[7px] py-[6px] text-left text-[0.72rem] text-foreground hover:border-accent hover:bg-muted" type="button" data-token-index={flatIndex} onclick={() => choose(option)} onmouseenter={() => (activeIndex = flatIndex)}>
									<span>{option.label}</span><code class="whitespace-nowrap text-[0.65rem] text-accent">{tokenText(option.token)}</code>
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
	.token-picker__option.active { border-color: var(--accent); background: var(--muted); }
</style>
