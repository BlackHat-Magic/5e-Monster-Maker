<script lang="ts">
	import { onMount } from 'svelte';
	import AppHeader from '$lib/components/app-shell/AppHeader.svelte';
	import EditorWorkspace from '$lib/components/editor/EditorWorkspace.svelte';
	import SectionNav from '$lib/components/editor/SectionNav.svelte';
	import IdentityEditor from '$lib/components/editor/IdentityEditor.svelte';
	import FeaturesEditor from '$lib/components/editor/FeaturesEditor.svelte';
	import BasicsEditor from '$lib/components/editor/BasicsEditor.svelte';
	import StatsEditor from '$lib/components/editor/StatsEditor.svelte';
	import ProficienciesEditor from '$lib/components/editor/ProficienciesEditor.svelte';
	import LanguagesEditor from '$lib/components/editor/LanguagesEditor.svelte';
	import ActionSectionEditor from '$lib/components/editor/ActionSectionEditor.svelte';
 	import { editorPanelId, editorTabId, EDITOR_SECTIONS } from '$lib/components/editor/editor-core';
	import { initTheme } from '$lib/state/theme-store';
	import { restoreMonster, selectedSection } from '$lib/state/monster-store';
	import type { EditorSection } from '$lib/monster/types';

	onMount(() => {
		restoreMonster();
		initTheme();
	});
</script>

<div class="app-shell">
	<AppHeader />
	<main class="workspace" aria-labelledby="workspace-title">
		<div class="workspace__index">01 / WORKSPACE</div>
		<h1 id="workspace-title" class="sr-only">Monster authoring workspace</h1>
		<EditorWorkspace>
			{#snippet navigation()}<SectionNav />{/snippet}
			{#snippet children()}
				{#each EDITOR_SECTIONS as section (section.key)}
					{@const inactive = $selectedSection !== section.key}
					<div
						id={editorPanelId(section.key)}
						data-testid={editorPanelId(section.key)}
						class="editor-section-panel"
						role="tabpanel"
						aria-labelledby={editorTabId(section.key)}
						aria-hidden={inactive}
						hidden={inactive}
						inert={inactive}
						tabindex={inactive ? undefined : -1}
					>
						{#if section.key === 'identity'}
							<IdentityEditor />
						{:else if section.key === 'features'}
							<FeaturesEditor />
						{:else if section.key === 'basics'}
							<BasicsEditor />
						{:else if section.key === 'stats'}
							<StatsEditor />
						{:else if section.key === 'proficiencies'}
							<ProficienciesEditor />
						{:else if section.key === 'language'}
							<LanguagesEditor />
						{:else if section.key === 'traits'}
							<ActionSectionEditor target="ability" sectionTitle="Traits" sectionNumber="07 / Combat" />
						{:else if section.key === 'action'}
							<ActionSectionEditor target="action" sectionTitle="Actions" sectionNumber="08 / Combat" />
						{:else if section.key === 'bonus_action'}
							<ActionSectionEditor target="bonus_action" sectionTitle="Bonus Actions" sectionNumber="09 / Combat" />
						{:else if section.key === 'reaction'}
							<ActionSectionEditor target="reaction" sectionTitle="Reactions" sectionNumber="10 / Combat" />
						{:else if section.key === 'legendary_action'}
							<ActionSectionEditor target="legendary_action" sectionTitle="Legendary Actions" sectionNumber="11 / Combat" introDescriptionKey="legendary_description" introDescriptionLabel="Legendary introduction" />
						{:else if section.key === 'villain_action'}
							<ActionSectionEditor target="villain_action" sectionTitle="Villain Actions" sectionNumber="12 / Combat" introDescriptionKey="villain_description" introDescriptionLabel="Villain introduction" />
						{:else if section.key === 'mythic_action'}
							<ActionSectionEditor target="mythic_action" sectionTitle="Mythic Actions" sectionNumber="13 / Combat" introDescriptionKey="mythic_description" introDescriptionLabel="Mythic introduction" />
						{:else}
							{@render PlaceholderSection(section.key)}
						{/if}
					</div>
				{/each}
			{/snippet}
		</EditorWorkspace>
	</main>
</div>

{#snippet PlaceholderSection(section: EditorSection)}
	<section class="editor-section editor-placeholder" aria-labelledby={`${section}-placeholder-heading`}>
		<p class="section-label">Queued editor</p>
		<h2 id={`${section}-placeholder-heading`}>{EDITOR_SECTIONS.find((entry) => entry.key === section)?.label ?? section}</h2>
		<p>This section is wired into the authoring index. Its normalized editor will be added when its data model is available.</p>
	</section>
{/snippet}
