<script lang="ts">
	import { previewTheme, setPreviewTheme } from '$lib/state/theme-store';
	import {
		DARK_THEME_KEYS,
		LIGHT_THEME_KEYS,
	} from '$lib/theme/palettes';
	import {
		MONSTER_MANUAL_THEME_KEYS,
		STAT_BLOCK_THEME_KEYS,
		isStatBlockThemeKey,
		statBlockThemeByKey,
		type StatBlockThemeKey,
	} from '$lib/theme/stat-block-themes';

	type ThemeGroup = {
		label: string;
		keys: readonly StatBlockThemeKey[];
	};

	type Props = {
		idPrefix?: string;
	};

	let { idPrefix = 'preview-theme' }: Props = $props();

	const themeKeys = new Set<StatBlockThemeKey>(STAT_BLOCK_THEME_KEYS);
	const themeGroups: readonly ThemeGroup[] = [
		{
			label: 'Light',
			keys: LIGHT_THEME_KEYS.filter((key) => themeKeys.has(key)),
		},
		{
			label: 'Dark',
			keys: DARK_THEME_KEYS.filter((key) => themeKeys.has(key)),
		},
		{
			label: 'Monster Manual',
			keys: MONSTER_MANUAL_THEME_KEYS.filter((key) => themeKeys.has(key)),
		},
	];

	function handleChange(event: Event): void {
		const key = (event.currentTarget as HTMLSelectElement).value;
		if (isStatBlockThemeKey(key)) setPreviewTheme(key);
	}
</script>

<div class="preview-toolbar mt-[18px] border border-border border-l-[3px] border-l-accent bg-card px-2.5 py-2 text-foreground">
	<div class="preview-theme-picker grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-x-[14px] gap-y-[7px] max-[420px]:grid-cols-1 max-[420px]:gap-1.5">
		<label class="font-display text-[0.72rem] font-extrabold tracking-[0.04em] text-foreground" for={idPrefix}>Stat block theme</label>
		<select
			class="h-[30px] w-full min-w-0 max-w-60 border border-border bg-muted px-2 text-[0.76rem] text-foreground focus:border-accent focus:outline-2 focus:outline-[color-mix(in_srgb,var(--ring)_35%,transparent)] focus:outline-offset-0"
			id={idPrefix}
			value={$previewTheme}
			onchange={handleChange}
		>
			{#each themeGroups as group}
				<optgroup label={group.label}>
					{#each group.keys as key}
						<option value={key}>{statBlockThemeByKey[key].label}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
	</div>
</div>
