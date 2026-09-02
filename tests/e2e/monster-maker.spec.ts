import { test, expect, type Download, type Locator, type Page } from '@playwright/test';

type BoundingBox = { x: number; y: number; width: number; height: number };
type ScrollCall = ScrollIntoViewOptions & {
	target: { tagName: string; id: string; className: string; text: string };
};
type PngChunk = { type: string; dataStart: number; length: number };

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function ascii(bytes: Uint8Array, start: number, length: number): string {
	return String.fromCharCode(...bytes.slice(start, start + length));
}

function crc32(bytes: Uint8Array, start: number, length: number): number {
	let crc = 0xffffffff;
	for (let index = start; index < start + length; index += 1) {
		crc ^= bytes[index];
		for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function readUint32(bytes: Uint8Array, offset: number): number {
	return bytes[offset] * 0x1000000 + bytes[offset + 1] * 0x10000 + bytes[offset + 2] * 0x100 + bytes[offset + 3];
}

function parsePng(bytes: Uint8Array): { chunks: PngChunk[]; width: number; height: number } {
	if (bytes.length < PNG_SIGNATURE.length || !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
		throw new Error('PNG signature is invalid');
	}

	const chunks: PngChunk[] = [];
	let offset = PNG_SIGNATURE.length;
	while (offset < bytes.length) {
		if (bytes.length - offset < 12) throw new Error('PNG chunk header or CRC is truncated');
		const length = readUint32(bytes, offset);
		const typeStart = offset + 4;
		const typeBytes = bytes.slice(typeStart, typeStart + 4);
		const type = String.fromCharCode(...typeBytes);
		if (!/^[A-Za-z]{4}$/.test(type)) throw new Error(`Invalid PNG chunk type: ${type}`);
		if (length > bytes.length - offset - 12) throw new Error(`PNG chunk ${type} exceeds the file bounds`);

		const dataStart = offset + 8;
		const crcOffset = dataStart + length;
		const expectedCrc = readUint32(bytes, crcOffset);
		const actualCrc = crc32(bytes, typeStart, 4 + length);
		if (actualCrc !== expectedCrc) throw new Error(`PNG chunk ${type} has an invalid CRC-32`);
		chunks.push({ type, dataStart, length });
		offset = crcOffset + 4;

		if (type === 'IEND') {
			if (length !== 0 || offset !== bytes.length) throw new Error('PNG IEND must be the final empty chunk');
			break;
		}
	}

	if (chunks.length === 0 || chunks.at(-1)?.type !== 'IEND') throw new Error('PNG is missing its final IEND chunk');
	if (chunks[0].type !== 'IHDR' || chunks.filter((chunk) => chunk.type === 'IHDR').length !== 1) {
		throw new Error('PNG must begin with exactly one IHDR chunk');
	}
	const ihdr = chunks[0];
	if (ihdr.length !== 13) throw new Error('PNG IHDR has an invalid length');
	const width = readUint32(bytes, ihdr.dataStart);
	const height = readUint32(bytes, ihdr.dataStart + 4);
	if (width <= 0 || height <= 0) throw new Error('PNG IHDR dimensions must be positive');
	return { chunks, width, height };
}

function assertWebp(bytes: Uint8Array): void {
	expect(bytes.length).toBeGreaterThanOrEqual(12);
	expect(ascii(bytes, 0, 4)).toBe('RIFF');
	expect(ascii(bytes, 8, 4)).toBe('WEBP');
}

function assertAvif(bytes: Uint8Array): void {
	expect(bytes.length).toBeGreaterThanOrEqual(16);
	expect(readUint32(bytes, 0)).toBeGreaterThanOrEqual(16);
	expect(readUint32(bytes, 0)).toBeLessThanOrEqual(bytes.length);
	expect(ascii(bytes, 4, 4)).toBe('ftyp');
	const brands = [ascii(bytes, 8, 4)];
	for (let offset = 16; offset + 4 <= Math.min(readUint32(bytes, 0), bytes.length); offset += 4) brands.push(ascii(bytes, offset, 4));
	expect(brands.some((brand) => brand === 'avif' || brand === 'avis')).toBe(true);
}

async function waitForStableBoundingBox(locator: Locator, settleFonts = false): Promise<BoundingBox> {
	if (settleFonts) {
		await locator.evaluate(async () => {
			if (document.fonts?.ready) await document.fonts.ready;
			await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
		});
	}
	let previous: BoundingBox | null = null;
	await expect.poll(async () => {
		const current = await locator.boundingBox();
		if (!current || !previous) {
			previous = current;
			return false;
		}
		const stable = ['x', 'y', 'width', 'height'].every((key) => Math.abs(current[key as keyof BoundingBox] - previous![key as keyof BoundingBox]) <= 0.5);
		previous = current;
		return stable;
	}).toBe(true);
	if (!previous) throw new Error('Expected a stable bounding box');
	return previous;
}

async function downloadBytes(download: Download): Promise<Uint8Array> {
	const stream = await download.createReadStream();
	const chunks: Uint8Array[] = [];
	let length = 0;
	for await (const chunk of stream as AsyncIterable<Uint8Array>) {
		chunks.push(chunk);
		length += chunk.byteLength;
	}
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

test.describe('monster authoring', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible({ timeout: 15000 });
	});

	test('round-trips an edited monster through TOML and rejects malformed imports', async ({ page }, testInfo) => {
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });
		const identityStrip = page.getByRole('region', { name: 'Identity', exact: true });
		const fileActions = page.getByRole('group', { name: 'File actions', exact: true });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await identityStrip.getByRole('textbox', { name: 'Name', exact: true }).fill('Cinder Warden');
		await editorPane.getByRole('tab', { name: 'Actions', exact: true }).click();
		const actionsPanel = editorPane.getByRole('tabpanel', { name: 'Actions', exact: true });
		await expect(actionsPanel.getByRole('heading', { name: 'Actions', exact: true })).toBeVisible();
		await expect(actionsPanel.getByTestId('editor-section-action')).toHaveCSS('animation-name', 'none');
		const addAction = actionsPanel.getByRole('button', { name: 'Add action', exact: true });
		await expect(addAction).toBeAttached();
		await expect(addAction).toBeEnabled();
		await addAction.click();
		await actionsPanel.getByRole('textbox', { name: 'Name', exact: true }).fill('Glaive');
		await actionsPanel.getByRole('combobox', { name: 'Preset', exact: true }).selectOption('attack');
		await actionsPanel.getByRole('textbox', { name: 'Reach (ft.)', exact: true }).fill('10');
		await actionsPanel.getByRole('textbox', { name: 'Die count', exact: true }).fill('2');
		await actionsPanel.getByRole('textbox', { name: 'Die size', exact: true }).fill('10');
		await actionsPanel.getByRole('textbox', { name: 'Damage type', exact: true }).fill('slashing');

		const previewPane = workspace.getByRole('region', { name: /^(Preview|Live stat block preview)$/i });
		const previewActions = previewPane.getByRole('region', { name: 'Actions', exact: true });
		const actionRow = actionsPanel.getByRole('article', { name: 'Glaive, item 1 of 1', exact: true });
		await expect(previewPane.getByRole('heading', { name: 'Cinder Warden', exact: true })).toBeVisible();
		await expect(actionRow.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Glaive');
		await expect(previewActions).toContainText('Melee Weapon Attack');
		const themePicker = page.locator('.theme-picker');
		await themePicker.getByRole('button', { name: 'Toggle light/dark theme', exact: true }).hover();
		await themePicker.getByRole('tab', { name: 'Dark', exact: true }).click();
		const darkPanel = themePicker.getByRole('tabpanel', { name: 'Dark', exact: true });
		await darkPanel.getByRole('button', { name: 'Dracula', exact: true }).click();
		await page.waitForFunction(() => document.documentElement.dataset.theme === 'dracula');
		const previewRoleColors = await previewActions.locator('.preview-action').first().evaluate((element) => {
			const actionName = element.querySelector('strong');
			const inlineLabel = [...element.querySelectorAll('em')].find((em) => !em.querySelector('strong'));
			const sectionHeading = element.closest('.preview-section')?.querySelector('h3');
			return {
				actionName: actionName ? getComputedStyle(actionName).color : '',
				inlineLabel: inlineLabel ? getComputedStyle(inlineLabel).color : '',
				sectionHeading: sectionHeading ? getComputedStyle(sectionHeading).color : '',
			};
		});
		expect(previewRoleColors).toEqual({
			actionName: 'rgb(189, 147, 249)',
			inlineLabel: 'rgb(80, 250, 123)',
			sectionHeading: 'rgb(139, 233, 253)',
		});

		const previewThemeSelect = page.locator('.preview-theme-picker').getByRole('combobox', { name: 'Stat block theme', exact: true });
		const siteStateBeforePreviewTheme = await page.evaluate(() => ({
			theme: document.documentElement.dataset.theme,
			mode: document.documentElement.dataset.mode,
			preference: localStorage.getItem('theme.pref'),
		}));
		await previewThemeSelect.selectOption('monster-manual-textured');
		await expect(previewPane.locator('.stat-block')).toHaveAttribute('data-stat-block-theme', 'monster-manual-textured');
		expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(siteStateBeforePreviewTheme.theme);
		expect(await page.evaluate(() => document.documentElement.dataset.mode)).toBe(siteStateBeforePreviewTheme.mode);
		expect(await page.evaluate(() => localStorage.getItem('theme.pref'))).toBe(siteStateBeforePreviewTheme.preference);

		const siteThemePicker = page.locator('.theme-picker');
		await siteThemePicker.getByRole('button', { name: 'Toggle light/dark theme', exact: true }).hover();
		const draculaPanel = siteThemePicker.getByRole('tabpanel', { name: 'Dark', exact: true });
		await draculaPanel.getByRole('button', { name: 'Catppuccin Mocha', exact: true }).click();
		await expect(previewThemeSelect).toHaveValue('catppuccin-mocha');
		await expect(previewPane.locator('.stat-block')).toHaveAttribute('data-stat-block-theme', 'catppuccin-mocha');

		await fileActions.getByRole('button', { name: 'Export', exact: true }).click();
		const exportDialog = page.getByRole('dialog', { name: 'Export stat block', exact: true });
		await expect(exportDialog).toBeVisible();
		await exportDialog.getByRole('radio', { name: 'TOML', exact: true }).click();
		const downloadPromise = page.waitForEvent('download');
		await exportDialog.getByRole('button', { name: 'Export', exact: true }).click();
		const download = await downloadPromise;
		const exportedPath = testInfo.outputPath(download.suggestedFilename());
		await download.saveAs(exportedPath);

		await editorPane.getByRole('tab', { name: 'Basics', exact: true }).click();
		const nameInput = identityStrip.getByRole('textbox', { name: 'Name', exact: true });
		await nameInput.fill('Changed before import');
		await fileActions.getByRole('button', { name: 'Import', exact: true }).click();
		await page.getByLabel('Import TOML file').setInputFiles(exportedPath);
		await expect(nameInput).toHaveValue('Cinder Warden');
		await expect(editorPane.getByRole('tab', { name: 'Actions', exact: true })).toHaveAttribute('aria-selected', 'false');
		await editorPane.getByRole('tab', { name: 'Actions', exact: true }).click();
		await expect(actionRow.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Glaive');
		await expect(previewActions).toContainText('Melee Weapon Attack');

		const preservedMonsterName = await nameInput.inputValue();
		await page.getByLabel('Import TOML file').setInputFiles('tests/e2e/fixtures/malformed.toml');
		const toastRegion = page.getByRole('region', { name: 'Notifications', exact: true });
		await expect(toastRegion).toBeVisible();
		await expect(toastRegion.getByRole('alert')).toContainText('Unable to parse TOML');
		await expect(nameInput).toHaveValue(preservedMonsterName);
		await toastRegion.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
		await expect(toastRegion).toBeHidden();
	});

	test('enables and exports an explicit two-panel stat block', async ({ page }) => {
		const editorPane = page.getByRole('region', { name: 'Editor', exact: true });
		await editorPane.getByRole('tab', { name: 'Basics', exact: true }).click();

		const toggle = editorPane.getByRole('checkbox', { name: 'Two-column stat block', exact: true });
		await toggle.check();

		const statBlock = page.locator('.stat-block');
		await expect(statBlock).toHaveClass(/stat-block--two-column/);
		const desktopPanels = await statBlock.locator('.stat-block__panels').evaluate((element) => ({
			panelCount: element.querySelectorAll(':scope > .stat-block__panel').length,
			gridColumns: getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
		}));
		expect(desktopPanels).toEqual({ panelCount: 2, gridColumns: 2 });
		await page.setViewportSize({ width: 390, height: 844 });
		await expect.poll(() => statBlock.locator('.stat-block__panels').evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length)).toBe(1);
		await page.setViewportSize({ width: 1280, height: 900 });

		await page.getByRole('group', { name: 'File actions', exact: true }).getByRole('button', { name: 'Export', exact: true }).click();
		const exportDialog = page.getByRole('dialog', { name: 'Export stat block', exact: true });
		await exportDialog.getByRole('radio', { name: 'TOML', exact: true }).click();
		const downloadPromise = page.waitForEvent('download');
		await exportDialog.getByRole('button', { name: 'Export', exact: true }).click();
		const download = await downloadPromise;
		const content = new TextDecoder().decode(await downloadBytes(download));
		expect(content).toContain('two_column = true');
	});

	test('downloads a standalone SVG visual export from the browser path', async ({ page }) => {
		const identity = page.getByRole('region', { name: 'Identity', exact: true });
		await identity.getByRole('textbox', { name: 'Name', exact: true }).fill('Cinder Warden');
		const editorPane = page.getByRole('region', { name: 'Editor', exact: true });
		await editorPane.getByRole('tab', { name: 'Actions', exact: true }).click();
		const actionsPanel = editorPane.getByRole('tabpanel', { name: 'Actions', exact: true });
		await actionsPanel.getByRole('button', { name: 'Add action', exact: true }).click();
		const actionRow = actionsPanel.getByRole('article', { name: /item 1 of 1$/ });
		await actionRow.getByRole('textbox', { name: 'Name', exact: true }).fill('Glaive');
		await actionRow.getByRole('textbox', { name: 'Description', exact: true }).fill('A carved blade strikes with a shower of sparks.');

		const previewPane = page.getByRole('region', { name: /^(Preview|Live stat block preview)$/i });
		const previewThemeSelect = page.locator('.preview-theme-picker').getByRole('combobox', { name: 'Stat block theme', exact: true });
		await previewThemeSelect.selectOption('monster-manual-textured');
		const siteState = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, mode: document.documentElement.dataset.mode }));
		const statBlock = previewPane.locator('.stat-block');
		await expect(statBlock).toBeVisible();
		await expect(statBlock).toHaveAttribute('data-stat-block-theme', 'monster-manual-textured');
		await expect(previewPane).toContainText('Cinder Warden');
		await expect(previewPane).toContainText('A carved blade strikes with a shower of sparks.');

		await page.getByRole('group', { name: 'File actions', exact: true }).getByRole('button', { name: 'Export', exact: true }).click();
		const exportDialog = page.getByRole('dialog', { name: 'Export stat block', exact: true });
		await expect(exportDialog).toBeVisible();
		const exportThemeSelect = exportDialog.getByRole('combobox', { name: 'Export theme', exact: true });
		await expect(exportThemeSelect).toHaveValue('monster-manual-textured');
		await exportThemeSelect.selectOption('catppuccin-latte');
		await expect(previewThemeSelect).toHaveValue('monster-manual-textured');
		expect(await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, mode: document.documentElement.dataset.mode }))).toEqual(siteState);
		await exportThemeSelect.selectOption('monster-manual-textured');
		await exportDialog.getByRole('radio', { name: 'SVG', exact: true }).click();
		await expect(exportDialog.getByRole('radio', { name: 'SVG', exact: true })).toHaveAttribute('aria-checked', 'true');
		const liveBox = await waitForStableBoundingBox(statBlock, true);
		const expectedDimensions = { width: Math.ceil(liveBox.width), height: Math.ceil(liveBox.height) };
		const downloadPromise = page.waitForEvent('download');
		await exportDialog.getByRole('button', { name: 'Export', exact: true }).click();
		const download = await downloadPromise;
		const content = new TextDecoder().decode(await downloadBytes(download));
		expect(download.suggestedFilename()).toBe('cinder-warden.svg');
		const dimensions = /<svg[^>]+width="(\d+)"[^>]+height="(\d+)"[^>]+viewBox="0 0 (\d+) (\d+)"/.exec(content);
		expect(dimensions).not.toBeNull();
		expect(dimensions?.slice(1).map(Number)).toEqual([
			expectedDimensions.width,
			expectedDimensions.height,
			expectedDimensions.width,
			expectedDimensions.height,
		]);
		expect(content).toContain('<foreignObject');
		expect(content).toContain('<style>');
		expect(content).toContain('.stat-block__header');
		expect(content).toContain('data:image/svg+xml');
		expect(content).toContain('Cinder Warden');
		expect(content).toContain('A carved blade strikes with a shower of sparks.');
		expect(content).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:\/\/|blob:|\/)/i);
		expect(content).not.toMatch(/url\(\s*["']?(?:https?:\/\/|blob:|\/)/i);
		expect(content).not.toContain('srcset=');
	});

	test('downloads a standalone HTML visual export with offline assets', async ({ page }) => {
		const identity = page.getByRole('region', { name: 'Identity', exact: true });
		await identity.getByRole('textbox', { name: 'Name', exact: true }).fill('Offline HTML Warden');
		const previewPane = page.getByRole('region', { name: /^(Preview|Live stat block preview)$/i });
		const previewThemeSelect = previewPane.getByRole('combobox', { name: 'Stat block theme', exact: true });
		await previewThemeSelect.selectOption('monster-manual-textured');

		await page.getByRole('group', { name: 'File actions', exact: true }).getByRole('button', { name: 'Export', exact: true }).click();
		const exportDialog = page.getByRole('dialog', { name: 'Export stat block', exact: true });
		const exportThemeSelect = exportDialog.getByRole('combobox', { name: 'Export theme', exact: true });
		await expect(exportThemeSelect).toHaveValue('monster-manual-textured');
		await exportDialog.getByRole('radio', { name: 'HTML', exact: true }).click();
		await expect(exportDialog.getByRole('radio', { name: 'HTML', exact: true })).toHaveAttribute('aria-checked', 'true');
		const liveBox = await waitForStableBoundingBox(previewPane.locator('.stat-block'), true);
		const expectedDimensions = { width: Math.ceil(liveBox.width), height: Math.ceil(liveBox.height) };
		const downloadPromise = page.waitForEvent('download');
		await exportDialog.getByRole('button', { name: 'Export', exact: true }).click();
		const download = await downloadPromise;
		const content = new TextDecoder().decode(await downloadBytes(download));

		expect(download.suggestedFilename()).toBe('offline-html-warden.html');
		expect(content).toContain('<!doctype html>');
		expect(content).toContain('<style>');
		expect(content).toContain('.stat-block__header');
		expect(content).toContain('data:image/svg+xml');
		expect(content).toContain('Offline HTML Warden');
		const parsedHtml = await page.evaluate((markup) => {
			const document = new DOMParser().parseFromString(markup, 'text/html');
			const boundary = document.querySelector<HTMLElement>('.standalone-stat-block');
			const statBlock = boundary?.querySelector<HTMLElement>('.stat-block');
			return {
				doctype: document.doctype?.name ?? null,
				hasStatBlock: Boolean(statBlock),
				monsterText: statBlock?.textContent ?? '',
				width: boundary ? Number.parseFloat(boundary.style.width) : null,
				height: boundary ? Number.parseFloat(boundary.style.height) : null,
			};
		}, content);
		expect(parsedHtml.doctype).toBe('html');
		expect(parsedHtml.hasStatBlock).toBe(true);
		expect(parsedHtml.monsterText).toContain('Offline HTML Warden');
		expect(parsedHtml.width).toBe(expectedDimensions.width);
		expect(parsedHtml.height).toBe(expectedDimensions.height);
		expect(content).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com|https?:\/\//i);
		expect(content).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:\/\/|blob:|\/)/i);
		expect(content).not.toMatch(/url\(\s*["']?(?:https?:\/\/|blob:|\/)/i);
	});

	test('makes standalone HTML responsive while keeping standalone SVG fixed-size', async ({ page }) => {
		const editorPane = page.getByRole('region', { name: 'Editor', exact: true });
		await editorPane.getByRole('tab', { name: 'Basics', exact: true }).click();
		await editorPane.getByRole('checkbox', { name: 'Two-column stat block', exact: true }).check();

		const fileActions = page.getByRole('group', { name: 'File actions', exact: true });
		await fileActions.getByRole('button', { name: 'Export', exact: true }).click();
		let exportDialog = page.getByRole('dialog', { name: 'Export stat block', exact: true });
		await exportDialog.getByRole('radio', { name: 'HTML', exact: true }).click();
		let downloadPromise = page.waitForEvent('download');
		await exportDialog.getByRole('button', { name: 'Export', exact: true }).click();
		let download = await downloadPromise;
		const html = new TextDecoder().decode(await downloadBytes(download));

		const narrowPage = await page.context().newPage();
		await narrowPage.setViewportSize({ width: 390, height: 844 });
		await narrowPage.setContent(html);
		const htmlLayout = await narrowPage.locator('.standalone-stat-block').evaluate((wrapper) => {
			const styles = getComputedStyle(wrapper);
			const panels = wrapper.querySelector<HTMLElement>('.stat-block__panels');
			return {
				width: Number.parseFloat(styles.width),
				clientHeight: wrapper.clientHeight,
				scrollHeight: wrapper.scrollHeight,
				overflow: styles.overflow,
				gridColumns: panels ? getComputedStyle(panels).gridTemplateColumns.trim().split(/\s+/).length : 0,
			};
		});
		expect(htmlLayout.width).toBeLessThanOrEqual(390);
		expect(htmlLayout.scrollHeight).toBeLessThanOrEqual(htmlLayout.clientHeight + 1);
		expect(htmlLayout.overflow).toBe('visible');
		expect(htmlLayout.gridColumns).toBe(1);
		await narrowPage.close();

		await fileActions.getByRole('button', { name: 'Export', exact: true }).click();
		exportDialog = page.getByRole('dialog', { name: 'Export stat block', exact: true });
		await exportDialog.getByRole('radio', { name: 'SVG', exact: true }).click();
		downloadPromise = page.waitForEvent('download');
		await exportDialog.getByRole('button', { name: 'Export', exact: true }).click();
		download = await downloadPromise;
		const svg = new TextDecoder().decode(await downloadBytes(download));
		expect(svg).toContain('viewBox="0 0');
		expect(svg).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);');
		expect(svg).not.toContain('width: 100% !important');
		expect(svg).not.toContain('height: auto !important');
	});

	test('downloads a PNG visual export with binary image content', async ({ page }) => {
		const previewPane = page.getByRole('region', { name: /^(Preview|Live stat block preview)$/i });
		const statBlock = previewPane.locator('.stat-block');
		await expect(statBlock).toBeVisible();
		const fileActions = page.getByRole('group', { name: 'File actions', exact: true });
		for (const format of ['webp', 'avif'] as const) {
			await fileActions.getByRole('button', { name: 'Export', exact: true }).click();
			const exportDialog = page.getByRole('dialog', { name: 'Export stat block', exact: true });
			const label = format === 'webp' ? 'WebP' : 'AVIF';
			const formatControl = exportDialog.getByRole('radio', { name: label, exact: true });
			if (await formatControl.isDisabled()) {
				await expect(exportDialog.locator(`[data-export-format-help="${format}"]`)).toHaveText(`This browser cannot encode ${label}.`);
				await expect(formatControl).toHaveAttribute('aria-describedby', `export-format-help-${format}`);
				await exportDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
				continue;
			}
			await formatControl.click();
			const downloadPromise = page.waitForEvent('download');
			await exportDialog.getByRole('button', { name: 'Export', exact: true }).click();
			const download = await downloadPromise;
			const bytes = await downloadBytes(download);
			expect(download.suggestedFilename()).toBe(`new-monster.${format}`);
			if (format === 'webp') assertWebp(bytes);
			else assertAvif(bytes);
		}

		await fileActions.getByRole('button', { name: 'Export', exact: true }).click();
		const exportDialog = page.getByRole('dialog', { name: 'Export stat block', exact: true });
		await exportDialog.getByRole('radio', { name: 'PNG', exact: true }).click();
		await expect(exportDialog.getByRole('radio', { name: 'PNG', exact: true })).toHaveAttribute('aria-checked', 'true');
		const liveBox = await waitForStableBoundingBox(statBlock, true);
		const expectedDimensions = { width: Math.ceil(liveBox.width), height: Math.ceil(liveBox.height) };
		const downloadPromise = page.waitForEvent('download');
		await exportDialog.getByRole('button', { name: 'Export', exact: true }).click();
		const download = await downloadPromise;
		const bytes = await downloadBytes(download);

		expect(download.suggestedFilename()).toBe('new-monster.png');
		expect(bytes.byteLength).toBeGreaterThan(32);
		expect([...bytes.slice(0, PNG_SIGNATURE.length)]).toEqual(PNG_SIGNATURE);
		const png = parsePng(bytes);
		expect(png.width).toBe(expectedDimensions.width);
		expect(png.height).toBe(expectedDimensions.height);
		expect(png.chunks[0].type).toBe('IHDR');
		expect(png.chunks.at(-1)?.type).toBe('IEND');
		expect(new TextDecoder().decode(bytes.slice(0, 64))).not.toContain('data:');
	});

	test('keeps action section title rows scoped with live counts and accessible add controls', async ({ page }) => {
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });
		await editorPane.getByRole('tab', { name: 'Actions', exact: true }).click();

		const actionsPanel = editorPane.getByRole('tabpanel', { name: 'Actions', exact: true });
		const actionSection = actionsPanel.getByTestId('editor-section-action');
		const primaryHeading = editorPane.locator('#basics-heading');
		const heading = actionSection.getByRole('heading', { name: 'Actions', exact: true });
		const count = actionSection.getByLabel(/\d+ entries/);

		await expect(heading).toBeVisible();
		const repeatableHeading = actionSection.locator('.repeatable__title:is(h2)');
		const properties = ['font-size', 'color', 'letter-spacing', 'line-height'] as const;
		const titleStyles = await Promise.all(properties.map(async (property) => [
			await primaryHeading.evaluate((element, currentProperty) => getComputedStyle(element).getPropertyValue(currentProperty), property),
			await repeatableHeading.evaluate((element, currentProperty) => getComputedStyle(element).getPropertyValue(currentProperty), property),
		]));
		titleStyles.forEach(([primary, repeatable]) => expect(repeatable).toBe(primary));
		const nestedHeading = editorPane.getByTestId('editor-panel-language').locator('.repeatable__title:is(h3)');
		const nestedHeadingStyles = await nestedHeading.evaluate((element) => {
			const styles = getComputedStyle(element);
			return { fontSize: Number.parseFloat(styles.fontSize), lineHeight: styles.lineHeight };
		});
		const primaryHeadingStyles = await primaryHeading.evaluate((element) => {
			const styles = getComputedStyle(element);
			return { fontSize: Number.parseFloat(styles.fontSize), lineHeight: styles.lineHeight };
		});
		expect(nestedHeadingStyles.fontSize).toBeLessThan(primaryHeadingStyles.fontSize);
		expect(nestedHeadingStyles.lineHeight).not.toBe(primaryHeadingStyles.lineHeight);
		await expect(count).toHaveText('0');
		await expect(count).toHaveAttribute('aria-live', 'polite');
		await expect(actionSection.getByRole('status')).toContainText('No actions yet. Add the first entry to begin.');
		await expect(actionSection.getByRole('button', { name: 'Add action', exact: true })).toBeVisible();
		await actionSection.getByRole('button', { name: 'Add action', exact: true }).click();
		await expect(count).toHaveText('1');
		await actionSection.getByRole('button', { name: 'Add action', exact: true }).click();
		await expect(count).toHaveText('2');

		const rows = actionSection.getByRole('article', { name: /item \d+ of \d+$/ });
		await rows.nth(0).getByRole('textbox', { name: 'Name', exact: true }).fill('First');
		await rows.nth(1).getByRole('textbox', { name: 'Name', exact: true }).fill('Second');
		await rows.nth(0).getByRole('button', { name: 'Collapse First', exact: true }).click();
		await expect(rows.nth(0).getByRole('button', { name: 'Expand First', exact: true })).toHaveAttribute('aria-expanded', 'false');
		await expect(rows.nth(0).locator('.repeatable__body')).toHaveCount(1);
		await expect(rows.nth(0).locator('.repeatable__body')).toHaveAttribute('hidden', '');
		await expect(rows.nth(0).getByRole('textbox', { name: 'Name', exact: true })).toHaveCount(0);
		await rows.nth(0).getByRole('button', { name: 'Expand First', exact: true }).click();
		await expect(rows.nth(0).getByRole('button', { name: 'Collapse First', exact: true })).toHaveAttribute('aria-expanded', 'true');
		await expect(rows.nth(0).locator('.repeatable__body')).not.toHaveAttribute('hidden');
		await expect(rows.nth(0).getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('First');

		await rows.nth(0).getByRole('textbox', { name: 'Description', exact: true }).fill('First value');
		await rows.nth(1).getByRole('textbox', { name: 'Description', exact: true }).fill('Second value');
		await rows.nth(0).getByRole('button', { name: 'Collapse First', exact: true }).click();
		await rows.nth(1).getByRole('button', { name: 'Collapse Second', exact: true }).click();
		const dragHandle = rows.nth(0).getByRole('button', { name: 'Drag First', exact: true });
		await dragHandle.scrollIntoViewIfNeeded();
		await rows.nth(1).scrollIntoViewIfNeeded();
		const secondRowBox = await waitForStableBoundingBox(rows.nth(1));
		const dragHandleBox = await waitForStableBoundingBox(dragHandle);
		const handlePoint = { x: dragHandleBox.x + dragHandleBox.width / 2, y: dragHandleBox.y + dragHandleBox.height / 2 };
		await page.mouse.move(handlePoint.x, handlePoint.y);
		await page.mouse.down();
		await expect(rows.nth(0)).toHaveClass(/repeatable__item--dragging/);
		await page.mouse.move(secondRowBox.x + secondRowBox.width / 2, secondRowBox.y + secondRowBox.height / 2);
		await expect(actionSection.locator('[data-repeatable-live-status]')).toHaveText(/position 2/);
		await expect(actionSection.locator('[data-repeatable-insertion]')).toBeVisible();
		await expect(rows.nth(1)).toHaveClass(/repeatable__item--dragging/);
		await expect(actionSection.locator('[data-repeatable-live-status]')).not.toHaveText('');
		await page.mouse.up();
		await expect(actionSection.locator('[data-repeatable-insertion]')).not.toBeVisible();
		await expect(rows.nth(0)).toHaveAccessibleName('Second, item 1 of 2');
		await expect(rows.nth(1)).toHaveAccessibleName('First, item 2 of 2');
		await expect(rows.nth(0).getByRole('button', { name: 'Expand Second', exact: true })).toHaveAttribute('aria-expanded', 'false');
		await expect(rows.nth(1).getByRole('button', { name: 'Expand First', exact: true })).toHaveAttribute('aria-expanded', 'false');
		await rows.nth(0).getByRole('button', { name: 'Expand Second', exact: true }).click();
		await rows.nth(1).getByRole('button', { name: 'Expand First', exact: true }).click();
		await expect(rows.nth(0).getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Second');
		await expect(rows.nth(1).getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('First');
		await expect(rows.nth(0).getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('Second value');
		await expect(rows.nth(1).getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('First value');

		await rows.nth(0).getByRole('button', { name: 'Drag Second', exact: true }).focus();
		await page.keyboard.press('Space');
		await expect(rows.nth(0).getByRole('button', { name: 'Drag Second', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('ArrowDown');
		await expect(rows.nth(1)).toHaveAccessibleName('Second, item 2 of 2');
		await expect(rows.nth(1).getByRole('button', { name: 'Drag Second', exact: true })).toBeFocused();
		await expect(actionSection.locator('[data-repeatable-live-status]')).not.toHaveText('');
		await page.keyboard.press('Space');
		await expect(rows.nth(1).getByRole('button', { name: 'Drag Second', exact: true })).toHaveAttribute('aria-pressed', 'false');

		await rows.nth(0).getByRole('button', { name: 'Remove First', exact: true }).click();
		await expect(rows.nth(0)).toBeFocused();
		await expect(rows.nth(0)).toHaveAccessibleName('Second, item 1 of 1');
		await rows.nth(0).getByRole('button', { name: 'Remove Second', exact: true }).click();
		await expect(count).toHaveText('0');
		await expect(actionSection.getByRole('status')).toContainText('No actions yet. Add the first entry to begin.');
		await expect(actionSection.getByRole('button', { name: 'Add action', exact: true })).toBeFocused();
		await expect(actionSection).not.toContainText('Repeatable Field');
	});

	test('changes light and dark themes and persists the selection after reload', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await expect(page.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible({ timeout: 15000 });

		const themePicker = page.locator('.theme-picker');
		const themeTrigger = themePicker.getByRole('button', { name: 'Toggle light/dark theme', exact: true });
		const lightTab = themePicker.getByRole('tab', { name: 'Light', exact: true });
		const darkTab = themePicker.getByRole('tab', { name: 'Dark', exact: true });
		const lightPanel = themePicker.getByRole('tabpanel', { name: 'Light', exact: true });
		const darkPanel = themePicker.getByRole('tabpanel', { name: 'Dark', exact: true });

		await themeTrigger.hover();
		await expect(themeTrigger).toHaveAttribute('aria-expanded', 'true');
		await expect(lightTab).toHaveAttribute('aria-selected', 'true');
		await expect(lightPanel).toBeVisible();
		const nordLight = lightPanel.getByRole('button', { name: 'Nord Light', exact: true });
		await nordLight.click();
		await expect(nordLight).toHaveAttribute('aria-pressed', 'true');
		await page.waitForFunction(() => document.documentElement.dataset.mode === 'light');
		await page.waitForFunction(() => document.documentElement.dataset.theme === 'nord-light');

		await themeTrigger.click();
		await page.waitForFunction(() => document.documentElement.dataset.mode === 'dark');
		await expect(darkTab).toHaveAttribute('aria-selected', 'true');
		const dracula = darkPanel.getByRole('button', { name: 'Dracula', exact: true });
		await dracula.click();
		await expect(dracula).toHaveAttribute('aria-pressed', 'true');
		await page.waitForFunction(() => document.documentElement.dataset.theme === 'dracula');
		await darkPanel.hover();
		await expect(themeTrigger).toHaveAttribute('aria-expanded', 'true');
		await page.mouse.move(0, 0);
		await expect(themeTrigger).toHaveAttribute('aria-expanded', 'false');

		await page.reload();
		await page.waitForFunction(() => document.documentElement.dataset.mode === 'dark');
		await page.waitForFunction(() => document.documentElement.dataset.theme === 'dracula');
		await themeTrigger.hover();
		const persistedDracula = darkPanel.getByRole('button', { name: 'Dracula', exact: true });
		await expect(persistedDracula).toHaveAttribute('aria-pressed', 'true');
	});

	test('keeps the identity strip visible while navigating and provides scoped help', async ({ page }) => {
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });
		const identity = page.getByRole('region', { name: 'Identity', exact: true });

		await expect(editorPane.getByRole('tab', { name: 'Identity', exact: true })).toHaveCount(0);
		const identityValues = [
			['Name', 'Cinder Warden'],
			['Shortened name', 'the warden'],
			['Shortened plural', 'the wardens'],
		] as const;
		for (const [label, value] of identityValues) {
			const field = identity.getByRole('textbox', { name: label, exact: true });
			await expect(field).toBeVisible();
			await field.fill(value);
		}
		for (const tabName of ['Basics', 'Core Stats']) {
			await editorPane.getByRole('tab', { name: tabName, exact: true }).click();
			await expect(identity).toBeVisible();
		}
		const actionsTab = editorPane.getByRole('tab', { name: 'Actions', exact: true });
		await actionsTab.click();
		await expect(identity).toBeVisible();
		for (const [label, value] of identityValues) {
			await expect(identity.getByRole('textbox', { name: label, exact: true })).toHaveValue(value);
		}

		await identity.getByRole('button', { name: 'Proper noun information', exact: true }).click();
		const helpBadge = identity.getByRole('button', { name: 'Proper noun information', exact: true }).locator('.field-help__badge');
		await expect(helpBadge).toHaveCSS('width', '17px');
		await expect(helpBadge).toHaveCSS('height', '17px');
		await expect(helpBadge).toHaveCSS('border-radius', '50%');
		await expect(identity.getByRole('button', { name: 'Proper noun information', exact: true })).toHaveCSS('border-radius', '50%');
		await expect(page.getByText(/When false, prose may use 'the'/)).toBeVisible();
		await expect(identity.getByRole('button', { name: 'Proper noun information', exact: true })).toHaveCount(1);
		const helpContent = page.locator('[data-field-help-content]:visible');
		await expect(helpContent).toHaveCount(1);
		const triggerBox = await identity.getByRole('button', { name: 'Proper noun information', exact: true }).boundingBox();
		const contentBox = await helpContent.boundingBox();
		expect(contentBox && triggerBox && contentBox.y + contentBox.height).toBeLessThanOrEqual((triggerBox?.y ?? 0) + 1);
		await page.keyboard.press('Escape');

		const actionsPanel = editorPane.getByRole('tabpanel', { name: 'Actions', exact: true });
		await actionsPanel.getByRole('button', { name: 'Add action', exact: true }).click();
		const actionRow = actionsPanel.getByRole('article', { name: /item 1 of 1$/ });
		const actionNameHelp = actionRow.getByRole('button', { name: 'Name information', exact: true });
		await expect(actionNameHelp).toHaveCount(1);
		await actionNameHelp.click();
		await expect(page.getByText('The action name shown in the stat block.')).toBeVisible();
		await expect(page.locator('[data-field-help-content]:visible')).toHaveCount(1);
	});

	test('renders representative help for each editor family', async ({ page }) => {
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });

		const cases = [
			{ tab: 'Basics', button: 'Size', text: "The creature's size category" },
			{ tab: 'Core Stats', button: 'Base AC', text: "The creature's starting Armor Class" },
			{ tab: 'Proficiencies', button: 'Saving throws', text: 'Choose the ability saving throws' },
		];
		for (const item of cases) {
			await editorPane.getByRole('tab', { name: item.tab, exact: true }).click();
			const help = editorPane.getByRole('button', { name: `${item.button} information`, exact: true });
			await expect(help).toHaveCount(1);
			await help.scrollIntoViewIfNeeded();
			await help.click({ force: true });
			await expect(page.getByText(new RegExp(item.text))).toBeVisible();
			await expect(page.locator('[data-field-help-content]:visible')).toHaveCount(1);
			await page.keyboard.press('Escape');
		}

		const languagesTab = editorPane.getByRole('tab', { name: 'Languages', exact: true });
		await languagesTab.click();
		const languagesPanel = editorPane.getByRole('tabpanel', { name: 'Languages', exact: true });
		await languagesPanel.getByRole('button', { name: 'Add language', exact: true }).click();
		const languageNameHelp = languagesPanel.getByRole('button', { name: 'Name information', exact: true });
		await expect(languageNameHelp).toHaveCount(1);
		await languageNameHelp.click();
		await expect(page.getByText('The language this creature speaks or understands.')).toBeVisible();
		await expect(page.locator('[data-field-help-content]:visible')).toHaveCount(1);
	});

	test('keeps special flags and descriptions scoped to their action sections', async ({ page }) => {
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });
		await expect(editorPane.getByRole('tab', { name: 'Features', exact: true })).toHaveCount(0);
		await expect(editorPane.getByTestId('editor-panel-features')).toHaveCount(0);

		const legendaryTab = editorPane.getByRole('tab', { name: 'Legendary', exact: true });
		const villainTab = editorPane.getByRole('tab', { name: 'Villain', exact: true });
		const mythicTab = editorPane.getByRole('tab', { name: 'Mythic', exact: true });
		const legendaryPanel = editorPane.getByTestId('editor-panel-legendary_action');
		const villainPanel = editorPane.getByTestId('editor-panel-villain_action');
		const mythicPanel = editorPane.getByTestId('editor-panel-mythic_action');
		const legendaryFlag = legendaryPanel.locator('#legendary_action-enabled');
		const villainFlag = villainPanel.locator('#villain_action-enabled');
		const mythicFlag = mythicPanel.locator('#mythic_action-enabled');
		await expect(legendaryFlag).toHaveCount(1);
		await expect(villainFlag).toHaveCount(1);
		await expect(mythicFlag).toHaveCount(1);
		await legendaryTab.click();
		await legendaryFlag.check();
		await legendaryPanel.getByRole('textbox', { name: 'Legendary introduction', exact: true }).fill('A preserved legendary opening.');
		await expect(legendaryPanel.getByRole('button', { name: 'Add legendary action', exact: true })).toBeVisible();
		await villainTab.click();
		await expect(legendaryPanel).toBeHidden();
		await expect(villainPanel).toBeVisible();
		await villainFlag.check();
		await villainPanel.getByRole('textbox', { name: 'Villain introduction', exact: true }).fill('A preserved villain opening.');
		await expect(villainPanel.getByRole('button', { name: 'Villain information', exact: true })).toBeVisible();
		await villainPanel.getByRole('button', { name: 'Villain information', exact: true }).click();
		await expect(page.getByRole('link', { name: 'Official MCDM book', exact: true })).toHaveAttribute('href', 'https://shop.mcdmproductions.com/products/flee-mortals-the-mcdm-monster-book-hardcover-pdf');
		await mythicTab.click();
		await expect(mythicFlag).toBeVisible();
		await expect(mythicPanel.getByRole('button', { name: /Mythic information/ })).toHaveCount(0);
		await mythicFlag.check();
		await mythicPanel.getByRole('textbox', { name: 'Mythic introduction', exact: true }).fill('A preserved mythic opening.');
		await legendaryTab.click();
		await expect(legendaryFlag).toBeChecked();
		await expect(legendaryPanel.getByRole('textbox', { name: 'Legendary introduction', exact: true })).toHaveValue('A preserved legendary opening.');
		await villainTab.click();
		await expect(villainFlag).toBeChecked();
		await expect(villainPanel.getByRole('textbox', { name: 'Villain introduction', exact: true })).toHaveValue('A preserved villain opening.');
	});

	test('uses canonical defense selectors, orders custom values last, and gives immunity precedence', async ({ page }) => {
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });
		await editorPane.getByRole('tab', { name: 'Proficiencies', exact: true }).click();

		const proficienciesPanel = editorPane.getByRole('tabpanel', { name: 'Proficiencies', exact: true });
		const resistances = proficienciesPanel.getByRole('region', { name: 'Damage resistances', exact: true });
		const immunities = proficienciesPanel.getByRole('region', { name: 'Damage immunities', exact: true });
		const conditionImmunities = proficienciesPanel.getByRole('region', { name: 'Condition immunities', exact: true });
		const resistanceSelector = resistances.getByRole('combobox', { name: 'Add damage resistances', exact: true });
		const immunitySelector = immunities.getByRole('combobox', { name: 'Add damage immunities', exact: true });
		const conditionSelector = conditionImmunities.getByRole('combobox', { name: 'Add condition immunities', exact: true });

		await expect(resistanceSelector.getByRole('option', { name: 'Fire', exact: true })).toBeAttached();
		await expect(conditionSelector.getByRole('option', { name: 'Blinded', exact: true })).toBeAttached();
		await resistanceSelector.selectOption('fire');
		await resistanceSelector.selectOption('acid');
		await resistanceSelector.selectOption('__other__');
		await resistances.getByRole('textbox', { name: 'Custom damage resistances', exact: true }).fill('homebrew damage');
		await resistances.getByRole('button', { name: 'Add', exact: true }).click();

		const resistanceChips = resistances.getByRole('button', { name: /^Remove / });
		const firstResistanceChip = resistances.locator('.canonical-selector__chip').first();
		await expect(firstResistanceChip).toHaveCSS('border-radius', '9999px');
		await expect(firstResistanceChip).toHaveCSS('padding', '3px 5px 3px 8px');
		await expect(resistanceChips.first()).toHaveCSS('width', '22px');
		await expect(resistanceChips.first()).toHaveCSS('height', '22px');
		await expect(resistanceChips.first()).toHaveCSS('border-radius', '50%');
		await expect(resistanceChips).toHaveCount(3);
		await expect(resistanceChips.nth(0)).toHaveAccessibleName('Remove acid');
		await expect(resistanceChips.nth(1)).toHaveAccessibleName('Remove fire');
		await expect(resistanceChips.nth(2)).toHaveAccessibleName('Remove homebrew damage');

		await conditionSelector.selectOption('stunned');
		await conditionSelector.selectOption('blinded');
		const conditionChips = conditionImmunities.getByRole('button', { name: /^Remove / });
		await expect(conditionChips.nth(0)).toHaveAccessibleName('Remove blinded');
		await expect(conditionChips.nth(1)).toHaveAccessibleName('Remove stunned');

		await immunitySelector.selectOption('fire');
		await expect(immunities.getByRole('button', { name: 'Remove fire', exact: true })).toBeVisible();
		await expect(resistances.getByRole('button', { name: 'Remove fire', exact: true })).toHaveCount(0);
		const previewDefenseLabels = await page.locator('.stat-block__fields .preview-field').evaluateAll((fields) => fields
			.map((field) => field.querySelector('strong')?.textContent?.trim())
			.filter((label): label is string => ['Damage Resistances', 'Damage Immunities', 'Condition Immunities'].includes(label ?? '')));
		expect(previewDefenseLabels).toEqual(['Damage Resistances', 'Damage Immunities', 'Condition Immunities']);
	});

	test('keeps the footer compact and shell actions focused', async ({ page }) => {
		const fileActions = page.getByRole('group', { name: 'File actions', exact: true });
		await expect(fileActions.getByRole('button', { name: 'New', exact: true })).toBeVisible();
		await expect(fileActions.getByRole('button', { name: 'Import', exact: true })).toBeVisible();
		await expect(fileActions.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
		await expect(fileActions.getByRole('button', { name: 'Reset', exact: true })).toHaveCount(0);
		await expect(page.getByRole('region', { name: /drop zone/i })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: /current draft/i })).toHaveCount(0);

		const footer = page.getByRole('contentinfo', { name: 'Project information', exact: true });
		await expect(footer).toHaveCSS('position', 'static');
		const footerBox = await footer.boundingBox();
		expect(footerBox?.height).toBeLessThan(100);
		const footerParagraphBox = await footer.locator('p').boundingBox();
		const footerOffset = await page.evaluate(() => {
			const rootStyle = getComputedStyle(document.documentElement);
			return Number.parseFloat(rootStyle.getPropertyValue('--section-rail-collapsed-width')) + Number.parseFloat(rootStyle.getPropertyValue('--footer-gutter'));
		});
		expect(footerParagraphBox?.x).toBeGreaterThanOrEqual(footerOffset - 1);
		const githubLink = footer.getByRole('link', { name: 'View 5e Monster Maker on GitHub', exact: true });
		await expect(githubLink).toHaveAttribute('href', 'https://github.com/BlackHat-Magic/5e-Monster-Maker');
		await expect(githubLink).toHaveAttribute('target', '_blank');
	});

	test('keeps the icon rail overlaid, expandable, named, and free of Identity', async ({ page }) => {
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });
		const rail = editorPane.getByRole('navigation', { name: 'Monster sections', exact: true });
		const form = editorPane.getByRole('tabpanel', { name: 'Basics', exact: true });
		await expect(form).toBeVisible();
		const initialFormBox = await waitForStableBoundingBox(form);
		await expect(rail).toHaveCSS('position', 'fixed');
		await expect(rail.getByRole('tab')).toHaveCount(11);
		await expect(rail.getByRole('tab', { name: 'Identity', exact: true })).toHaveCount(0);
		const names = await rail.getByRole('tab').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')));
		expect(names).toEqual(['Basics', 'Core Stats', 'Proficiencies', 'Languages', 'Traits', 'Actions', 'Bonus Actions', 'Reactions', 'Legendary', 'Villain', 'Mythic']);

		await rail.hover();
		await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('248px');
		const expandedFormBox = await waitForStableBoundingBox(form);
		expect(expandedFormBox?.x).toBe(initialFormBox?.x);
		await rail.getByRole('tab', { name: 'Basics', exact: true }).focus();
		await expect(rail.getByRole('tab', { name: 'Basics', exact: true })).toBeFocused();
		await page.mouse.move(700, 700);
		await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('58px');
		await expect(rail.getByRole('button')).toHaveCount(0);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

		await page.setViewportSize({ width: 390, height: 844 });
		const toggle = rail.getByRole('button').first();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(rail.getByRole('tab', { name: 'Basics', exact: true })).toBeVisible();
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(rail.getByRole('tab', { name: 'Basics', exact: true })).toBeVisible();
		await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('390px');
		const openRailBox = await rail.boundingBox();
		const headerBox = await page.getByRole('banner').boundingBox();
		expect(openRailBox?.x).toBe(0);
		expect(openRailBox?.y).toBeCloseTo((headerBox?.y ?? 0) + (headerBox?.height ?? 0), 0);
		expect(openRailBox?.height).toBeCloseTo(844 - (openRailBox?.y ?? 0), 0);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('52px');
		await toggle.click();
		await rail.getByRole('tab', { name: 'Basics', exact: true }).click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('52px');
		await expect(editorPane.getByRole('tabpanel', { name: 'Basics', exact: true })).toBeVisible();
		const editorFormBox = await editorPane.getByRole('tabpanel', { name: 'Basics', exact: true }).boundingBox();
		expect(editorFormBox?.x).toBeGreaterThanOrEqual(0);
		expect((editorFormBox?.x ?? 0) + (editorFormBox?.width ?? 0)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});

	test('confirms New for an invalid numeric draft and preserves it when cancelled', async ({ page }) => {
		const editorPane = page.getByRole('region', { name: 'Editor', exact: true });
		await editorPane.getByRole('tab', { name: 'Core Stats', exact: true }).click();
		const statsPanel = editorPane.getByRole('tabpanel', { name: 'Core Stats', exact: true });
		const baseAc = statsPanel.getByRole('textbox', { name: 'Base AC', exact: true });
		await baseAc.fill('12x');

		await page.getByRole('group', { name: 'File actions', exact: true }).getByRole('button', { name: 'New', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Start a new draft?', exact: true });
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(dialog).toBeHidden();
		await expect(baseAc).toHaveValue('12x');
		await expect(baseAc).toHaveAttribute('aria-invalid', 'true');
	});

	test('hides Max Dex when Add Dexterity modifier is off and restores its value after export/import', async ({ page }, testInfo) => {
		const editorPane = page.getByRole('region', { name: 'Editor', exact: true });
		await editorPane.getByRole('tab', { name: 'Core Stats', exact: true }).click();
		const statsPanel = editorPane.getByRole('tabpanel', { name: 'Core Stats', exact: true });
		const toggle = statsPanel.getByRole('checkbox', { name: 'Add Dexterity modifier', exact: true });
		await expect(statsPanel.getByRole('button', { name: 'Add Dexterity modifier information', exact: true })).toHaveCount(0);
		await toggle.check();
		const maxDex = statsPanel.getByRole('textbox', { name: 'Max Dex', exact: true });
		const maxDexHelp = statsPanel.getByRole('button', { name: 'Max Dex information', exact: true });
		await expect(maxDexHelp).toHaveCount(1);
		await maxDex.fill('4');
		await toggle.uncheck();
		await expect(maxDex).toBeHidden();
		await expect(maxDexHelp).toHaveCount(0);

		await page.getByRole('group', { name: 'File actions', exact: true }).getByRole('button', { name: 'Export', exact: true }).click();
		const exportDialog = page.getByRole('dialog', { name: 'Export stat block', exact: true });
		await expect(exportDialog).toBeVisible();
		await exportDialog.getByRole('radio', { name: 'TOML', exact: true }).click();
		const downloadPromise = page.waitForEvent('download');
		await exportDialog.getByRole('button', { name: 'Export', exact: true }).click();
		const download = await downloadPromise;
		const exportedPath = testInfo.outputPath(download.suggestedFilename());
		await download.saveAs(exportedPath);
		await page.getByLabel('Import TOML file').setInputFiles(exportedPath);

		await expect(toggle).not.toBeChecked();
		await toggle.check();
		await expect(maxDex).toHaveValue('4');
		await expect(maxDexHelp).toHaveCount(1);
	});

	test('collapses a coarse 600px rail after section selection', async ({ browser }) => {
		const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 600, height: 844 }, hasTouch: true, isMobile: true });
		let coarsePage: Page | undefined;
		try {
			coarsePage = await context.newPage();
			await coarsePage.goto('/');
			await expect(coarsePage.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible({ timeout: 15000 });
			const editorPane = coarsePage.getByRole('region', { name: 'Editor', exact: true });
			const rail = editorPane.getByRole('navigation', { name: 'Monster sections', exact: true });
			const toggle = rail.getByRole('button').first();
			await toggle.click();
			await expect(toggle).toHaveAttribute('aria-expanded', 'true');
			await expect(toggle).toBeFocused();
			await coarsePage.keyboard.press('Tab');
			await expect(rail.getByRole('tab', { name: 'Basics', exact: true })).toBeFocused();
			await coarsePage.keyboard.press('Tab');
			await expect(toggle).toBeFocused();
			await coarsePage.keyboard.press('Shift+Tab');
			await expect(rail.getByRole('tab', { name: 'Basics', exact: true })).toBeFocused();
			await coarsePage.keyboard.press('Escape');
			await expect(toggle).toHaveAttribute('aria-expanded', 'false');
			await expect(toggle).toBeFocused();
			await toggle.click();
			await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('600px');
			const openRailBox = await rail.boundingBox();
			const headerBox = await coarsePage.getByRole('banner').boundingBox();
			expect(openRailBox?.x).toBe(0);
			expect(openRailBox?.y).toBeCloseTo((headerBox?.y ?? 0) + (headerBox?.height ?? 0), 0);
			expect(openRailBox?.height).toBeCloseTo(844 - (openRailBox?.y ?? 0), 0);
			await expect(rail.getByRole('tab', { name: 'Core Stats', exact: true })).toBeVisible();
			expect(await coarsePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
			await toggle.click();
			await expect(toggle).toHaveAttribute('aria-expanded', 'false');
			await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('52px');
			await toggle.click();
			await rail.getByRole('tab', { name: 'Core Stats', exact: true }).click();
			await expect(toggle).toHaveAttribute('aria-expanded', 'false');
			await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('52px');
			const coreStatsPanel = editorPane.getByRole('tabpanel', { name: 'Core Stats', exact: true });
			await expect(coreStatsPanel).toBeVisible();
			const formBox = await waitForStableBoundingBox(coreStatsPanel);
			expect(formBox?.x).toBeGreaterThanOrEqual(0);
			expect((formBox?.x ?? 0) + (formBox?.width ?? 0)).toBeLessThanOrEqual(await coarsePage.evaluate(() => window.innerWidth));
			expect(await coarsePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		} finally {
			await coarsePage?.close();
			await context.close();
		}
	});

	test('keeps a wide fine-pointer touch hybrid on the desktop rail', async ({ browser }) => {
		const context = await browser.newContext({ viewport: { width: 1024, height: 844 } });
		let wideTouchPage: Page | undefined;
		try {
			await context.addInitScript(() => {
				Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => 5 });
			});
			wideTouchPage = await context.newPage();
			await wideTouchPage.goto('/');
			await expect(wideTouchPage.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible({ timeout: 15000 });
			const editorPane = wideTouchPage.getByRole('region', { name: 'Editor', exact: true });
			const rail = editorPane.getByRole('navigation', { name: 'Monster sections', exact: true });
			await expect(rail.getByRole('button')).toHaveCount(0);
			await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('58px');
			await expect(editorPane.locator('.editor-workspace__form')).toHaveCSS('margin-left', '0px');
			await rail.hover();
			await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('248px');
		} finally {
			await wideTouchPage?.close();
			await context.close();
		}
	});

	test('removes the rail toggle from a wide coarse layout', async ({ browser }) => {
		const context = await browser.newContext({ viewport: { width: 1024, height: 844 }, hasTouch: true, isMobile: true });
		let wideCoarsePage: Page | undefined;
		try {
			wideCoarsePage = await context.newPage();
			await wideCoarsePage.goto('/');
			await expect(wideCoarsePage.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible({ timeout: 15000 });
			const editorPane = wideCoarsePage.getByRole('region', { name: 'Editor', exact: true });
			const rail = editorPane.getByRole('navigation', { name: 'Monster sections', exact: true });

			await expect(rail.getByRole('button')).toHaveCount(0);
			await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('58px');

		} finally {
			await wideCoarsePage?.close();
			await context.close();
		}
	});

	test('scrolls the active section heading comfortably below the header', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });
		await editorPane.getByRole('tab', { name: 'Core Stats', exact: true }).click();
		const header = page.getByRole('banner');
		const statsPanel = editorPane.getByTestId('editor-panel-stats');
		const heading = statsPanel.getByRole('heading', { name: 'Core stats', exact: true });
		await expect(heading).toBeVisible();
		await expect.poll(async () => {
			const headerBox = await header.boundingBox();
			const headingBox = await heading.boundingBox();
			const viewportHeight = await page.evaluate(() => window.innerHeight);
			return Boolean(
					headerBox && headingBox
					&& headingBox.y >= headerBox.y + headerBox.height + 16
					&& headingBox.y + headingBox.height <= viewportHeight - 16
					&& headingBox.y < viewportHeight / 2
			);
		}).toBe(true);
	});

	test('scrolls the selected Mythic heading below the configured header offset', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const editorPane = page.getByRole('region', { name: 'Editor', exact: true });
		const mythicTab = editorPane.getByRole('tab', { name: 'Mythic', exact: true });
		const mythicPanel = editorPane.getByTestId('editor-panel-mythic_action');
		const mythicHeading = mythicPanel.locator('.repeatable__title:is(h2)');
		const header = page.getByRole('banner');
		await mythicTab.click();
		await expect(mythicHeading).toBeVisible();
		await expect.poll(async () => {
			const headerBox = await header.boundingBox();
			const headingBox = await mythicHeading.boundingBox();
			return headerBox && headingBox ? Math.abs(headingBox.y - (headerBox.y + headerBox.height + 16)) : Number.POSITIVE_INFINITY;
		}).toBeLessThanOrEqual(8);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});

	test('uses one global keyboard order for all section tabs', async ({ page }) => {
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });
		const rail = editorPane.getByRole('navigation', { name: 'Monster sections', exact: true });
		const sections = ['Basics', 'Core Stats', 'Proficiencies', 'Languages', 'Traits', 'Actions', 'Bonus Actions', 'Reactions', 'Legendary', 'Villain', 'Mythic'];
		await rail.getByRole('tab', { name: 'Basics', exact: true }).focus();
		for (const section of sections.slice(1)) {
			await page.keyboard.press('ArrowDown');
			await expect(rail.getByRole('tab', { name: section, exact: true })).toHaveAttribute('aria-selected', 'true');
		}
		await page.keyboard.press('Home');
		await expect(rail.getByRole('tab', { name: 'Basics', exact: true })).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('End');
		await expect(rail.getByRole('tab', { name: 'Mythic', exact: true })).toHaveAttribute('aria-selected', 'true');
	});

	test('collapses the mobile rail after keyboard section selection and preserves focus', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });
		const rail = editorPane.getByRole('navigation', { name: 'Monster sections', exact: true });
		const toggle = rail.getByRole('button').first();

		await toggle.click();
		await rail.getByRole('tab', { name: 'Basics', exact: true }).focus();
		await page.keyboard.press('ArrowDown');
		await expect(rail.getByRole('tab', { name: 'Core Stats', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('52px');
		expect(await page.evaluate(() => document.activeElement?.id)).toBe('section-tab-stats');

		await toggle.click();
		await rail.getByRole('tab', { name: 'Core Stats', exact: true }).focus();
		await page.keyboard.press('End');
		await expect(rail.getByRole('tab', { name: 'Mythic', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(await page.evaluate(() => document.activeElement?.id)).toBe('section-tab-mythic_action');

		await toggle.click();
		await rail.getByRole('tab', { name: 'Mythic', exact: true }).focus();
		await page.keyboard.press('Home');
		await expect(rail.getByRole('tab', { name: 'Basics', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(await page.evaluate(() => document.activeElement?.id)).toBe('section-tab-basics');
	});

	test('keeps the identity controls clear of the collapsed responsive rail', async ({ page }) => {
		const identity = page.getByRole('region', { name: 'Identity', exact: true });
		const rail = page.getByRole('navigation', { name: 'Monster sections', exact: true });
		const controlNames = ['Name', 'Shortened name', 'Shortened plural'];
		for (const width of [600, 390]) {
			await page.setViewportSize({ width, height: 844 });
			const railBox = await rail.boundingBox();
			for (const name of controlNames) {
				const control = identity.getByRole('textbox', { name, exact: true });
				await expect(control).toBeVisible();
				const box = await control.boundingBox();
				expect(box?.x).toBeGreaterThanOrEqual((railBox?.x ?? 0) + (railBox?.width ?? 0));
			}
			await identity.getByRole('textbox', { name: 'Name', exact: true }).focus();
			expect(await page.evaluate(() => document.activeElement?.id)).toBe('monster-name');
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		}
	});

	test('keeps every mounted editor and preview control ID unique', async ({ page }) => {
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });
		const sections = ['Traits', 'Actions', 'Bonus Actions', 'Reactions', 'Legendary', 'Villain', 'Mythic'];

		for (const section of sections) {
			const tab = editorPane.getByRole('tab', { name: section, exact: true });
			await tab.click();
			const panel = editorPane.getByRole('tabpanel', { name: section, exact: true });
			await panel.getByRole('button', { name: /^Add / }).first().click();
		}
		await editorPane.getByRole('tab', { name: 'Actions', exact: true }).click();
		await editorPane.getByRole('tabpanel', { name: 'Actions', exact: true }).getByRole('button', { name: 'Insert a monster token', exact: true }).click();
		await editorPane.getByRole('tab', { name: 'Bonus Actions', exact: true }).click();
		await editorPane.getByRole('tabpanel', { name: 'Bonus Actions', exact: true }).getByRole('button', { name: 'Insert a monster token', exact: true }).click();

		const duplicateIds = await page.evaluate(() => {
			const counts = new Map<string, number>();
			for (const element of document.querySelectorAll('[id]')) counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
			return [...counts].filter(([, count]) => count > 1).map(([id]) => id);
		});
		expect(duplicateIds).toEqual([]);
		const missingTokenReferences = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.token-picker__dialog, .token-picker__group')]
			.flatMap((element) => [element.getAttribute('aria-labelledby'), element.getAttribute('aria-describedby')]
				.filter((value): value is string => Boolean(value))
				.flatMap((value) => value.split(/\s+/)))
			.filter((reference) => !document.getElementById(reference)));
		expect(missingTokenReferences).toEqual([]);
	});

		test('keeps the preview first in a one-column workspace at every viewport', async ({ page }) => {
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		await page.setViewportSize({ width: 1440, height: 900 });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });
		const previewPane = workspace.getByRole('region', { name: /^(Preview|Live stat block preview)$/i });
		await expect(editorPane).toBeVisible();
		await expect(previewPane).toBeVisible();
		await expect(previewPane).toHaveCSS('position', 'static');
		await expect(editorPane).toHaveCSS('display', 'block');
		expect(await page.locator('.editor-workspace__grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length)).toBe(1);
		expect(await page.locator('.editor-workspace__grid').evaluate((element) => Boolean(element.compareDocumentPosition(element.querySelector('#workspace-panel-editor')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
		expect(await page.locator('#workspace-panel-preview').evaluate((element) => Boolean(element.compareDocumentPosition(document.querySelector('#workspace-panel-editor')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
		const statBlock = page.locator('.stat-block');
		const editorForm = page.locator('.editor-workspace__form');
		await editorPane.getByRole('tab', { name: 'Actions', exact: true }).click();
		const actionsPanel = editorPane.getByRole('tabpanel', { name: 'Actions', exact: true });
		await actionsPanel.getByRole('button', { name: 'Add action', exact: true }).click();
		await actionsPanel.getByRole('textbox', { name: 'Name', exact: true }).fill('Preview action');
		await expect(statBlock).toHaveCSS('border-top-width', '3px');
		await expect(statBlock).toHaveCSS('border-radius', '4px');
		await expect(statBlock.locator('.stat-block__meta')).toHaveCSS('font-style', 'italic');
		await expect(statBlock.locator('.preview-section h3').first()).toHaveCSS('font-variant', 'small-caps');
		await expect(statBlock.locator('.preview-section h3').first()).toHaveCSS('border-bottom-width', '1px');
		const previewOrder = await statBlock.evaluate((element) => {
			const children = [...element.children];
			const challenge = children.findIndex((child) => child.classList.contains('stat-block__challenge'));
			const divider = children.findIndex((child, index) => index > challenge && child.classList.contains('stat-block__rule'));
			const section = children.findIndex((child) => child.classList.contains('preview-section'));
			return { challenge, divider, section };
		});
		expect(previewOrder.divider).toBe(previewOrder.challenge + 1);
		expect(previewOrder.divider).toBeLessThan(previewOrder.section);
		const desktopStatBlockBox = await waitForStableBoundingBox(statBlock);
		const desktopEditorFormBox = await waitForStableBoundingBox(editorForm);
		expect(desktopStatBlockBox.width).toBeLessThanOrEqual(720);
		expect(desktopEditorFormBox.width).toBeLessThanOrEqual(720);
		expect(Math.abs(desktopStatBlockBox.x + desktopStatBlockBox.width / 2 - 720)).toBeLessThanOrEqual(1);
		expect(Math.abs(desktopEditorFormBox.x + desktopEditorFormBox.width / 2 - 720)).toBeLessThanOrEqual(1);
		expect(desktopEditorFormBox.y).toBeGreaterThanOrEqual(desktopStatBlockBox.y + desktopStatBlockBox.height);
		expect(await page.evaluate(() => {
			const identity = getComputedStyle(document.querySelector('.identity-strip') as HTMLElement);
			const workspaceStyle = getComputedStyle(document.querySelector('.workspace') as HTMLElement);
			return { sameBackground: identity.backgroundColor === workspaceStyle.backgroundColor, identityRule: identity.borderBottomWidth };
		})).toEqual({ sameBackground: true, identityRule: '0px' });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

		await page.setViewportSize({ width: 390, height: 844 });
		await editorPane.getByRole('tab', { name: 'Proficiencies', exact: true }).click();
		const proficienciesPanel = editorPane.getByRole('tabpanel', { name: 'Proficiencies', exact: true });
		const resistanceSelector = proficienciesPanel.getByRole('combobox', { name: 'Add damage resistances', exact: true });
		await resistanceSelector.selectOption('__other__');
		await proficienciesPanel.getByRole('textbox', { name: 'Custom damage resistances', exact: true }).fill('a very long custom resistance value that must wrap on mobile');
		await proficienciesPanel.getByRole('button', { name: 'Add', exact: true }).click();
		await expect(proficienciesPanel.getByRole('region', { name: 'Damage resistances', exact: true }).getByRole('button', { name: /^Remove a very long custom resistance value/ })).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		await expect(editorPane).toBeVisible();
		await expect(previewPane).toBeVisible();
		const mobileStatBlockBox = await waitForStableBoundingBox(statBlock);
		const mobileEditorFormBox = await waitForStableBoundingBox(editorForm);
		expect(mobileStatBlockBox.width).toBeLessThanOrEqual(390);
		expect(mobileEditorFormBox.width).toBeLessThanOrEqual(390);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});

		test('preserves an invalid numeric draft and error across section navigation', async ({ page }) => {
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });
		const statsTab = editorPane.getByRole('tab', { name: 'Core Stats', exact: true });
		await statsTab.click();

		await expect(statsTab).toHaveAttribute('aria-selected', 'true');
		const statsPanel = editorPane.getByTestId('editor-panel-stats');
		await expect(statsPanel).toHaveAttribute('role', 'tabpanel');
		await expect(statsPanel).toHaveAccessibleName('Core Stats');
		await expect(statsPanel).toHaveAttribute('aria-hidden', 'false');
		await expect(statsPanel).toBeVisible();
		await expect(statsPanel).not.toHaveAttribute('hidden');
		await expect(statsPanel).not.toHaveAttribute('inert');
		const inactivePanels = editorPane.locator('.editor-section-panel[aria-hidden="true"]');
		await expect(inactivePanels).toHaveCount(10);
		expect(await inactivePanels.evaluateAll((panels) => panels.every((panel) => panel.hasAttribute('hidden') && panel.getAttribute('aria-hidden') === 'true' && panel.hasAttribute('inert')))).toBe(true);
		const baseAc = statsPanel.getByRole('textbox', { name: 'Base AC', exact: true });
		await baseAc.fill('12x');
		await expect(statsPanel).toContainText('Use a whole number.');

		const basicsTab = editorPane.getByRole('tab', { name: 'Basics', exact: true });
		await basicsTab.click();
		await expect(statsPanel).toBeHidden();
		await expect(statsPanel).toHaveAttribute('aria-hidden', 'true');
		await expect(statsPanel).toHaveAttribute('inert', '');
		const basicsPanel = editorPane.getByTestId('editor-panel-basics');
		await expect(basicsPanel).toBeVisible();
		await expect(basicsPanel).not.toHaveAttribute('hidden');
		await expect(basicsPanel).toHaveAttribute('aria-hidden', 'false');
		await expect(basicsPanel).not.toHaveAttribute('inert');

		await statsTab.click();
		await expect(statsTab).toHaveAttribute('aria-selected', 'true');
		await expect(statsPanel).toHaveAttribute('aria-hidden', 'false');
		await expect(statsPanel).toBeVisible();
		await expect(statsPanel).not.toHaveAttribute('hidden');
		await expect(statsPanel).not.toHaveAttribute('inert');
		await expect(baseAc).toHaveValue('12x');
		await expect(statsPanel).toContainText('Use a whole number.');
	});
});

test.describe('keyboard and motion preferences', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(page.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible({ timeout: 15000 });
	});

	test('supports keyboard theme, pane, action, and section navigation', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const workspace = page.getByRole('main', { name: 'Monster editor', exact: true });
		const editorPane = workspace.getByRole('region', { name: 'Editor', exact: true });
		const themePicker = page.locator('.theme-picker');
		const themeTrigger = themePicker.getByRole('button', { name: 'Toggle light/dark theme', exact: true });
		await themeTrigger.focus();
		await expect(themeTrigger).toHaveAttribute('aria-expanded', 'true');
		await expect(themePicker.getByRole('tab', { name: 'Light', exact: true })).toBeVisible();
		await page.keyboard.press('Enter');
		await page.waitForFunction(() => document.documentElement.dataset.mode === 'dark');
		const darkPanel = themePicker.getByRole('tabpanel', { name: 'Dark', exact: true });
		const darkPalette = darkPanel.getByRole('button', { name: 'Dracula', exact: true });
		await darkPalette.focus();
		await page.keyboard.press('Enter');
		await page.waitForFunction(() => document.documentElement.dataset.theme === 'dracula');
		await page.keyboard.press('Escape');
		await expect(themeTrigger).toHaveAttribute('aria-expanded', 'false');

		await expect(workspace.getByRole('region', { name: /^(Preview|Live stat block preview)$/i })).toBeVisible();

		const actionsTab = editorPane.getByRole('tab', { name: 'Actions', exact: true });
		await expect(actionsTab).toBeVisible();
		await actionsTab.click();
		await expect(actionsTab).toHaveAttribute('aria-selected', 'true');
		const actionsPanel = editorPane.getByRole('tabpanel', { name: 'Actions', exact: true });
		await expect(actionsPanel.getByRole('heading', { name: 'Actions', exact: true })).toBeVisible();
		const addAction = actionsPanel.getByRole('button', { name: 'Add action', exact: true });
		await addAction.focus();
		await page.keyboard.press('Enter');
		await expect(actionsPanel.getByRole('button', { name: 'Remove Actions 1', exact: true })).toBeVisible();
		const removeAction = actionsPanel.getByRole('button', { name: 'Remove Actions 1', exact: true });
		await removeAction.focus();
		await page.keyboard.press('Enter');
		await expect(actionsPanel.getByRole('status')).toContainText('No actions yet. Add the first entry to begin.');

		const basicsTab = editorPane.getByRole('tab', { name: 'Basics', exact: true });
		await basicsTab.focus();
		await page.keyboard.press('End');
		const mythicPanel = editorPane.getByRole('tabpanel', { name: 'Mythic' });
		await expect(mythicPanel.getByRole('heading', { name: 'Mythic', exact: true })).toBeVisible();
		await page.keyboard.press('Home');
		await expect(editorPane.getByRole('tabpanel', { name: 'Basics', exact: true })).toBeVisible();

		const scrollCalls = await page.evaluate(() => {
			const calls: ScrollCall[] = [];
			Element.prototype.scrollIntoView = function (options) {
				if (options && typeof options === 'object') {
					const target = this as HTMLElement;
					calls.push({ ...options, target: { tagName: target.tagName, id: target.id, className: target.className, text: target.textContent?.trim() ?? '' } });
				}
			};
			(window as Window & { __scrollCalls?: ScrollCall[] }).__scrollCalls = calls;
			return calls;
		});
		await editorPane.getByRole('tab', { name: 'Actions', exact: true }).click();
		const actionsEditorPanel = editorPane.getByRole('tabpanel', { name: 'Actions', exact: true });
		await expect(actionsEditorPanel.getByRole('heading', { name: 'Actions', exact: true })).toBeVisible();
		const activePrimaryHeading = actionsEditorPanel.getByRole('heading', { name: 'Actions', exact: true });
		const activePrimaryHeadingTarget = await activePrimaryHeading.evaluate((element) => ({ tagName: element.tagName, id: element.id, className: element.className, text: element.textContent?.trim() ?? '' }));
		await expect.poll(() => page.evaluate((expected) => (window as Window & { __scrollCalls?: ScrollCall[] }).__scrollCalls?.some((call) => call.behavior === 'auto' && call.block === 'start' && JSON.stringify(call.target) === JSON.stringify(expected)) ?? false, activePrimaryHeadingTarget)).toBe(true);
		await expect(actionsEditorPanel.getByTestId('editor-section-action')).toHaveCSS('animation-name', 'none');

		const buttonCollections = [
			page.getByRole('banner').getByRole('button'),
			workspace.getByRole('button'),
		];
		for (const buttons of buttonCollections) {
			const unnamedIconButtons = await buttons.evaluateAll((elements) => elements
				.filter((button) => button.tagName === 'BUTTON')
				.map((button) => {
					const visibleText = button instanceof HTMLElement ? button.innerText.trim() : button.textContent?.trim() ?? '';
					const accessibleName = button.getAttribute('aria-label')?.trim() || button.getAttribute('title')?.trim() || visibleText;
					return { iconOnly: !visibleText, accessibleName };
				})
				.filter(({ iconOnly, accessibleName }) => iconOnly && !accessibleName));
			expect(unnamedIconButtons).toEqual([]);
		}
		await expect(actionsEditorPanel.getByRole('button', { name: 'Add action', exact: true })).toBeEnabled();

		await themeTrigger.click();
		await page.waitForFunction(() => document.documentElement.dataset.mode === 'light');
		await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).transitionDuration)).toBe('0s');
	});
});
