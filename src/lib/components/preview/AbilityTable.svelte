<script lang="ts">
	import type { AbilityRow } from '$lib/monster/preview';

	type Props = {
		abilities: AbilityRow[];
	};

	let { abilities }: Props = $props();
</script>

<div class="preview-abilities__scroll">
	<table class="preview-abilities__table">
		<caption>Ability scores</caption>
		<thead>
			<tr>
				{#each abilities as ability}
					<th id={`ability-${ability.key}`} scope="col">{ability.label}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			<tr>
				{#each abilities as ability}
					<td headers={`ability-${ability.key}`} aria-label={`${ability.label} ${ability.score}, ${ability.modifierText}`}>
						<strong>{ability.score}</strong>
						<span>{ability.modifierText}</span>
					</td>
				{/each}
			</tr>
		</tbody>
	</table>
</div>
