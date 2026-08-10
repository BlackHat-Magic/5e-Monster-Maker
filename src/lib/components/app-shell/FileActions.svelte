<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Add01Icon,
		Delete01Icon,
		Download04Icon,
		FileImportIcon
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
	import ToastHost from './ToastHost.svelte';
	import { isImportTooLarge, needsDraftConfirmation } from './file-actions';
	import { exportMonsterToml, filenameForMonster, importMonsterToml, type TomlWarning } from '$lib/monster/toml';

	let fileInput: HTMLInputElement;
	let confirmationOpen = $state(false);
	let pendingAction = $state<'new' | null>(null);
	let importWarnings = $state<TomlWarning[]>([]);
	let draft = $derived($monster);
	let importSequence = 0;

	function setNotice(value: Notice): void {
		notice.set(value);
	}

	function hasMeaningfulContent(): boolean {
		return needsDraftConfirmation(draft);
	}

	function openFilePicker(): void {
		fileInput?.click();
	}

	async function importFile(file: File | undefined, sourceInput = fileInput): Promise<void> {
		if (!file) return;
		const request = ++importSequence;
		importWarnings = [];
		if (isImportTooLarge(file.size)) {
			if (sourceInput) sourceInput.value = '';
			setNotice({ kind: 'error', message: 'That TOML file is too large. Imports are limited to 5 MiB.' });
			return;
		}
		try {
			const text = await file.text();
			if (request !== importSequence) return;
			const result = importMonsterToml(text);
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
			if (request !== importSequence) return;
			setNotice({ kind: 'error', message: 'Unable to read that file. The current draft is unchanged.' });
		} finally {
			if (request === importSequence && sourceInput) sourceInput.value = '';
		}
	}

	function dismissImportWarnings(): void {
		importWarnings = [];
	}

	function onFileChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		void importFile(input.files?.[0], input);
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
		importSequence += 1;
		resetMonster();
		importWarnings = [];
		setNotice({ kind: 'status', message: 'Started a new monster draft.' });
	}

	function requestDraftAction(): void {
		if (hasMeaningfulContent()) {
			pendingAction = 'new';
			confirmationOpen = true;
		} else {
			applyNewDraft();
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
	}
</script>

<label class="sr-only" for="monster-file-input">Import TOML file</label>
<input id="monster-file-input" name="monster-file" bind:this={fileInput} class="sr-only" type="file" accept=".toml,text/plain" onchange={onFileChange} />

<div class="file-actions" role="group" aria-label="File actions">
	<div class="file-actions__buttons">
		<Button.Root class="shell-button shell-button--accent" type="button" aria-label="New" onclick={requestDraftAction}>
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
	</div>
</div>
<ToastHost warnings={importWarnings} onDismissWarnings={dismissImportWarnings} />

<Dialog.Root bind:open={confirmationOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="shell-dialog-overlay" />
		<Dialog.Content class="shell-dialog">
			<Dialog.Title>Start a new draft?</Dialog.Title>
			<Dialog.Description>This replaces the current monster with a fresh default draft. This cannot be undone.</Dialog.Description>
			<div class="shell-dialog__actions">
				<Dialog.Close class="shell-button" type="button" onclick={cancelDraftAction}>Cancel</Dialog.Close>
				<Button.Root class="shell-button shell-button--danger" type="button" onclick={confirmDraftAction}>
					<HugeiconsIcon icon={Delete01Icon} size={15} strokeWidth={2} />
					Start new draft
				</Button.Root>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
