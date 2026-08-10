<script lang="ts">
  import RepeatableList from "../../src/lib/components/editor/RepeatableList.svelte";

  type OuterItem = { name: string; nested: string[] };

  let { replacementItems } = $props<{ replacementItems?: OuterItem[] }>();
  let outerItems = $state<OuterItem[]>([
    { name: "Outer one", nested: ["Nested one", "Nested alternate"] },
    { name: "Outer two", nested: ["Nested two"] },
  ]);

  function updateOuter(index: number, item: OuterItem): void {
    outerItems = outerItems.map((entry, entryIndex) => entryIndex === index ? item : entry);
  }

  function replaceOuterItems(): void {
    if (replacementItems) outerItems = replacementItems;
  }
</script>

{#if replacementItems}
  <button type="button" data-testid="replace-outer-items" onclick={replaceOuterItems}>Replace outer items</button>
{/if}

<RepeatableList
  label="Outer items"
  items={outerItems}
  createItem={() => ({ name: "New outer", nested: [] })}
  getItemName={(item) => item.name}
  onItemsChange={(items) => outerItems = items}
>
  {#snippet children(item, index, update)}
    <RepeatableList
      label="Nested items"
      items={item.nested}
      createItem={() => "New nested"}
      getItemName={(nested) => nested}
      onItemsChange={(nested) => updateOuter(index, { ...item, nested })}
    >
      {#snippet children(nested, nestedIndex, updateNested)}
        <input aria-label={`${item.name} ${nestedIndex + 1}`} value={nested} oninput={(event) => updateNested((event.currentTarget as HTMLInputElement).value)} />
      {/snippet}
    </RepeatableList>
  {/snippet}
</RepeatableList>
