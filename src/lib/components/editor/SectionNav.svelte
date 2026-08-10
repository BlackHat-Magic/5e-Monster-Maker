<script lang="ts">
  import { onMount } from 'svelte';
 import { HugeiconsIcon } from '@hugeicons/svelte';
 import { Cancel01Icon, Menu01Icon } from '@hugeicons/core-free-icons';
  import { monster, requestSectionScroll, selectedSection } from '$lib/state/monster-store';
 import type { EditorSection } from '$lib/monster/types';
 import { EDITOR_SECTIONS, editorPanelId, editorTabId, sectionNavigationTarget, type SectionNavigationKey } from './editor-core';

 let active = $derived($selectedSection);
 let mobileOpen = $state(false);
 let mobileMode = $state(false);
 let coarsePointer = $state(false);
 let pointerOpen = $state(false);
 let railOpen = $derived(mobileMode ? mobileOpen : pointerOpen);
 let navElement: HTMLElement | undefined;
  let toggleElement = $state<HTMLButtonElement | undefined>();

 onMount(() => {
    const pointerQuery = window.matchMedia('(pointer: coarse)');
    const hoverQuery = window.matchMedia('(hover: none)');
   const finePointerQuery = window.matchMedia('(pointer: fine)');
    const mobileQuery = window.matchMedia('(max-width: 820px)');
     const updateInputMode = () => {
    // Touch capability augments media signals only when no fine pointer exists.
    const nextCoarsePointer = pointerQuery.matches || hoverQuery.matches || (navigator.maxTouchPoints > 0 && !finePointerQuery.matches);
    const nextMobileMode = mobileQuery.matches;
    coarsePointer = nextCoarsePointer;
    mobileMode = nextMobileMode;
    pointerOpen = false;
    if (!nextMobileMode) mobileOpen = false;
    };
    updateInputMode();
    pointerQuery.addEventListener('change', updateInputMode);
    hoverQuery.addEventListener('change', updateInputMode);
   finePointerQuery.addEventListener('change', updateInputMode);
   mobileQuery.addEventListener('change', updateInputMode);
    return () => {
     pointerQuery.removeEventListener('change', updateInputMode);
     hoverQuery.removeEventListener('change', updateInputMode);
    finePointerQuery.removeEventListener('change', updateInputMode);
     mobileQuery.removeEventListener('change', updateInputMode);
    };
   });

 function countFor(section: EditorSection): number | undefined {
  const counts: Partial<Record<EditorSection, number>> = {
   language: $monster.language?.length ?? 0,
   traits: $monster.ability?.length ?? 0,
   action: $monster.action?.length ?? 0,
   bonus_action: $monster.bonus_action?.length ?? 0,
   reaction: $monster.reaction?.length ?? 0,
   legendary_action: $monster.legendary_action?.length ?? 0,
   villain_action: $monster.villain_action?.length ?? 0,
   mythic_action: $monster.mythic_action?.length ?? 0,
  };
  return counts[section];
 }

  function selectSection(key: EditorSection): void {
    if (active === key) requestSectionScroll();
    else selectedSection.set(key);
   if (mobileMode) mobileOpen = false;
  }

 function toggleRail(): void {
  if (mobileMode) mobileOpen = !mobileOpen;
  else pointerOpen = !pointerOpen;
 }

 function handlePointerEnter(): void {
  if (!mobileMode && !coarsePointer) pointerOpen = true;
 }

  function handlePointerLeave(): void {
   if (!mobileMode && !coarsePointer) pointerOpen = false;
  }

 function railTabStops(): HTMLElement[] {
  if (!navElement) return [];
  return Array.from(navElement.querySelectorAll<HTMLElement>('button:not([disabled])'))
   .filter((element) => element.tabIndex >= 0);
 }

 function closeMobileRail(restoreFocus = false): void {
  if (!mobileMode || !mobileOpen) return;
  mobileOpen = false;
  if (restoreFocus) toggleElement?.focus({ preventScroll: true });
 }

 function handleRailKeydown(event: KeyboardEvent): void {
  if (!mobileMode || !mobileOpen) return;
  if (event.key === 'Escape') {
   event.preventDefault();
   closeMobileRail(true);
   return;
  }
  if (event.key !== 'Tab') return;

  const tabStops = railTabStops();
  if (tabStops.length === 0) return;
  const currentIndex = tabStops.indexOf(document.activeElement as HTMLElement);
  if (currentIndex < 0) {
   event.preventDefault();
   tabStops[event.shiftKey ? tabStops.length - 1 : 0]?.focus({ preventScroll: true });
   return;
  }

  const nextIndex = event.shiftKey
   ? (currentIndex - 1 + tabStops.length) % tabStops.length
   : (currentIndex + 1) % tabStops.length;
  if (nextIndex === 0 || nextIndex === tabStops.length - 1 || tabStops.length === 2) {
   event.preventDefault();
   tabStops[nextIndex]?.focus({ preventScroll: true });
  }
 }

 function handleKeydown(event: KeyboardEvent, section: { key: EditorSection }): void {
  if (!['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = sectionNavigationTarget(EDITOR_SECTIONS, section.key, event.key as SectionNavigationKey);
  if (!next) return;
   selectSection(next.key);
  document.getElementById(editorTabId(next.key))?.focus();
 }
</script>

 <svelte:window onkeydown={handleRailKeydown} />

 <nav
  bind:this={navElement}
  class="section-nav"
  class:section-nav--mobile-mode={mobileMode}
  class:section-nav--open={railOpen}
  class:section-nav--pointer-open={pointerOpen}
  onpointerenter={handlePointerEnter}
  onpointerleave={handlePointerLeave}
  aria-label="Monster sections"
 >
  {#if mobileMode}
   <button
    bind:this={toggleElement}
    class="section-nav__toggle"
    type="button"
    aria-expanded={railOpen}
    aria-label={railOpen ? 'Collapse sections' : 'Expand sections'}
    title={railOpen ? 'Collapse sections' : 'Expand sections'}
    onclick={toggleRail}
   >
    <HugeiconsIcon icon={railOpen ? Cancel01Icon : Menu01Icon} size={19} strokeWidth={1.8} aria-hidden="true" />
   </button>
  {/if}

 <div id="section-navigation-list" class="section-nav__groups" role="tablist" aria-orientation="vertical">
  <ul>
   {#each EDITOR_SECTIONS as section}
    {@const count = countFor(section.key)}
    <li>
     <button
      id={editorTabId(section.key)}
      aria-controls={editorPanelId(section.key)}
      aria-label={section.label}
      title={section.label}
      class:section-nav__item--active={active === section.key}
      class="section-nav__item"
      type="button"
      role="tab"
      aria-selected={active === section.key}
      tabindex={active === section.key ? 0 : -1}
       onclick={() => selectSection(section.key)}
      onkeydown={(event) => handleKeydown(event, section)}
     >
      <HugeiconsIcon icon={section.icon} size={18} strokeWidth={1.8} aria-hidden="true" />
      <span class="section-nav__label">{section.label}</span>
      {#if count !== undefined}<span class="section-nav__count" aria-hidden="true">{count.toString().padStart(2, '0')}</span>{/if}
     </button>
    </li>
   {/each}
  </ul>
 </div>
</nav>

<style>
 .section-nav { position: fixed; z-index: 55; top: var(--app-header-height, 88px); bottom: 0; left: 0; display: grid; align-content: start; width: var(--section-rail-collapsed-width); max-width: calc(100vw - 16px); gap: 14px; overflow-x: hidden; overflow-y: auto; border-right: 1px solid var(--border); background: color-mix(in srgb, var(--card) 94%, var(--bg)); padding: 16px 8px 22px; box-shadow: 8px 0 20px color-mix(in srgb, var(--foreground) 5%, transparent); transition: width 180ms ease; }
 .section-nav--pointer-open { width: min(var(--section-rail-expanded-width), calc(100vw - 16px)); }
 .section-nav__toggle { display: grid; width: 40px; height: 38px; place-items: center; border: 1px solid var(--border); background: transparent; color: var(--muted-foreground); cursor: pointer; }
 .section-nav__toggle:hover { border-color: var(--accent); color: var(--foreground); }
 .section-nav__groups, .section-nav ul { min-width: 0; }
 .section-nav ul { display: grid; gap: 3px; margin: 0; padding: 0; list-style: none; }
 .section-nav__item { display: flex; width: 100%; min-height: 40px; align-items: center; justify-content: flex-start; gap: 11px; border: 1px solid transparent; border-left: 3px solid transparent; padding: 8px 8px 8px 9px; background: transparent; color: var(--muted-foreground); cursor: pointer; text-align: left; }
 .section-nav__item:hover { border-color: var(--border); color: var(--foreground); }
 .section-nav__item--active { border-color: var(--border); border-left-color: var(--accent); background: var(--card); color: var(--foreground); font-weight: 750; box-shadow: 5px 5px 0 color-mix(in srgb, var(--foreground) 5%, transparent); }
 .section-nav__item :global(svg) { flex: 0 0 auto; }
 .section-nav__label { min-width: 0; max-width: 0; overflow: hidden; opacity: 0; white-space: nowrap; transition: max-width 160ms ease, opacity 120ms ease; }
 .section-nav--pointer-open .section-nav__label, .section-nav--mobile-mode.section-nav--open .section-nav__label { max-width: 170px; opacity: 1; }
 .section-nav__count { margin-left: auto; color: var(--accent); font-family: var(--font-display); font-size: 0.64rem; font-weight: 800; }
 @media (prefers-reduced-motion: reduce) { .section-nav, .section-nav__label { transition: none; } }
 @media (max-width: 820px) { .section-nav__toggle { width: 36px; } .section-nav { width: var(--section-rail-collapsed-width); padding-inline: 7px; } }
 .section-nav--mobile-mode.section-nav--open { width: 100vw; max-width: 100vw; height: calc(100dvh - var(--app-header-height, 88px)); bottom: auto; padding-inline: 16px; }
</style>
