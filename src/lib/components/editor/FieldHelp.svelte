<script module lang="ts">
	type HelpRegistration = {
		close: () => void;
	};

	let generatedHelpId = 0;
	let activeHelp: HelpRegistration | undefined;

	function createHelpId(label: string): string {
		generatedHelpId += 1;
		return `field-help-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${generatedHelpId}`;
	}

	function activateHelp(registration: HelpRegistration): void {
		if (activeHelp === registration) return;
		activeHelp?.close();
		activeHelp = registration;
	}

	function deactivateHelp(registration: HelpRegistration): void {
		if (activeHelp === registration) activeHelp = undefined;
	}
</script>

<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	type HelpLink = {
		href: string;
		label: string;
	};

	type Props = {
		label: string;
		help: string;
		id?: string;
		link?: HelpLink;
		children?: Snippet;
	};

	let { label, help, id, link, children }: Props = $props();
	let open = $state(false);
	let pointerFocus = false;
	let suppressNextFocusOpen = false;
	let suppressFocusTimer: ReturnType<typeof setTimeout> | undefined;
	let triggerElement: HTMLButtonElement | null = null;
	let helpId = $derived(id ?? createHelpId(label));
	let flipBelow = $state(false);
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	const CLOSE_DELAY = 140;
	const registration: HelpRegistration = { close: closeFromRegistry };

	function closeFromRegistry(): void {
		open = false;
		pointerFocus = false;
	}

	function handlePointerDown(): void {
		pointerFocus = true;
		activateHelp(registration);
	}

	function handlePointerEnter(): void {
		openCard();
	}

	function handleFocus(): void {
		if (suppressNextFocusOpen) {
			suppressNextFocusOpen = false;
			if (suppressFocusTimer) clearTimeout(suppressFocusTimer);
			suppressFocusTimer = undefined;
			return;
		}
		if (pointerFocus) {
			pointerFocus = false;
			openCard();
			return;
		}
		openCard();
	}

	function handleClick(): void {
		activateHelp(registration);
	}

	function clearCloseTimer(): void {
		if (closeTimer !== undefined) {
			clearTimeout(closeTimer);
			closeTimer = undefined;
		}
	}

	function scheduleClose(): void {
		clearCloseTimer();
		closeTimer = setTimeout(() => {
			closeTimer = undefined;
			if (!open) return;
			open = false;
			deactivateHelp(registration);
		}, CLOSE_DELAY);
	}

	function measureFlip(): void {
		// Prefer the card above the trigger (as before); flip below when there
		// is not enough room above. In non-visual environments the rects are
		// empty, which keeps the default above placement.
		if (!triggerElement || typeof triggerElement.getBoundingClientRect !== 'function') return;
		const rect = triggerElement.getBoundingClientRect();
		if (rect.top + rect.height <= 0) return;
		flipBelow = rect.top < 360;
	}

	function openCard(): void {
		clearCloseTimer();
		measureFlip();
		open = true;
		activateHelp(registration);
	}

	function handleTriggerLeave(): void {
		if (!open) return;
		scheduleClose();
	}

	function handleCardEnter(): void {
		clearCloseTimer();
	}

	function handleCardLeave(): void {
		if (!open) return;
		scheduleClose();
	}

	function suppressFocusReopen(): void {
		suppressNextFocusOpen = true;
		if (suppressFocusTimer) clearTimeout(suppressFocusTimer);
		suppressFocusTimer = setTimeout(() => {
			suppressNextFocusOpen = false;
			suppressFocusTimer = undefined;
		}, 0);
	}

	function focusIsInside(next: EventTarget | null): boolean {
		if (!(next instanceof Node)) return false;
		return Boolean(triggerElement?.contains(next) || document.querySelector(`[data-field-help-content="${helpId}"]`)?.contains(next));
	}

	onMount(() => {
		function closeOutside(event: PointerEvent): void {
			const target = event.target;
			if (!open || !(target instanceof Element) || triggerElement?.contains(target) || target.closest('.field-help__content')) return;
			open = false;
			deactivateHelp(registration);
		}
		function closeEscape(event: KeyboardEvent): void {
			if (activeHelp !== registration || !open || event.key !== 'Escape') return;
			event.preventDefault();
			open = false;
			deactivateHelp(registration);
			suppressFocusReopen();
			triggerElement?.focus();
		}
		function closeWhenFocusLeaves(event: FocusEvent): void {
			if (!open || focusIsInside(event.relatedTarget)) return;
			open = false;
			deactivateHelp(registration);
			suppressFocusReopen();
		}

		document.addEventListener('pointerdown', closeOutside, true);
		document.addEventListener('keydown', closeEscape, true);
		document.addEventListener('focusout', closeWhenFocusLeaves, true);
		return () => {
			if (suppressFocusTimer) clearTimeout(suppressFocusTimer);
			clearCloseTimer();
			deactivateHelp(registration);
			document.removeEventListener('pointerdown', closeOutside, true);
			document.removeEventListener('keydown', closeEscape, true);
			document.removeEventListener('focusout', closeWhenFocusLeaves, true);
		};
	});

	$effect(() => {
		if (open) activateHelp(registration);
		else deactivateHelp(registration);
	});
