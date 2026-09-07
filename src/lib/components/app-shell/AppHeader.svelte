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

<header bind:this={headerElement} class="app-header sticky top-0 z-[60] flex items-center justify-between gap-6 border-b border-border p-[clamp(18px,2vw,24px)] max-[920px]:flex-col max-[920px]:items-start">
	<div class="app-header__identity flex items-center gap-4 max-[560px]:w-full">
		<a class="wordmark inline-flex items-center gap-2.5 no-underline" href="/" aria-label="5e Monster Maker home">
			<img class="wordmark__mark block h-[39px] w-[47px] object-contain" src="/logo.svg" alt="" />
			<span class="wordmark__name font-display text-[0.98rem] font-bold tracking-[-0.02em] max-[560px]:hidden">Monster Maker</span>
		</a>
	</div>
	<div class="app-header__tools flex items-center gap-4 max-[920px]:w-full max-[920px]:flex-wrap">
		<FileActions />
		<span class="header-rule header-rule--tools h-8 w-px bg-border max-[920px]:hidden" aria-hidden="true"></span>
		<ThemePicker />
		<KoFiLink />
	</div>
</header>
