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
	import { Popover } from '$lib/components/ui/popover/index.js';

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
	const registration: HelpRegistration = { close: closeFromRegistry };

	function closeFromRegistry(): void {
		open = false;
		pointerFocus = false;
	}

	function keepFocus(event: Event): void {
		event.preventDefault();
	}

	function handlePointerDown(): void {
		pointerFocus = true;
		activateHelp(registration);
	}

	function handlePointerEnter(): void {
		activateHelp(registration);
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
			activateHelp(registration);
			return;
		}
		open = true;
		activateHelp(registration);
	}

	function handleClick(): void {
		activateHelp(registration);
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

<Popover.Root bind:open>
	<Popover.Trigger openOnHover openDelay={0} closeDelay={140}>
		{#snippet child({ props })}
			<button
				{...props}
				class="field-help__trigger"
				bind:this={triggerElement}
				data-field-help-trigger={helpId}
				type="button"
				aria-label={`${label} information`}
				aria-describedby={helpId}
				onpointerdown={handlePointerDown}
				onpointerentercapture={handlePointerEnter}
				onpointerup={() => (pointerFocus = false)}
				onfocus={handleFocus}
				onclickcapture={handleClick}
			>
				<span class="field-help__badge">i</span>
			</button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Portal>
 	<Popover.Content side="top" sideOffset={8} collisionPadding={16} forceMount onOpenAutoFocus={keepFocus} onCloseAutoFocus={keepFocus}>
			{#snippet child({ wrapperProps, props, open })}
				<!-- data-help-state mirrors the popover so the closed portal wrapper
				can never intercept clicks meant for nearby inputs and dropdowns. -->
				<div {...wrapperProps} data-help-state={open ? 'open' : 'closed'}>
					<div {...props} id={helpId} class="field-help__content" data-field-help-content={helpId}>
						<p>{help}</p>
						{#if open}
							{#if children}{@render children()}{/if}
							{#if link}
								<a href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
							{/if}
						{/if}
					</div>
				</div>
			{/snippet}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

<style>
	.field-help__trigger { display: inline-grid; width: 26px; height: 26px; place-items: center; border: 0; border-radius: 50% !important; padding: 0; background: transparent; color: var(--accent); cursor: pointer; }
	.field-help__trigger:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
	.field-help__badge { display: inline-grid; width: 17px; height: 17px; place-items: center; border: 1px solid var(--border); border-radius: 50% !important; color: var(--foreground); font-family: var(--font-display); font-size: 0.66rem; font-style: normal; font-weight: 800; line-height: 1; }
	.field-help__content { z-index: 70; width: min(320px, calc(100vw - 32px)); border: 1px solid var(--border); background: var(--card); padding: 15px 16px; color: var(--foreground); box-shadow: 9px 9px 0 color-mix(in srgb, var(--foreground) 10%, transparent); font-size: 0.78rem; line-height: 1.5; opacity: 0; transform: translateY(4px); transition: opacity 140ms ease, transform 140ms ease, visibility 0s linear 140ms; }
	.field-help__content[data-state="open"] { visibility: visible; opacity: 1; transform: translateY(0); transition-delay: 0s; }
	.field-help__content[data-state="closed"] { visibility: hidden; pointer-events: none; }
	div[data-help-state="closed"] { visibility: hidden !important; pointer-events: none !important; }
	div[data-help-state="open"] { pointer-events: auto; }
	.field-help__content :global(p) { margin: 0; color: var(--muted-foreground); }
	.field-help__content :global(a) { display: inline-block; margin-top: 9px; color: var(--accent); font-family: var(--font-display); font-size: 0.7rem; font-weight: 700; }
	@media (prefers-reduced-motion: reduce) { .field-help__content { transition: none; } }
</style>
