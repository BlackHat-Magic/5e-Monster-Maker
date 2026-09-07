<script lang="ts">
	import { tick } from 'svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Add01Icon,
		Delete01Icon,
		Download04Icon,
		FileImportIcon
	} from '@hugeicons/core-free-icons';
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
	import type { TomlWarning } from '$lib/monster/toml';
	import { EXPORT_FORMATS, exportContentBlob, exportFilename, hasCanvasEncoder, type ExportFormatKey, type RasterExportFormat } from '$lib/monster/export';
	import { loadExportRendererModule, loadTomlModule } from '$lib/state/deferred-resources';

	let fileInput: HTMLInputElement;
	let dialogOpen = $state(false);
	let dialogMode = $state<'new' | 'export' | null>(null);
	let selectedExportFormat = $state<ExportFormatKey>('png');
	let exportTheme = $state<StatBlockThemeKey>($previewTheme);
	let supportedRasterFormats = $state<Record<RasterExportFormat, boolean>>({ png: true, webp: false, avif: false });
	let exporting = $state(false);
	let importing = $state(false);
	let pendingAction = $state<'new' | null>(null);
	let importWarnings = $state<TomlWarning[]>([]);
	let draft = $derived($monster);
	let importSequence = 0;
	let exportSequence = 0;
	let destroyed = false;
	let exportError = $state<string | null>(null);
	let exportController: AbortController | undefined;
	let dialogNode = $state<HTMLDivElement | null>(null);
	let previouslyFocused: HTMLElement | null = null;

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
		importing = true;
		try {
			// Read the file while the deferred TOML chunk loads so neither waits on the other.
			const [text, toml] = await Promise.all([file.text(), loadTomlModule()]);
			if (destroyed || request !== importSequence) return;
			const result = toml.importMonsterToml(text);
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
			if (!destroyed && request === importSequence) {
				importing = false;
				if (sourceInput) sourceInput.value = '';
			}
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
				const { exportMonsterToml, filenameForMonster } = await loadTomlModule();
				if (destroyed || request !== exportSequence) return;
				content = exportMonsterToml(value);
				mime = 'application/toml';
				filename = filenameForMonster(value);
			} else {
				const preview = document.querySelector<HTMLElement>('.stat-block');
				if (!preview) throw new Error('The stat block preview is not available. Open the preview before exporting.');
				const width = preview.getBoundingClientRect().width;
				if (!Number.isFinite(width) || width <= 0) throw new Error('The stat block preview has no measurable width.');
				const { renderVisualExport } = await loadExportRendererModule();
				if (destroyed || request !== exportSequence) return;
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

	function dialogFocusables(): HTMLElement[] {
		if (!dialogNode) return [];
		const candidates = [...dialogNode.querySelectorAll<HTMLElement>(
			'button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
		)];
		return candidates.filter((element) => element.tabIndex >= 0);
	}

	function focusDialog(): void {
		// Bespoke modal: move focus inside on open (mirrors the previous dialog
		// primitive's autofocus) and trap Tab while open.
		previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const first = dialogFocusables()[0];
		if (first) first.focus({ preventScroll: true });
		else dialogNode?.focus({ preventScroll: true });
	}

	function restoreDialogFocus(): void {
		previouslyFocused?.focus({ preventScroll: true });
		previouslyFocused = null;
	}

	function handleDialogKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			if (dialogMode === 'export' && exporting) {
				event.preventDefault();
				return;
			}
			event.preventDefault();
			closeDialog();
			return;
		}
		if (event.key !== 'Tab' || !dialogNode) return;
		const stops = dialogFocusables();
		if (stops.length === 0) {
			event.preventDefault();
			return;
		}
		const currentIndex = stops.indexOf(document.activeElement as HTMLElement);
		if (event.shiftKey && (currentIndex <= 0)) {
			event.preventDefault();
			stops[stops.length - 1]?.focus({ preventScroll: true });
		} else if (!event.shiftKey && (currentIndex === stops.length - 1 || currentIndex < 0)) {
			event.preventDefault();
			stops[0]?.focus({ preventScroll: true });
		}
	}

	function handleOverlayPointerDown(event: PointerEvent): void {
		if (event.target !== event.currentTarget) return;
		closeDialog();
	}

	$effect(() => {
		if (!dialogOpen) return;
		// Wait a tick so the dialog node is mounted before focusing.
		let cancelled = false;
		void tick().then(() => {
			if (!cancelled) focusDialog();
		});
		return () => {
			cancelled = true;
			restoreDialogFocus();
		};
	});

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

<div class="file-actions flex items-center gap-2.5 max-[920px]:grow max-[920px]:basis-full max-[920px]:justify-between" role="group" aria-label="File actions">
	<div class="file-actions__buttons flex items-center gap-1 max-[560px]:flex-1">
		<button class="shell-button shell-button--accent max-[560px]:flex-1 max-[560px]:px-[7px] inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 border border-border bg-card px-[13px] font-display text-[0.76rem] font-bold tracking-[0.02em] text-foreground" type="button" aria-label="New" onclick={requestDraftAction}>
			<HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={2} />
			<span class="max-[560px]:hidden">New</span>
		</button>
		<button class="shell-button max-[560px]:flex-1 max-[560px]:px-[7px] inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 border border-border bg-card px-[13px] font-display text-[0.76rem] font-bold tracking-[0.02em] text-foreground" type="button" aria-label="Import" disabled={importing} onclick={openFilePicker}>
			<HugeiconsIcon icon={FileImportIcon} size={15} strokeWidth={2} />
			<span class="max-[560px]:hidden">Import</span>
		</button>
		<button class="shell-button max-[560px]:flex-1 max-[560px]:px-[7px] inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 border border-border bg-card px-[13px] font-display text-[0.76rem] font-bold tracking-[0.02em] text-foreground" type="button" aria-label="Export" onclick={openExportDialog}>
			<HugeiconsIcon icon={Download04Icon} size={15} strokeWidth={2} />
			<span class="max-[560px]:hidden">Export</span>
		</button>
	</div>
