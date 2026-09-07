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
	import { onMount, tick, type Snippet } from 'svelte';

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
	let cardElement: HTMLDivElement | null = null;
	let helpId = $derived(id ?? createHelpId(label));
	let flipBelow = $state(false);
	let alignRight = $state(false);
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

	function updateFlip(): void {
		// Prefer the card above the trigger (as before); flip below only when
		// the card would not fit above, and right-align when it would
		// otherwise overflow the viewport (the old floating-ui shift).
		// In non-visual environments the rects are empty, which keeps the
		// default above, left-aligned placement.
		if (!triggerElement || typeof triggerElement.getBoundingClientRect !== 'function') return;
		const rect = triggerElement.getBoundingClientRect();
		if (rect.top + rect.height <= 0) {
			flipBelow = false;
			alignRight = false;
			return;
		}
		const height = cardElement?.getBoundingClientRect().height ?? 0;
		flipBelow = height > 0 && rect.top < height + 24;
		if (typeof window !== 'undefined' && Number.isFinite(window.innerWidth)) {
			const cardWidth = Math.min(320, window.innerWidth - 32);
			alignRight = cardWidth > 0 && rect.left + cardWidth > window.innerWidth - 8;
		}
	}

	function openCard(): void {
		clearCloseTimer();
		flipBelow = false;
		alignRight = false;
		open = true;
		activateHelp(registration);
		// The fade-in covers a same-tick reposition when a flip is needed.
		void tick().then(() => {
			if (open) updateFlip();
		});
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

<span class="field-help__anchor relative inline-grid">
			<button
				class="field-help__trigger inline-grid h-[26px] w-[26px] cursor-pointer place-items-center rounded-[50%]! border-0 bg-transparent p-0 text-accent hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
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
			<span class="field-help__badge inline-grid h-[17px] w-[17px] place-items-center rounded-[50%]! border border-border font-display text-[0.66rem] font-extrabold not-italic leading-none text-foreground">i</span>
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
		data-align={alignRight ? 'right' : 'left'}
		onpointerenter={handleCardEnter}
		onpointerleave={handleCardLeave}
	>
		<div
			bind:this={cardElement}
			id={helpId}
			class="field-help__content z-[70] w-[min(320px,calc(100vw-32px))] border border-border bg-card px-4 py-[15px] text-[0.78rem] leading-[1.5] text-foreground opacity-0 translate-y-1 shadow-[9px_9px_0_color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-[opacity_140ms_ease,transform_140ms_ease,visibility_0s_linear_140ms] data-[state=open]:visible data-[state=open]:opacity-100 data-[state=open]:translate-y-0 data-[state=open]:delay-0 data-[state=closed]:invisible data-[state=closed]:pointer-events-none"
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
	.field-help__portal { position: absolute; z-index: 70; bottom: calc(100% + 8px); left: 0; }
	.field-help__portal[data-flip="below"] { top: calc(100% + 8px); bottom: auto; }
	.field-help__portal[data-align="right"] { left: auto; right: 0; }
	.field-help__portal[data-help-state="open"] { pointer-events: auto; }
	.field-help__portal[data-help-state="closed"] { visibility: hidden; pointer-events: none; top: 0; right: auto !important; left: -10000px !important; }
	.field-help__content :global(p) { margin: 0; color: var(--muted-foreground); }
	.field-help__content :global(a) { display: inline-block; margin-top: 9px; color: var(--accent); font-family: var(--font-display); font-size: 0.7rem; font-weight: 700; }
	@media (prefers-reduced-motion: reduce) { .field-help__content { transition: none; } }
</style>
