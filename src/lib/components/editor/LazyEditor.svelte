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
	<p class="editor-loading" role="status">Loading {label}…</p>
{/if}

<style>
	.editor-loading { margin: 0; color: var(--muted-foreground); font-size: 0.82rem; }
</style>
