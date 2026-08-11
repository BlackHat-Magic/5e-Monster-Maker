<script lang="ts">
	import { onMount } from 'svelte';
	import FileActions from './FileActions.svelte';
	import ThemePicker from './ThemePicker.svelte';
	import KoFiLink from './KoFiLink.svelte';

	let headerElement: HTMLElement;

	onMount(() => {
		const root = document.documentElement;
		const updateHeaderHeight = () => root.style.setProperty('--app-header-height', `${headerElement.getBoundingClientRect().height}px`);
		updateHeaderHeight();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(updateHeaderHeight);
		observer.observe(headerElement);
		return () => observer.disconnect();
	});
</script>

<header bind:this={headerElement} class="app-header">
	<div class="app-header__identity">
		<a class="wordmark" href="/" aria-label="5e Monster Maker home">
			<img class="wordmark__mark" src="/logo.svg" alt="" />
			<span class="wordmark__name">Monster Maker</span>
		</a>
	</div>
	<div class="app-header__tools">
		<FileActions />
		<span class="header-rule header-rule--tools" aria-hidden="true"></span>
		<ThemePicker />
		<KoFiLink />
	</div>
</header>
