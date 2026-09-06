<script lang="ts">
	import { onMount } from 'svelte';
	import AppHeader from '$lib/components/app-shell/AppHeader.svelte';
	import AppFooter from '$lib/components/app-shell/AppFooter.svelte';
	import EditorWorkspace from '$lib/components/editor/EditorWorkspace.svelte';
	import SectionNav from '$lib/components/editor/SectionNav.svelte';
	import IdentityEditor from '$lib/components/editor/IdentityEditor.svelte';
	import BasicsEditor from '$lib/components/editor/BasicsEditor.svelte';
	import LazyEditor from '$lib/components/editor/LazyEditor.svelte';
 	import { editorPanelId, editorTabId, EDITOR_SECTIONS } from '$lib/components/editor/editor-core';
	import {
		loadActionSectionEditor,
		loadLanguagesEditor,
		loadProficienciesEditor,
		loadStatsEditor,
		prefetchDeferredResources,
	} from '$lib/state/deferred-resources';
	import { initTheme } from '$lib/state/theme-store';
	import { restoreMonster, selectedSection } from '$lib/state/monster-store';

	onMount(() => {
		restoreMonster();
		initTheme();
		prefetchDeferredResources();
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
							<LazyEditor label="Statistics" active={!inactive} loader={loadStatsEditor} />
						{:else if section.key === 'proficiencies'}
							<LazyEditor label="Proficiencies" active={!inactive} loader={loadProficienciesEditor} />
						{:else if section.key === 'language'}
							<LazyEditor label="Languages" active={!inactive} loader={loadLanguagesEditor} />
						{:else if section.key === 'traits'}
							<LazyEditor label="Traits" active={!inactive} loader={loadActionSectionEditor} componentProps={{ target: 'ability', sectionTitle: 'Traits' }} />
						{:else if section.key === 'action'}
							<LazyEditor label="Actions" active={!inactive} loader={loadActionSectionEditor} componentProps={{ target: 'action', sectionTitle: 'Actions' }} />
						{:else if section.key === 'bonus_action'}
							<LazyEditor label="Bonus Actions" active={!inactive} loader={loadActionSectionEditor} componentProps={{ target: 'bonus_action', sectionTitle: 'Bonus Actions' }} />
						{:else if section.key === 'reaction'}
							<LazyEditor label="Reactions" active={!inactive} loader={loadActionSectionEditor} componentProps={{ target: 'reaction', sectionTitle: 'Reactions' }} />
						{:else if section.key === 'legendary_action'}
							<LazyEditor label="Legendary" active={!inactive} loader={loadActionSectionEditor} componentProps={{ target: 'legendary_action', sectionTitle: 'Legendary', specialFlagKey: 'is_legendary', introDescriptionKey: 'legendary_description', introDescriptionLabel: 'Legendary introduction' }} />
						{:else if section.key === 'villain_action'}
							<LazyEditor label="Villain" active={!inactive} loader={loadActionSectionEditor} componentProps={{ target: 'villain_action', sectionTitle: 'Villain', specialFlagKey: 'is_villain', introDescriptionKey: 'villain_description', introDescriptionLabel: 'Villain introduction' }} />
						{:else if section.key === 'mythic_action'}
							<LazyEditor label="Mythic" active={!inactive} loader={loadActionSectionEditor} componentProps={{ target: 'mythic_action', sectionTitle: 'Mythic', specialFlagKey: 'is_mythic', introDescriptionKey: 'mythic_description', introDescriptionLabel: 'Mythic introduction' }} />
						{/if}
					</div>
				{/each}
			{/snippet}
		</EditorWorkspace>
	</main>
	<AppFooter />
</div>
