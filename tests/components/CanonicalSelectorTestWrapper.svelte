<script lang="ts">
  import CanonicalSelector from '../../src/lib/components/editor/CanonicalSelector.svelte';

  let values = $state<string[]>([]);
</script>

<CanonicalSelector label="Damage resistances" kind="damage" values={values} onChange={(next) => (values = next)} />
