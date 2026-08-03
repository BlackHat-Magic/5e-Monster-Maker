<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let { class: className = '', ...rest }: HTMLInputAttributes = $props();
</script>

<input class={`ui-input ${className}`} {...rest} />