</script>

<span class="field-help__anchor">
			<button
				class="field-help__trigger"
				bind:this={triggerElement}
				data-field-help-trigger={helpId}
				type="button"
				aria-label={`${label} information`}
				aria-describedby={helpId}
			onpointerdown={handlePointerDown}
			onpointerentercapture={handlePointerEnter}
			onpointerleave={handleTriggerLeave}
			onpointerup={() => (pointerFocus = false)}
			onfocus={handleFocus}
			onclickcapture={handleClick}
		>
			<span class="field-help__badge">i</span>
		</button>
	<!-- Bespoke hover card: always mounted (like the previous forceMounted
	portal) so assistive tech and tests see a stable node; the closed wrapper
	can never intercept clicks meant for nearby inputs and dropdowns. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="field-help__portal"
		style="position: absolute;"
		data-help-state={open ? 'open' : 'closed'}
		data-flip={flipBelow ? 'below' : 'above'}
		onpointerenter={handleCardEnter}
		onpointerleave={handleCardLeave}
	>
		<div
			id={helpId}
			class="field-help__content"
			data-state={open ? 'open' : 'closed'}
			data-field-help-content={helpId}
		>
			<p>{help}</p>
			{#if open}
				{#if children}{@render children()}{/if}
				{#if link}
					<a href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
				{/if}
			{/if}
		</div>
	</div>
</span>

<style>
	.field-help__anchor { position: relative; display: inline-grid; }
	.field-help__portal { position: absolute; z-index: 70; bottom: calc(100% + 8px); left: 0; }
	.field-help__portal[data-flip="below"] { top: calc(100% + 8px); bottom: auto; }
	.field-help__portal[data-help-state="closed"] { visibility: hidden; pointer-events: none; }
	.field-help__portal[data-help-state="open"] { pointer-events: auto; }
	.field-help__trigger { display: inline-grid; width: 26px; height: 26px; place-items: center; border: 0; border-radius: 50% !important; padding: 0; background: transparent; color: var(--accent); cursor: pointer; }
	.field-help__trigger:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
	.field-help__badge { display: inline-grid; width: 17px; height: 17px; place-items: center; border: 1px solid var(--border); border-radius: 50% !important; color: var(--foreground); font-family: var(--font-display); font-size: 0.66rem; font-style: normal; font-weight: 800; line-height: 1; }
	.field-help__content { z-index: 70; width: min(320px, calc(100vw - 32px)); border: 1px solid var(--border); background: var(--card); padding: 15px 16px; color: var(--foreground); box-shadow: 9px 9px 0 color-mix(in srgb, var(--foreground) 10%, transparent); font-size: 0.78rem; line-height: 1.5; opacity: 0; transform: translateY(4px); transition: opacity 140ms ease, transform 140ms ease, visibility 0s linear 140ms; }
	.field-help__content[data-state="open"] { visibility: visible; opacity: 1; transform: translateY(0); transition-delay: 0s; }
	.field-help__content[data-state="closed"] { visibility: hidden; pointer-events: none; }
	.field-help__content :global(p) { margin: 0; color: var(--muted-foreground); }
	.field-help__content :global(a) { display: inline-block; margin-top: 9px; color: var(--accent); font-family: var(--font-display); font-size: 0.7rem; font-weight: 700; }
	@media (prefers-reduced-motion: reduce) { .field-help__content { transition: none; } }
</style>
