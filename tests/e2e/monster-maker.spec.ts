import { test, expect } from '@playwright/test';

test.describe('monster authoring', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('main', { name: 'Monster authoring workspace', exact: true }).getByRole('heading', { name: 'Monster particulars', exact: true })).toBeVisible({ timeout: 15000 });
	});

	test('round-trips an edited monster through TOML and rejects malformed imports', async ({ page }, testInfo) => {
		const workspace = page.getByRole('main', { name: 'Monster authoring workspace', exact: true });
		const editorPane = workspace.getByRole('tabpanel', { name: 'Editor', exact: true });
		const identityPanel = editorPane.getByRole('tabpanel', { name: 'Identity', exact: true });
		const fileActions = page.getByRole('group', { name: 'File actions', exact: true });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await identityPanel.getByRole('textbox', { name: 'Name', exact: true }).fill('Cinder Warden');
		await editorPane.getByRole('tab', { name: /^Actions \d{2}$/, exact: true }).click();
		const actionsPanel = editorPane.getByRole('tabpanel', { name: /^Actions \d{2}$/, exact: true });
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

		const previewPane = workspace.getByRole('tabpanel', { name: /^(Preview|Live stat block preview)$/i });
		const previewActions = previewPane.getByRole('region', { name: 'Actions', exact: true });
		const actionRow = actionsPanel.getByRole('article', { name: 'Glaive, item 1 of 1', exact: true });
		await expect(previewPane.getByRole('heading', { name: 'Cinder Warden', exact: true })).toBeVisible();
		await expect(actionRow.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Glaive');
		await expect(previewActions).toContainText('Melee Weapon Attack');

		const downloadPromise = page.waitForEvent('download');
		await fileActions.getByRole('button', { name: 'Export', exact: true }).click();
		const download = await downloadPromise;
		const exportedPath = testInfo.outputPath(download.suggestedFilename());
		await download.saveAs(exportedPath);

		await editorPane.getByRole('tab', { name: 'Identity', exact: true }).click();
		const nameInput = identityPanel.getByRole('textbox', { name: 'Name', exact: true });
		await nameInput.fill('Changed before import');
		await fileActions.getByRole('button', { name: 'Import', exact: true }).click();
		await page.getByLabel('Import TOML file').setInputFiles(exportedPath);
		await expect(nameInput).toHaveValue('Cinder Warden');
		await expect(editorPane.getByRole('tab', { name: /^Actions \d{2}$/, exact: true })).toHaveAttribute('aria-selected', 'false');
		await editorPane.getByRole('tab', { name: /^Actions \d{2}$/, exact: true }).click();
		await expect(actionRow.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Glaive');
		await expect(previewActions).toContainText('Melee Weapon Attack');

		await editorPane.getByRole('tab', { name: 'Identity', exact: true }).click();
		const preservedMonsterName = await nameInput.inputValue();
		await page.getByLabel('Import TOML file').setInputFiles('tests/e2e/fixtures/malformed.toml');
		await expect(page.getByTestId('notice-region')).toContainText('Unable to parse TOML');
		await expect(nameInput).toHaveValue(preservedMonsterName);
	});

	test('changes light and dark palettes and persists the selection after reload', async ({ page }) => {
		const themeTrigger = page.getByRole('button', { name: 'Choose theme', exact: true });
		const nordLight = page.getByRole('button', { name: 'Nord Light', exact: true });
		const lightTab = page.getByRole('tab', { name: 'Light', exact: true });

		await themeTrigger.click();
		await expect(themeTrigger).toHaveAttribute('aria-expanded', 'true');
		await expect(lightTab).toBeVisible();
		await lightTab.click();
		await expect(lightTab).toHaveAttribute('aria-selected', 'true');
		await expect(nordLight).toBeVisible();
		await nordLight.click();
		await expect(nordLight).toHaveAttribute('aria-pressed', 'true');
		await page.waitForFunction(() => document.documentElement.dataset.mode === 'light');
		await page.waitForFunction(() => document.documentElement.dataset.theme === 'nord-light');

		await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
		await page.waitForFunction(() => document.documentElement.dataset.mode === 'dark');
		if (await themeTrigger.getAttribute('aria-expanded') !== 'true') await themeTrigger.click();
		await expect(themeTrigger).toHaveAttribute('aria-expanded', 'true');
		const dracula = page.getByRole('button', { name: 'Dracula', exact: true });
		await dracula.click();
		await expect(dracula).toHaveAttribute('aria-pressed', 'true');
		await page.waitForFunction(() => document.documentElement.dataset.theme === 'dracula');

		await page.reload();
		await page.waitForFunction(() => document.documentElement.dataset.mode === 'dark');
		await page.waitForFunction(() => document.documentElement.dataset.theme === 'dracula');
		await themeTrigger.click();
		const persistedDracula = page.getByRole('button', { name: 'Dracula', exact: true });
		await expect(persistedDracula).toHaveAttribute('aria-pressed', 'true');
	});

	test('keeps editor and preview columns on desktop and switches panes on mobile', async ({ page }) => {
		const workspace = page.getByRole('main', { name: 'Monster authoring workspace', exact: true });
		await page.setViewportSize({ width: 1440, height: 900 });
		const editorPane = workspace.getByRole('tabpanel', { name: 'Editor', exact: true });
		const previewPane = workspace.getByRole('tabpanel', { name: /^(Preview|Live stat block preview)$/i });
		await expect(editorPane).toBeVisible();
		await expect(previewPane).toBeVisible();
		await expect(previewPane).toHaveCSS('position', 'sticky');
		await expect(editorPane).toHaveCSS('display', 'grid');

		await page.setViewportSize({ width: 390, height: 844 });
		const editorTab = page.getByRole('tab', { name: 'Editor', exact: true });
		const previewTab = page.getByRole('tab', { name: 'Preview', exact: true });
		await expect(editorTab).toBeVisible();
		await expect(previewTab).toBeVisible();
		await expect(editorPane).toBeVisible();
		await expect(previewPane).toBeHidden();

		await previewTab.click();
		await expect(editorPane).toBeHidden();
		await expect(previewPane).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});

		test('preserves an invalid numeric draft and error across section navigation', async ({ page }) => {
		const workspace = page.getByRole('main', { name: 'Monster authoring workspace', exact: true });
		const editorPane = workspace.getByRole('tabpanel', { name: 'Editor', exact: true });
		const statsTab = editorPane.getByRole('tab', { name: 'Core Stats', exact: true });
		await statsTab.click();

		await expect(statsTab).toHaveAttribute('aria-selected', 'true');
		const statsPanel = editorPane.getByTestId('editor-panel-stats');
		await expect(statsPanel).toHaveAttribute('role', 'tabpanel');
		await expect(statsPanel).toHaveAccessibleName('Core Stats');
		await expect(statsPanel).toHaveAttribute('aria-hidden', 'false');
		await expect(statsPanel).toBeVisible();
		const baseAc = statsPanel.getByRole('textbox', { name: 'Base AC', exact: true });
		await baseAc.fill('12x');
		await expect(statsPanel).toContainText('Use a whole number.');

		const identityTab = editorPane.getByRole('tab', { name: 'Identity', exact: true });
		await identityTab.click();
		await expect(statsPanel).toBeHidden();
		await expect(statsPanel).toHaveAttribute('aria-hidden', 'true');

		await statsTab.click();
		await expect(statsTab).toHaveAttribute('aria-selected', 'true');
		await expect(statsPanel).toHaveAttribute('aria-hidden', 'false');
		await expect(statsPanel).toBeVisible();
		await expect(baseAc).toHaveValue('12x');
		await expect(statsPanel).toContainText('Use a whole number.');
	});
});

