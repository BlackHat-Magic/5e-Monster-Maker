<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLSpanElement> & { children?: Snippet };
	let { class: className = '', children, ...rest }: Props = $props();
</script>

<span class={`ui-badge ${className}`} {...rest}>{@render children?.()}</span>
