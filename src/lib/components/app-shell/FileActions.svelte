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
	import { previewTheme } from '$lib/state/theme-store';
	import { STAT_BLOCK_THEME_KEYS, statBlockThemeByKey, type StatBlockThemeKey } from '$lib/theme/stat-block-themes';
	import ToastHost from './ToastHost.svelte';
	import { isImportTooLarge, needsDraftConfirmation } from './file-actions';
	import { exportMonsterToml, filenameForMonster, importMonsterToml, type TomlWarning } from '$lib/monster/toml';
	import { EXPORT_FORMATS, exportContentBlob, exportFilename, hasCanvasEncoder, type ExportFormatKey, type RasterExportFormat } from '$lib/monster/export';
	import { renderVisualExport } from '$lib/monster/export-renderer';

	let fileInput: HTMLInputElement;
	let dialogOpen = $state(false);
	let dialogMode = $state<'new' | 'export' | null>(null);
	let selectedExportFormat = $state<ExportFormatKey>('png');
	let exportTheme = $state<StatBlockThemeKey>($previewTheme);
	let supportedRasterFormats = $state<Record<RasterExportFormat, boolean>>({ png: true, webp: false, avif: false });
	let exporting = $state(false);
	let pendingAction = $state<'new' | null>(null);
	let importWarnings = $state<TomlWarning[]>([]);
	let draft = $derived($monster);
	let importSequence = 0;
	let exportSequence = 0;
	let destroyed = false;
	let exportError = $state<string | null>(null);
	let exportController: AbortController | undefined;

	$effect(() => () => {
		destroyed = true;
		importSequence += 1;
		exportSequence += 1;
		exportController?.abort();
	});

	function setNotice(value: Notice): void {
		if (destroyed) return;
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
			if (destroyed || request !== importSequence) return;
			const result = importMonsterToml(text);
			if (!result.ok) {
				setNotice({ kind: 'error', message: result.message });
				return;
			}
			const persisted = replaceMonster(result.monster);
			importWarnings = result.warnings;
			if (!persisted) return;
			const message = result.warnings.length === 0 ? 'Imported TOML successfully.' :
				`Imported TOML successfully. Warnings are available for review.`;
			setNotice({ kind: 'status', message });
		} catch {
			if (destroyed || request !== importSequence) return;
			setNotice({ kind: 'error', message: 'Unable to read that file. The current draft is unchanged.' });
		} finally {
			if (!destroyed && request === importSequence && sourceInput) sourceInput.value = '';
		}
	}

	function dismissImportWarnings(): void {
		importWarnings = [];
	}

	function onFileChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		void importFile(input.files?.[0], input);
	}

	function isExportFormatKey(value: string | null): value is ExportFormatKey {
		return EXPORT_FORMATS.some((format) => format.key === value);
	}

	function storedExportFormat(): ExportFormatKey {
		try {
			const stored = window.localStorage.getItem('monster-maker.export-format');
			return isExportFormatKey(stored) ? stored : 'png';
		} catch {
			setNotice({ kind: 'error', message: 'Unable to read the saved export format. PNG was selected.' });
			return 'png';
		}
	}

	function openExportDialog(): void {
		exportError = null;
		const storedFormat = storedExportFormat();
		exportTheme = $previewTheme;
		supportedRasterFormats = {
			png: true,
			webp: hasCanvasEncoder('image/webp'),
			avif: hasCanvasEncoder('image/avif'),
		};
		selectedExportFormat = (storedFormat === 'webp' || storedFormat === 'avif') && !supportedRasterFormats[storedFormat]
			? 'png'
			: storedFormat;
		dialogMode = 'export';
		dialogOpen = true;
	}

	function selectExportFormat(format: ExportFormatKey): void {
		if (exporting) return;
		const definition = EXPORT_FORMATS.find((item) => item.key === format);
		if (!definition?.raster || supportedRasterFormats[format as RasterExportFormat]) selectedExportFormat = format;
	}

	function availableExportFormats(): ExportFormatKey[] {
		return EXPORT_FORMATS
			.filter((format) => exportFormatHelp(format.key) === null)
			.map((format) => format.key);
	}

	function handleExportFormatKeydown(event: KeyboardEvent): void {
		if (exporting) return;
		if (!['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home'].includes(event.key)) return;
		const current = (event.currentTarget as HTMLButtonElement).dataset.exportFormat as ExportFormatKey | undefined;
		const formats = availableExportFormats();
		if (!current || formats.length === 0) return;
		const currentIndex = formats.indexOf(current);
		if (currentIndex < 0) return;

		let nextIndex = currentIndex;
		if (event.key === 'Home') nextIndex = 0;
		else if (event.key === 'End') nextIndex = formats.length - 1;
		else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % formats.length;
		else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + formats.length) % formats.length;

		event.preventDefault();
		const next = formats[nextIndex];
		selectExportFormat(next);
		document.querySelector<HTMLButtonElement>(`[data-export-format="${next}"]`)?.focus();
	}

	function isSelectedFormatAvailable(): boolean {
		const definition = EXPORT_FORMATS.find((format) => format.key === selectedExportFormat);
		return Boolean(definition && (!definition.raster || supportedRasterFormats[selectedExportFormat as RasterExportFormat]));
	}

	function exportFormatHelp(format: ExportFormatKey): string | null {
		const definition = EXPORT_FORMATS.find((item) => item.key === format);
		if (!definition?.raster || supportedRasterFormats[format as RasterExportFormat]) return null;
		return `This browser cannot encode ${definition.label}.`;
	}

	function downloadExport(content: string, mime: string, filename: string): void {
		const blob = exportContentBlob(content, mime);
		const url = URL.createObjectURL(blob);
		try {
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = filename;
			try {
				document.body.append(anchor);
				anchor.click();
			} finally {
				anchor.remove();
			}
		} finally {
			window.setTimeout(() => URL.revokeObjectURL(url), 0);
		}
	}

	async function confirmExport(): Promise<void> {
		if (exporting || !isSelectedFormatAvailable()) return;
		exportController?.abort();
		const controller = new AbortController();
		exportController = controller;
		const request = ++exportSequence;
		exporting = true;
		exportError = null;
		const format = selectedExportFormat;
		const theme = exportTheme;
		try {
			const value = currentMonster();
			let content: string;
			let mime: string;
			let filename: string;
			if (format === 'toml') {
				content = exportMonsterToml(value);
				mime = 'application/toml';
				filename = filenameForMonster(value);
			} else {
				const preview = document.querySelector<HTMLElement>('.stat-block');
				if (!preview) throw new Error('The stat block preview is not available. Open the preview before exporting.');
				const width = preview.getBoundingClientRect().width;
				if (!Number.isFinite(width) || width <= 0) throw new Error('The stat block preview has no measurable width.');
				const rendered = await renderVisualExport({ monster: value, theme, format, previewWidth: width, signal: controller.signal });
				if (destroyed || request !== exportSequence) return;
				content = rendered.content;
				mime = rendered.mime;
				filename = exportFilename(value, format);
			}

			downloadExport(content, mime, filename);
			let persistenceFailed = false;
			try {
				window.localStorage.setItem('monster-maker.export-format', format);
			} catch {
				persistenceFailed = true;
			}
			setNotice(persistenceFailed
				? { kind: 'error', message: `Exported ${filename}, but the selected format could not be saved.` }
				: { kind: 'status', message: `Exported ${filename}.` });
			dialogMode = null;
			dialogOpen = false;
		} catch (error) {
			if (destroyed || request !== exportSequence) return;
			const message = error instanceof Error ? error.message : 'The export could not be completed.';
			exportError = message;
			setNotice({ kind: 'error', message: `Unable to export stat block: ${message}` });
		} finally {
			if (exportController === controller) exportController = undefined;
			if (!destroyed && request === exportSequence) exporting = false;
		}
	}

	function cancelExport(): void {
		if (exporting) return;
		dialogMode = null;
		dialogOpen = false;
	}

	function closeDialog(): void {
		if (dialogMode === 'export' && exporting) {
			dialogOpen = true;
			return;
		}
		dialogMode = null;
		dialogOpen = false;
	}

	function preventActiveExportClose(event: Event): void {
		if (dialogMode === 'export' && exporting) event.preventDefault();
	}

	function applyNewDraft(): void {
		importSequence += 1;
		const persisted = resetMonster();
		importWarnings = [];
		if (!persisted) return;
		setNotice({ kind: 'status', message: 'Started a new monster draft.' });
	}

	function requestDraftAction(): void {
		if (hasMeaningfulContent()) {
			pendingAction = 'new';
			dialogMode = 'new';
			dialogOpen = true;
		} else {
			applyNewDraft();
		}
	}

	function cancelDraftAction(): void {
		dialogMode = null;
		dialogOpen = false;
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
		<Button.Root class="shell-button" type="button" aria-label="Export" onclick={openExportDialog}>
			<HugeiconsIcon icon={Download04Icon} size={15} strokeWidth={2} />
			<span>Export</span>
		</Button.Root>
	</div>
</div>
<ToastHost warnings={importWarnings} onDismissWarnings={dismissImportWarnings} />

{#if dialogOpen}
	<Dialog.Root open={true} onOpenChange={closeDialog}>
	<Dialog.Portal>
		<Dialog.Overlay class="shell-dialog-overlay" />
		<Dialog.Content
			class={`shell-dialog${dialogMode === 'export' ? ' export-dialog' : ''}`}
			onEscapeKeydown={preventActiveExportClose}
			onInteractOutside={preventActiveExportClose}
		>
			{#if dialogMode === 'export'}
				<Dialog.Title>Export stat block</Dialog.Title>
				<Dialog.Description id="export-description">
					Choose a file format and the stat-block theme for this export.
					{#if exportError}
						<span id="export-error" class="export-dialog__error" role="alert">Unable to export stat block: {exportError}</span>
					{/if}
				</Dialog.Description>
				<div class="export-dialog__fields">
					<div class="export-dialog__field">
						<span id="export-format-label">Format</span>
						<div class="export-dialog__formats" role="radiogroup" aria-labelledby="export-format-label">
							{#each EXPORT_FORMATS as format}
								<button
									class="export-dialog__format"
									class:export-dialog__format--active={selectedExportFormat === format.key}
									type="button"
									role="radio"
									data-export-format={format.key}
									aria-checked={selectedExportFormat === format.key}
									aria-describedby={exportFormatHelp(format.key) ? `export-format-help-${format.key}` : undefined}
									tabindex={selectedExportFormat === format.key ? 0 : -1}
									disabled={exporting || exportFormatHelp(format.key) !== null}
									title={exportFormatHelp(format.key) ?? `Export as ${format.label}`}
									onclick={() => selectExportFormat(format.key)}
									onkeydown={handleExportFormatKeydown}
								>
									{format.label}
								</button>
							{/each}
						</div>
						{#each EXPORT_FORMATS as format}
							{@const help = exportFormatHelp(format.key)}
							{#if help}
								<span id={`export-format-help-${format.key}`} class="export-dialog__help" data-export-format-help={format.key}>{help}</span>
							{/if}
						{/each}
					</div>
					<div class="export-dialog__field">
						<label for="export-theme">Export theme</label>
						<select id="export-theme" aria-label="Export theme" bind:value={exportTheme} disabled={exporting}>
							{#each STAT_BLOCK_THEME_KEYS as key}
								<option value={key}>{statBlockThemeByKey[key].label}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="export-dialog__actions">
					<Dialog.Close class="shell-button" type="button" data-export-cancel disabled={exporting} onclick={cancelExport}>Cancel</Dialog.Close>
					<Button.Root class="shell-button shell-button--accent" type="button" data-export-confirm disabled={exporting || !isSelectedFormatAvailable()} onclick={confirmExport}>
						{exporting ? 'Exporting...' : 'Export'}
					</Button.Root>
				</div>
			{:else}
				<Dialog.Title>Start a new draft?</Dialog.Title>
				<Dialog.Description>This replaces the current monster with a fresh default draft. This cannot be undone.</Dialog.Description>
				<div class="shell-dialog__actions">
					<Dialog.Close class="shell-button" type="button" onclick={cancelDraftAction}>Cancel</Dialog.Close>
					<Button.Root class="shell-button shell-button--danger" type="button" onclick={confirmDraftAction}>
						<HugeiconsIcon icon={Delete01Icon} size={15} strokeWidth={2} />
						Start new draft
					</Button.Root>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
{/if}