test.describe('keyboard and motion preferences', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(page.getByRole('main', { name: 'Monster authoring workspace', exact: true }).getByRole('heading', { name: 'Monster particulars', exact: true })).toBeVisible({ timeout: 15000 });
	});

	test('supports keyboard theme, pane, action, and section navigation', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const workspace = page.getByRole('main', { name: 'Monster authoring workspace', exact: true });
		const editorPane = workspace.getByRole('tabpanel', { name: 'Editor', exact: true });
		const themeTrigger = page.getByRole('button', { name: 'Choose theme', exact: true });
		await themeTrigger.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('tab', { name: 'Light', exact: true })).toBeVisible();
		await page.getByRole('tab', { name: 'Dark', exact: true }).focus();
		await page.keyboard.press('Enter');
		const darkPalette = page.getByRole('button', { name: 'Dracula', exact: true });
		await darkPalette.focus();
		await page.keyboard.press('Enter');
		await page.waitForFunction(() => document.documentElement.dataset.theme === 'dracula');
		await page.keyboard.press('Escape');
		await expect(themeTrigger).toHaveAttribute('aria-expanded', 'false');

		await workspace.getByRole('tab', { name: 'Preview', exact: true }).focus();
		await page.keyboard.press('Enter');
		await expect(workspace.getByRole('tabpanel', { name: /^(Preview|Live stat block preview)$/i })).toBeVisible();
		await workspace.getByRole('tab', { name: 'Editor', exact: true }).focus();
		await page.keyboard.press('Enter');

		const actionsTab = editorPane.getByRole('tab', { name: /^Actions \d{2}$/, exact: true });
		await expect(actionsTab).toBeVisible();
		await actionsTab.click();
		await expect(actionsTab).toHaveAttribute('aria-selected', 'true');
		const actionsPanel = editorPane.getByRole('tabpanel', { name: /^Actions \d{2}$/, exact: true });
		await expect(actionsPanel.getByRole('heading', { name: 'Actions', exact: true })).toBeVisible();
		const addAction = actionsPanel.getByRole('button', { name: 'Add action', exact: true });
		await addAction.focus();
		await page.keyboard.press('Enter');
		await expect(actionsPanel.getByRole('button', { name: 'Remove Actions 1', exact: true })).toBeVisible();
		const removeAction = actionsPanel.getByRole('button', { name: 'Remove Actions 1', exact: true });
		await removeAction.focus();
		await page.keyboard.press('Enter');
		await expect(actionsPanel.getByRole('status')).toContainText('No actions yet. Add the first entry to begin.');

		const identityTab = editorPane.getByRole('tab', { name: 'Identity', exact: true });
		await identityTab.focus();
		await page.keyboard.press('End');
		const mythicPanel = editorPane.getByRole('tabpanel', { name: /^Mythic/ });
		await expect(mythicPanel.getByRole('heading', { name: 'Mythic Actions', exact: true })).toBeVisible();
		await page.keyboard.press('Home');
		await expect(editorPane.getByRole('tabpanel', { name: 'Identity', exact: true }).getByRole('heading', { name: 'Identity', exact: true })).toBeVisible();

		const scrollCalls = await page.evaluate(() => {
			const calls: ScrollIntoViewOptions[] = [];
			Element.prototype.scrollIntoView = function (options) {
				if (options && typeof options === 'object') calls.push(options);
			};
			(window as Window & { __scrollCalls?: ScrollIntoViewOptions[] }).__scrollCalls = calls;
			return calls;
		});
		await editorPane.getByRole('tab', { name: /^Actions \d{2}$/, exact: true }).click();
		const actionsEditorPanel = editorPane.getByRole('tabpanel', { name: /^Actions \d{2}$/, exact: true });
		await expect(actionsEditorPanel.getByRole('heading', { name: 'Actions', exact: true })).toBeVisible();
		await expect.poll(() => page.evaluate(() => (window as Window & { __scrollCalls?: ScrollIntoViewOptions[] }).__scrollCalls ?? [])).toContainEqual({ behavior: 'auto', block: 'start' });
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
		await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
		await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).transitionDuration)).toBe('0s');
	});
});
