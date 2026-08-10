import { test, expect, type Locator } from '@playwright/test';

type BoundingBox = { x: number; y: number; width: number; height: number };
type ScrollCall = ScrollIntoViewOptions & {
	target: { tagName: string; id: string; className: string; text: string };
};

async function waitForStableBoundingBox(locator: Locator): Promise<BoundingBox> {
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
		await page.evaluate(() => { document.documentElement.dataset.theme = 'catppuccin-mocha'; });
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
			actionName: 'rgb(148, 226, 213)',
			inlineLabel: 'rgb(166, 227, 161)',
			sectionHeading: 'rgb(180, 190, 254)',
		});

		const downloadPromise = page.waitForEvent('download');
		await fileActions.getByRole('button', { name: 'Export', exact: true }).click();
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

		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('group', { name: 'File actions', exact: true }).getByRole('button', { name: 'Export', exact: true }).click();
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
		const coarsePage = await context.newPage();
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
		await context.close();
	});

	test('keeps a wide fine-pointer touch hybrid on the desktop rail', async ({ browser }) => {
		const context = await browser.newContext({ viewport: { width: 1024, height: 844 } });
		await context.addInitScript(() => {
			Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => 5 });
		});
		const wideTouchPage = await context.newPage();
		await wideTouchPage.goto('/');
		await expect(wideTouchPage.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible({ timeout: 15000 });
		const editorPane = wideTouchPage.getByRole('region', { name: 'Editor', exact: true });
		const rail = editorPane.getByRole('navigation', { name: 'Monster sections', exact: true });
		await expect(rail.getByRole('button')).toHaveCount(0);
		await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('58px');
		await expect(editorPane.locator('.editor-workspace__form')).toHaveCSS('margin-left', '0px');
		await rail.hover();
		await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('248px');
		await context.close();
	});

	test('removes the rail toggle from a wide coarse layout', async ({ browser }) => {
		const context = await browser.newContext({ viewport: { width: 1024, height: 844 }, hasTouch: true, isMobile: true });
		const wideCoarsePage = await context.newPage();
		await wideCoarsePage.goto('/');
		await expect(wideCoarsePage.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible({ timeout: 15000 });
		const editorPane = wideCoarsePage.getByRole('region', { name: 'Editor', exact: true });
		const rail = editorPane.getByRole('navigation', { name: 'Monster sections', exact: true });

		await expect(rail.getByRole('button')).toHaveCount(0);
		await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).width)).toBe('58px');

		await context.close();
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
