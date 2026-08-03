<script lang="ts">
	import type { MonsterPreview } from '../../src/lib/monster/preview';
	import type { Monster } from '../../src/lib/monster/types';
	import EditorWorkspace from '../../src/lib/components/editor/EditorWorkspace.svelte';

	type Props = {
		factory?: (monster: Monster) => MonsterPreview;
	};

	let { factory }: Props = $props();
</script>

<EditorWorkspace previewModelFactory={factory}>
	{#snippet navigation()}
		<nav aria-label="Test editor navigation">Editor navigation</nav>
	{/snippet}
	{#snippet children()}
		<label for="test-editor-control">Editor control</label>
		<input id="test-editor-control" value="still mounted" />
	{/snippet}
</EditorWorkspace>
