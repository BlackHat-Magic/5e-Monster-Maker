<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { CheckmarkCircle04Icon, Moon01Icon, Sun01Icon } from '@hugeicons/core-free-icons';
	import { fly } from 'svelte/transition';
	import { darkPalettes, lightPalettes, type DarkThemeKey, type LightThemeKey, type ThemeKey, type ThemeMode } from '$lib/theme/palettes';
	import { darkTheme, lightTheme, mode, setDarkTheme, setLightTheme, toggleMode } from '$lib/state/theme-store';

	let open = $state(false);
	let activeMode = $state<ThemeMode>($mode);
	let reducedMotion = $state(false);
	let picker: HTMLDivElement;
	let trigger: HTMLButtonElement;

	$effect(() => {
		activeMode = $mode;
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
		if (!mediaQuery) return;
		const update = () => {
			reducedMotion = mediaQuery.matches;
		};
		update();
		mediaQuery.addEventListener?.('change', update);
		return () => mediaQuery.removeEventListener?.('change', update);
	});

	function chooseMode(nextMode: ThemeMode): void {
		if ($mode !== nextMode) toggleMode();
		activeMode = nextMode;
	}

	function choosePalette(key: ThemeKey): void {
		if (lightPalettes.some((palette) => palette.key === key)) setLightTheme(key as LightThemeKey);
		else setDarkTheme(key as DarkThemeKey);
	}

	function openPicker(): void {
		open = true;
	}

	function closePicker(): void {
		open = false;
	}

	function closePickerAndRestoreFocus(): void {
		trigger?.focus({ preventScroll: true });
		closePicker();
	}

	function handleFocusOut(event: FocusEvent): void {
		if (!picker.contains(event.relatedTarget as Node | null)) closePicker();
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			closePickerAndRestoreFocus();
		}
	}

	function isCurrent(key: ThemeKey): boolean {
		return $mode === 'light' ? $lightTheme === key : $darkTheme === key;
	}

	function modeTabId(value: ThemeMode): string {
		return `theme-mode-tab-${value}`;
	}

	function modePanelId(value: ThemeMode): string {
		return `theme-mode-panel-${value}`;
	}

	const MODE_ORDER: ThemeMode[] = ['light', 'dark'];

	function handleModeTabKeydown(event: KeyboardEvent): void {
		// APG tabs pattern mirroring the section navigation: arrows move and
		// activate, Home/End jump to the ends.
		if (!['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const currentIndex = MODE_ORDER.indexOf(activeMode);
		let nextIndex = currentIndex;
		if (event.key === 'Home') nextIndex = 0;
		else if (event.key === 'End') nextIndex = MODE_ORDER.length - 1;
		else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % MODE_ORDER.length;
		else nextIndex = (currentIndex - 1 + MODE_ORDER.length) % MODE_ORDER.length;
		const next = MODE_ORDER[nextIndex];
		chooseMode(next);
		document.getElementById(modeTabId(next))?.focus();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="theme-picker"
	role="group"
	aria-label="Theme picker"
	bind:this={picker}
	onpointerenter={openPicker}
	onpointerleave={closePicker}
	onfocusin={openPicker}
	onfocusout={handleFocusOut}
	onkeydown={handleKeydown}
>
	<button
		class="shell-icon-button"
		type="button"
		bind:this={trigger}
		onclick={toggleMode}
		aria-label="Toggle light/dark theme"
		title="Toggle theme"
		aria-expanded={open}
	>
		<HugeiconsIcon icon={$mode === 'dark' ? Moon01Icon : Sun01Icon} size={17} strokeWidth={1.8} />
	</button>
	{#if open}
		<div
			class="theme-popover"
			transition:fly={{ y: 6, duration: reducedMotion ? 0 : 140 }}
			inert={!open}
			aria-hidden={!open}
		>
			<div class="theme-popover__heading">
				<p class="section-label">Appearance</p>
				<h2>{activeMode === 'light' ? 'Choose a light theme' : 'Choose a dark theme'}</h2>
			</div>
			<div class="theme-tabs" role="tablist" aria-label="Theme mode">
				{#each MODE_ORDER as value}
					<button
						id={modeTabId(value)}
						class="theme-tab"
						data-state={activeMode === value ? 'active' : 'inactive'}
						type="button"
						role="tab"
						aria-selected={activeMode === value}
						aria-controls={modePanelId(value)}
						tabindex={activeMode === value ? 0 : -1}
						onclick={() => chooseMode(value)}
						onkeydown={handleModeTabKeydown}
					>{#if value === 'light'}<HugeiconsIcon icon={Sun01Icon} size={14} strokeWidth={1.8} /> Light{:else}<HugeiconsIcon icon={Moon01Icon} size={14} strokeWidth={1.8} /> Dark{/if}</button>
				{/each}
			</div>
			{#each MODE_ORDER as value}
				<div
					id={modePanelId(value)}
					class="theme-list"
					tabindex={0}
					role="tabpanel"
					aria-labelledby={modeTabId(value)}
					hidden={activeMode !== value}
				>
					{#each (value === 'light' ? lightPalettes : darkPalettes) as palette}
						<button class:theme-option--current={isCurrent(palette.key)} class="theme-option" type="button" onclick={() => choosePalette(palette.key)} aria-pressed={isCurrent(palette.key)}>
							<span>{palette.label}</span>
							{#if isCurrent(palette.key)}<HugeiconsIcon icon={CheckmarkCircle04Icon} size={15} strokeWidth={2} aria-hidden="true" />{/if}
						</button>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>
