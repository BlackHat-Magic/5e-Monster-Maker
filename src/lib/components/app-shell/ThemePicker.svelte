<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { CheckmarkCircle04Icon, Moon01Icon, Sun01Icon } from '@hugeicons/core-free-icons';
	import { fly } from 'svelte/transition';
	import { Tabs } from '$lib/components/ui/tabs/index.js';
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
			<Tabs.Root bind:value={activeMode} onValueChange={(value) => chooseMode(value as ThemeMode)}>
				<Tabs.List class="theme-tabs" aria-label="Theme mode">
					<Tabs.Trigger class="theme-tab" value="light"><HugeiconsIcon icon={Sun01Icon} size={14} strokeWidth={1.8} /> Light</Tabs.Trigger>
					<Tabs.Trigger class="theme-tab" value="dark"><HugeiconsIcon icon={Moon01Icon} size={14} strokeWidth={1.8} /> Dark</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="light" class="theme-list" tabindex={0}>
					{#each lightPalettes as palette}
						<button class:theme-option--current={isCurrent(palette.key)} class="theme-option" type="button" onclick={() => choosePalette(palette.key)} aria-pressed={isCurrent(palette.key)}>
							<span>{palette.label}</span>
							{#if isCurrent(palette.key)}<HugeiconsIcon icon={CheckmarkCircle04Icon} size={15} strokeWidth={2} aria-hidden="true" />{/if}
						</button>
					{/each}
				</Tabs.Content>
				<Tabs.Content value="dark" class="theme-list" tabindex={0}>
					{#each darkPalettes as palette}
						<button class:theme-option--current={isCurrent(palette.key)} class="theme-option" type="button" onclick={() => choosePalette(palette.key)} aria-pressed={isCurrent(palette.key)}>
							<span>{palette.label}</span>
							{#if isCurrent(palette.key)}<HugeiconsIcon icon={CheckmarkCircle04Icon} size={15} strokeWidth={2} aria-hidden="true" />{/if}
						</button>
					{/each}
				</Tabs.Content>
			</Tabs.Root>
		</div>
	{/if}
</div>
