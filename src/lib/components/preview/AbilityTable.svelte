<script lang="ts">
	import type { AbilityRow } from '$lib/monster/preview';

	type Props = {
		abilities: AbilityRow[];
		idPrefix: string;
	};

	let { abilities, idPrefix }: Props = $props();
</script>

<div class="preview-abilities__scroll">
	<table class="stat-block__abilities preview-abilities__table" aria-label="Ability scores">
		<thead>
			<tr>
				{#each abilities as ability}
					<th id={`${idPrefix}-ability-${ability.key}`} scope="col">{ability.label}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			<tr>
				{#each abilities as ability}
					<td headers={`${idPrefix}-ability-${ability.key}`} aria-label={`${ability.label} ${ability.score}, ${ability.modifierText}`}>
						<span class="stat-block__ability-score">{ability.score}</span>
						<span class="stat-block__ability-mod"> ({ability.modifierText})</span>
					</td>
				{/each}
			</tr>
		</tbody>
	</table>
</div>
