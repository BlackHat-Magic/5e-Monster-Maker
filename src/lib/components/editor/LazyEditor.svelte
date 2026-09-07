<script lang="ts">
	import type { Component } from 'svelte';
	import type { LazyEditorModule } from '$lib/state/deferred-resources';

	type Props = {
		label: string;
		active: boolean;
		loader: () => Promise<LazyEditorModule>;
		componentProps?: Record<string, unknown>;
	};

	let { label, active, loader, componentProps = {} }: Props = $props();
	let Resolved = $state<Component | null>(null);

	$effect(() => {
		// Inactive (hidden) panels never trigger a fetch; the module arrives
		// via tab activation or the post-load prefetch, whichever is first.
		if (!active || Resolved) return;
		let cancelled = false;
		loader()
			.then((module) => {
				if (!cancelled) Resolved = module.default;
			})
			.catch(() => {
				Resolved = null;
			});
		return () => {
			cancelled = true;
		};
	});
</script>

{#if Resolved}
	{@const EditorComponent = Resolved}
	<EditorComponent {...componentProps} />
{:else}
	<p class="m-0 text-[0.82rem] text-muted-foreground" role="status">Loading {label}…</p>
{/if}
