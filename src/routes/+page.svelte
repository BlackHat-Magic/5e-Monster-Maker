<script lang="ts">
	import { onMount } from 'svelte';
	import AppHeader from '$lib/components/app-shell/AppHeader.svelte';
	import AppFooter from '$lib/components/app-shell/AppFooter.svelte';
	import EditorWorkspace from '$lib/components/editor/EditorWorkspace.svelte';
	import SectionNav from '$lib/components/editor/SectionNav.svelte';
	import IdentityEditor from '$lib/components/editor/IdentityEditor.svelte';
	import BasicsEditor from '$lib/components/editor/BasicsEditor.svelte';
	import StatsEditor from '$lib/components/editor/StatsEditor.svelte';
	import ProficienciesEditor from '$lib/components/editor/ProficienciesEditor.svelte';
	import LanguagesEditor from '$lib/components/editor/LanguagesEditor.svelte';
	import ActionSectionEditor from '$lib/components/editor/ActionSectionEditor.svelte';
 	import { editorPanelId, editorTabId, EDITOR_SECTIONS } from '$lib/components/editor/editor-core';
	import { initTheme } from '$lib/state/theme-store';
	import { restoreMonster, selectedSection } from '$lib/state/monster-store';

	onMount(() => {
		restoreMonster();
		initTheme();
	});
</script>

<div class="app-shell">
	<AppHeader />
	<IdentityEditor />
	<main class="workspace" aria-label="Monster editor">
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
						{#if section.key === 'basics'}
							<BasicsEditor />
						{:else if section.key === 'stats'}
							<StatsEditor />
						{:else if section.key === 'proficiencies'}
							<ProficienciesEditor />
						{:else if section.key === 'language'}
							<LanguagesEditor />
						{:else if section.key === 'traits'}
							<ActionSectionEditor target="ability" sectionTitle="Traits" />
						{:else if section.key === 'action'}
							<ActionSectionEditor target="action" sectionTitle="Actions" />
						{:else if section.key === 'bonus_action'}
							<ActionSectionEditor target="bonus_action" sectionTitle="Bonus Actions" />
						{:else if section.key === 'reaction'}
							<ActionSectionEditor target="reaction" sectionTitle="Reactions" />
						{:else if section.key === 'legendary_action'}
							<ActionSectionEditor target="legendary_action" sectionTitle="Legendary" specialFlagKey="is_legendary" introDescriptionKey="legendary_description" introDescriptionLabel="Legendary introduction" />
						{:else if section.key === 'villain_action'}
							<ActionSectionEditor target="villain_action" sectionTitle="Villain" specialFlagKey="is_villain" introDescriptionKey="villain_description" introDescriptionLabel="Villain introduction" />
						{:else if section.key === 'mythic_action'}
							<ActionSectionEditor target="mythic_action" sectionTitle="Mythic" specialFlagKey="is_mythic" introDescriptionKey="mythic_description" introDescriptionLabel="Mythic introduction" />
						{/if}
					</div>
				{/each}
			{/snippet}
		</EditorWorkspace>
	</main>
	<AppFooter />
</div>
