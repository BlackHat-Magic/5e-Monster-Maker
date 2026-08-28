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

<div class="preview-toolbar">
	<div class="preview-theme-picker">
		<label for={idPrefix}>Stat block theme</label>
		<select
			id={idPrefix}
			value={$previewTheme}
			onchange={handleChange}
			aria-describedby={`${idPrefix}-help`}
		>
			{#each themeGroups as group}
				<optgroup label={group.label}>
					{#each group.keys as key}
						<option value={key}>{statBlockThemeByKey[key].label}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
		<p id={`${idPrefix}-help`} class="preview-theme-picker__help">
			Site theme changes synchronize this preview.
		</p>
	</div>
</div>
