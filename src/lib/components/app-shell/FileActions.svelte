<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Add01Icon,
		Delete01Icon,
		Download04Icon,
		FileImportIcon,
		Refresh04Icon,
		Upload01Icon
	} from '@hugeicons/core-free-icons';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Dialog } from '$lib/components/ui/dialog/index.js';
	import {
		currentMonster,
		monster,
		notice,
		replaceMonster,
		resetMonster,
		type Notice
	} from '$lib/state/monster-store';
	import { formatTomlWarning, isImportTooLarge, needsDraftConfirmation } from './file-actions';
	import { exportMonsterToml, filenameForMonster, importMonsterToml, type TomlWarning } from '$lib/monster/toml';

	let fileInput: HTMLInputElement;
	let confirmationOpen = $state(false);
	let pendingAction = $state<'new' | 'reset' | null>(null);
	let dragActive = $state(false);
	let importWarnings = $state<TomlWarning[]>([]);
	let draft = $derived($monster);

	function setNotice(value: Notice): void {
		notice.set(value);
	}

	function hasMeaningfulContent(): boolean {
		return needsDraftConfirmation(draft);
	}

	function openFilePicker(): void {
		fileInput?.click();
	}

	async function importFile(file: File | undefined): Promise<void> {
		if (!file) return;
		if (isImportTooLarge(file.size)) {
			setNotice({ kind: 'error', message: 'That TOML file is too large. Imports are limited to 5 MiB.' });
			return;
		}
		try {
			const result = importMonsterToml(await file.text());
			if (!result.ok) {
				setNotice({ kind: 'error', message: result.message });
				return;
			}
			replaceMonster(result.monster);
			importWarnings = result.warnings;
			const message = result.warnings.length === 0 ? 'Imported TOML successfully.' :
				`Imported TOML successfully. Warnings are available for review.`;
			setNotice({ kind: 'status', message });
		} catch {
			setNotice({ kind: 'error', message: 'Unable to read that file. The current draft is unchanged.' });
		} finally {
			if (fileInput) fileInput.value = '';
		}
	}

	function dismissImportWarnings(): void {
		importWarnings = [];
	}

	function onFileChange(event: Event): void {
		void importFile((event.currentTarget as HTMLInputElement).files?.[0]);
	}

	function onDrop(event: DragEvent): void {
		event.preventDefault();
		dragActive = false;
		void importFile(event.dataTransfer?.files?.[0]);
	}

	function exportFile(): void {
		const value = currentMonster();
		const blob = new Blob([exportMonsterToml(value)], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = filenameForMonster(value);
		anchor.click();
		window.setTimeout(() => URL.revokeObjectURL(url), 0);
		setNotice({ kind: 'status', message: `Exported ${anchor.download}.` });
	}

	function applyNewDraft(): void {
		resetMonster();
		importWarnings = [];
		setNotice({ kind: 'status', message: 'Started a new monster draft.' });
	}

	function requestDraftAction(action: 'new' | 'reset'): void {
		if (hasMeaningfulContent()) {
			pendingAction = action;
			confirmationOpen = true;
		} else if (action === 'new') {
			applyNewDraft();
		} else {
			resetMonster();
			importWarnings = [];
			setNotice({ kind: 'status', message: 'Draft reset to the default monster.' });
		}
	}

	function cancelDraftAction(): void {
		confirmationOpen = false;
		pendingAction = null;
	}

	function confirmDraftAction(): void {
		const action = pendingAction;
		cancelDraftAction();
		if (action === 'new') applyNewDraft();
		else if (action === 'reset') {
			resetMonster();
			importWarnings = [];
			setNotice({ kind: 'status', message: 'Draft reset to the default monster.' });
		}
	}
</script>

<label class="sr-only" for="monster-file-input">Import TOML file</label>
<input id="monster-file-input" name="monster-file" bind:this={fileInput} class="sr-only" type="file" accept=".toml,text/plain" onchange={onFileChange} />

<div class="file-actions" role="group" aria-label="File actions">
	<div class="file-actions__buttons">
		<Button.Root class="shell-button shell-button--accent" type="button" aria-label="New" onclick={() => requestDraftAction('new')}>
			<HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={2} />
			<span>New</span>
		</Button.Root>
		<Button.Root class="shell-button" type="button" aria-label="Import" onclick={openFilePicker}>
			<HugeiconsIcon icon={FileImportIcon} size={15} strokeWidth={2} />
			<span>Import</span>
		</Button.Root>
		<Button.Root class="shell-button" type="button" aria-label="Export" onclick={exportFile}>
			<HugeiconsIcon icon={Download04Icon} size={15} strokeWidth={2} />
			<span>Export</span>
		</Button.Root>
		<Button.Root class="shell-button shell-button--quiet" type="button" aria-label="Reset" onclick={() => requestDraftAction('reset')} title="Reset current draft">
			<HugeiconsIcon icon={Refresh04Icon} size={15} strokeWidth={2} />
			<span>Reset</span>
		</Button.Root>
	</div>

	<button
		class:drop-target--active={dragActive}
		class="drop-target"
		type="button"
		onclick={openFilePicker}
		ondragover={(event) => { event.preventDefault(); dragActive = true; }}
		ondragleave={() => (dragActive = false)}
		ondrop={onDrop}
		aria-label="Drop a TOML file here or browse to import"
	>
		<HugeiconsIcon icon={Upload01Icon} size={15} strokeWidth={1.8} />
		<span>Drop TOML</span>
	</button>
</div>

<div class="notice-region" data-testid="notice-region" aria-live="polite" aria-atomic="true">
	{#if $notice}
		<span class:error={$notice.kind === 'error'} class="notice">{$notice.message}</span>
	{/if}
	{#if importWarnings.length > 0}
		<section class="notice notice--warnings" role="alert" aria-labelledby="import-warnings-heading" data-testid="import-warnings">
			<div class="notice__heading">
				<strong id="import-warnings-heading">Import warnings</strong>
				<button class="shell-button shell-button--quiet" type="button" onclick={dismissImportWarnings}>Dismiss warnings</button>
			</div>
			<ul>
				{#each importWarnings as warning}
					<li aria-label={formatTomlWarning(warning)}><code aria-hidden="true">{warning.path}</code><span aria-hidden="true">: {warning.message}</span></li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<Dialog.Root bind:open={confirmationOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="shell-dialog-overlay" />
		<Dialog.Content class="shell-dialog">
			<Dialog.Title>{pendingAction === 'new' ? 'Start a new draft?' : 'Reset this draft?'}</Dialog.Title>
			<Dialog.Description>This replaces the current monster with a fresh default draft. This cannot be undone.</Dialog.Description>
			<div class="shell-dialog__actions">
				<Dialog.Close class="shell-button" type="button" onclick={cancelDraftAction}>Cancel</Dialog.Close>
				<Button.Root class="shell-button shell-button--danger" type="button" onclick={confirmDraftAction}>
					<HugeiconsIcon icon={Delete01Icon} size={15} strokeWidth={2} />
					{pendingAction === 'new' ? 'Start new draft' : 'Reset draft'}
				</Button.Root>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
