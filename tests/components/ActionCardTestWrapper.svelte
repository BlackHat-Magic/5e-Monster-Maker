<script lang="ts">
  import ActionCard from "../../src/lib/components/editor/ActionCard.svelte";
  import RepeatableList from "../../src/lib/components/editor/RepeatableList.svelte";
  import { createDefaultAction } from "../../src/lib/components/editor/action-editor-core";
  import type { ActionItem } from "../../src/lib/monster/types";

  let { initialItem, replacementItem } = $props<{ initialItem: ActionItem; replacementItem?: ActionItem }>();
  let item = $state<ActionItem>({ name: "", preset: "none", description: "" });

  $effect(() => {
    item = initialItem;
  });

  let items = $derived([item]);

  function handleItemsChange(next: ActionItem[]): void {
    if (next[0]) item = next[0];
  }

  function replaceItem(): void {
    if (replacementItem) item = replacementItem;
  }
</script>

{#if replacementItem}
  <button type="button" data-testid="replace-action" onclick={replaceItem}>Replace action</button>
{/if}

<RepeatableList label="Actions" items={items} createItem={createDefaultAction} getItemName={(action) => action.name} onItemsChange={handleItemsChange}>
  {#snippet children(action, index, update)}
	    <ActionCard item={action} index={index} target="action" onChange={update} />
  {/snippet}
</RepeatableList>

<output data-testid="action-json">{JSON.stringify(item)}</output>
