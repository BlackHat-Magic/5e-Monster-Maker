<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { CheckmarkCircle04Icon, ColorsIcon, Moon01Icon, Sun01Icon } from '@hugeicons/core-free-icons';
	import { Popover } from '$lib/components/ui/popover/index.js';
	import { Tabs } from '$lib/components/ui/tabs/index.js';
	import { darkPalettes, lightPalettes, type DarkThemeKey, type LightThemeKey, type ThemeKey, type ThemeMode } from '$lib/theme/palettes';
	import { darkTheme, lightTheme, mode, setDarkTheme, setLightTheme, toggleMode } from '$lib/state/theme-store';

	let open = $state(false);
	let activeMode = $state<ThemeMode>('light');

	$effect(() => {
		activeMode = $mode;
	});

	function chooseMode(nextMode: ThemeMode): void {
		if ($mode !== nextMode) toggleMode();
		activeMode = nextMode;
	}

	function choosePalette(key: ThemeKey): void {
		if (lightPalettes.some((palette) => palette.key === key)) setLightTheme(key as LightThemeKey);
		else setDarkTheme(key as DarkThemeKey);
	}

	function isCurrent(key: ThemeKey): boolean {
		return $mode === 'light' ? $lightTheme === key : $darkTheme === key;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger class="shell-icon-button" type="button" aria-label="Choose theme" title="Choose theme">
		<HugeiconsIcon icon={ColorsIcon} size={17} strokeWidth={1.8} />
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content class="theme-popover" align="end">
			<div class="theme-popover__heading">
				<div><p class="section-label">Appearance</p><h2>Color system</h2></div>
				<button class="theme-mode-toggle" type="button" onclick={toggleMode} aria-label={`Switch to ${$mode === 'light' ? 'dark' : 'light'} mode`}>
					<HugeiconsIcon icon={$mode === 'light' ? Moon01Icon : Sun01Icon} size={16} strokeWidth={1.8} />
					<span>{$mode === 'light' ? 'Dark' : 'Light'}</span>
				</button>
			</div>
			<Tabs.Root bind:value={activeMode} onValueChange={(value) => chooseMode(value as ThemeMode)}>
				<Tabs.List class="theme-tabs" aria-label="Theme mode">
					<Tabs.Trigger class="theme-tab" value="light"><HugeiconsIcon icon={Sun01Icon} size={14} strokeWidth={1.8} /> Light</Tabs.Trigger>
					<Tabs.Trigger class="theme-tab" value="dark"><HugeiconsIcon icon={Moon01Icon} size={14} strokeWidth={1.8} /> Dark</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="light" class="theme-list" tabindex={0}>
					{#each lightPalettes as palette}
						<button class:theme-option--current={isCurrent(palette.key)} class="theme-option" type="button" onclick={() => choosePalette(palette.key)} aria-pressed={isCurrent(palette.key)}>
							<span class="theme-swatch" style={`--swatch-bg: ${palette.colors.background}; --swatch-accent: ${palette.colors.accent};`}></span>
							<span>{palette.label}</span>
							{#if isCurrent(palette.key)}<HugeiconsIcon icon={CheckmarkCircle04Icon} size={15} strokeWidth={2} aria-hidden="true" />{/if}
						</button>
					{/each}
				</Tabs.Content>
				<Tabs.Content value="dark" class="theme-list" tabindex={0}>
					{#each darkPalettes as palette}
						<button class:theme-option--current={isCurrent(palette.key)} class="theme-option" type="button" onclick={() => choosePalette(palette.key)} aria-pressed={isCurrent(palette.key)}>
							<span class="theme-swatch" style={`--swatch-bg: ${palette.colors.background}; --swatch-accent: ${palette.colors.accent};`}></span>
							<span>{palette.label}</span>
							{#if isCurrent(palette.key)}<HugeiconsIcon icon={CheckmarkCircle04Icon} size={15} strokeWidth={2} aria-hidden="true" />{/if}
						</button>
					{/each}
				</Tabs.Content>
			</Tabs.Root>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
