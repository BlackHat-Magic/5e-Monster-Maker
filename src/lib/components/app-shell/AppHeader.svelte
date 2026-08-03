<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Github01Icon } from '@hugeicons/core-free-icons';
	import { monster } from '$lib/state/monster-store';
	import FileActions from './FileActions.svelte';
	import ThemePicker from './ThemePicker.svelte';
	import KoFiLink from './KoFiLink.svelte';

	let monsterName = $derived(($monster.name ?? '').trim() || 'Untitled monster');
</script>

<header class="app-header">
	<div class="app-header__identity">
		<a class="wordmark" href="/" aria-label="5e Monster Maker home">
			<span class="wordmark__mark">5E</span>
			<span class="wordmark__name">Monster Maker</span>
		</a>
		<span class="header-rule" aria-hidden="true"></span>
		<div class="draft-name"><span class="section-label">Current draft</span><strong>{monsterName}</strong></div>
	</div>
	<div class="app-header__tools">
		<FileActions />
		<span class="header-rule header-rule--tools" aria-hidden="true"></span>
		<ThemePicker />
		<a class="shell-icon-button" href="https://github.com/BlackHat-Magic/5e-Monster-Maker" target="_blank" rel="noopener noreferrer" aria-label="Open 5e Monster Maker on GitHub" title="GitHub">
			<HugeiconsIcon icon={Github01Icon} size={17} strokeWidth={1.8} />
		</a>
		<KoFiLink />
	</div>
</header>