</div>
<ToastHost warnings={importWarnings} onDismissWarnings={dismissImportWarnings} />

{#if dialogOpen}
	<!-- Bespoke modal replacing the dialog primitive: same classes, roles and
	close semantics (Escape / overlay click blocked only while exporting). -->
	<div class="shell-dialog-overlay fixed inset-0 z-[100] bg-[color-mix(in_srgb,var(--foreground)_48%,transparent)]" aria-hidden="true" onpointerdown={handleOverlayPointerDown}></div>
	<div
		class={`shell-dialog fixed left-1/2 top-1/2 z-[101] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 border border-border bg-card p-6 shadow-[14px_14px_0_color-mix(in_srgb,var(--foreground)_12%,transparent)]${dialogMode === 'export' ? ' w-[min(560px,calc(100vw-32px))]' : ''}`}
		role="dialog"
		aria-modal="true"
		aria-labelledby={dialogMode === 'export' ? 'export-title' : 'new-draft-title'}
		aria-describedby={dialogMode === 'export' ? 'export-description' : 'new-draft-description'}
		tabindex={-1}
		bind:this={dialogNode}
		onkeydown={handleDialogKeydown}
	>
			{#if dialogMode === 'export'}
				<h2 id="export-title" class="m-0 font-display text-[1.25rem]">Export stat block</h2>
				<p id="export-description" class="text-[0.86rem] leading-[1.5] text-muted-foreground">
					Choose a file format and the stat-block theme for this export.
					{#if exportError}
						<span id="export-error" class="mt-3 block border border-accent border-l-4 bg-[color-mix(in_srgb,var(--accent)_9%,var(--card))] px-3 py-2.5 text-[0.78rem] leading-[1.45] text-foreground" role="alert">Unable to export stat block: {exportError}</span>
					{/if}
				</p>
				<div class="mt-5 grid gap-4">
					<div class="grid gap-1.5">
						<span id="export-format-label" class="font-display text-[0.72rem] font-extrabold">Format</span>
						<div class="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 max-[500px]:grid-cols-[repeat(2,minmax(0,1fr))]" role="radiogroup" aria-labelledby="export-format-label">
							{#each EXPORT_FORMATS as format}
								<button
									class="export-dialog__format min-h-10 cursor-pointer border border-border bg-card font-display text-[0.72rem] font-extrabold text-foreground hover:border-accent hover:bg-muted disabled:cursor-not-allowed disabled:opacity-[0.38]"
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
								<span id={`export-format-help-${format.key}`} class="col-span-full m-0 cursor-help border-0 bg-transparent p-0 text-left text-[0.72rem] leading-[1.4] text-muted-foreground" data-export-format-help={format.key}>{help}</span>
							{/if}
						{/each}
					</div>
					<div class="grid gap-1.5">
						<label for="export-theme" class="font-display text-[0.72rem] font-extrabold">Export theme</label>
						<select id="export-theme" class="min-h-10 border border-border bg-card px-2.5 text-foreground" aria-label="Export theme" bind:value={exportTheme} disabled={exporting}>
							{#each STAT_BLOCK_THEME_KEYS as key}
								<option value={key}>{statBlockThemeByKey[key].label}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="mt-6 flex justify-end gap-2 max-[500px]:flex-col-reverse">
					<button class="shell-button max-[560px]:flex-1 max-[560px]:px-[7px] max-[500px]:w-full inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 border border-border bg-card px-[13px] font-display text-[0.76rem] font-bold tracking-[0.02em] text-foreground" type="button" data-export-cancel disabled={exporting} onclick={cancelExport}>Cancel</button>
					<button class="shell-button shell-button--accent max-[560px]:flex-1 max-[560px]:px-[7px] max-[500px]:w-full inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 border border-border bg-card px-[13px] font-display text-[0.76rem] font-bold tracking-[0.02em] text-foreground" type="button" data-export-confirm disabled={exporting || !isSelectedFormatAvailable()} onclick={confirmExport}>
						{exporting ? 'Exporting...' : 'Export'}
					</button>
				</div>
			{:else}
				<h2 id="new-draft-title" class="m-0 font-display text-[1.25rem]">Start a new draft?</h2>
				<p id="new-draft-description" class="text-[0.86rem] leading-[1.5] text-muted-foreground">This replaces the current monster with a fresh default draft. This cannot be undone.</p>
				<div class="mt-6 flex justify-end gap-2">
					<button class="shell-button max-[560px]:flex-1 max-[560px]:px-[7px] inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 border border-border bg-card px-[13px] font-display text-[0.76rem] font-bold tracking-[0.02em] text-foreground" type="button" onclick={cancelDraftAction}>Cancel</button>
					<button class="shell-button shell-button--danger max-[560px]:flex-1 max-[560px]:px-[7px] inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 border border-border bg-card px-[13px] font-display text-[0.76rem] font-bold tracking-[0.02em] text-foreground" type="button" onclick={confirmDraftAction}>
						<HugeiconsIcon icon={Delete01Icon} size={15} strokeWidth={2} />
						Start new draft
					</button>
				</div>
			{/if}
	</div>
{/if}
