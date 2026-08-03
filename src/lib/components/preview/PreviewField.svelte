<script lang="ts">
	import type { LabeledPreview } from '$lib/monster/preview';

	type Props = {
		field: LabeledPreview;
	};

	let { field }: Props = $props();
</script>

<div class="preview-field">{@html field.html}</div>
