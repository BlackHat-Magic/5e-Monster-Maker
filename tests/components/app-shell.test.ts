// @vitest-environment jsdom

// Vitest runs this test in Node, while the app intentionally does not depend on Node typings.
// @ts-expect-error The test runner provides this built-in module at runtime.
import { readFileSync } from 'node:fs';
import { flushSync, mount, unmount } from 'svelte';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import AppFooter from '../../src/lib/components/app-shell/AppFooter.svelte';
import AppHeader from '../../src/lib/components/app-shell/AppHeader.svelte';
import FileActions from '../../src/lib/components/app-shell/FileActions.svelte';
import KoFiLink from '../../src/lib/components/app-shell/KoFiLink.svelte';
import ThemePicker from '../../src/lib/components/app-shell/ThemePicker.svelte';
import ToastHost from '../../src/lib/components/app-shell/ToastHost.svelte';
import { notice } from '../../src/lib/state/monster-store';

const appStyles = readFileSync('src/app.css', 'utf8');
let productionStyle: HTMLStyleElement;

beforeAll(() => {
	productionStyle = document.createElement('style');
	const toastHostRule = appStyles.match(/\.toast-host\s*\{[^}]*\}/)?.[0];
	if (!toastHostRule) throw new Error('Production ToastHost positioning rule is missing');
	productionStyle.textContent = toastHostRule;
	document.head.append(productionStyle);
});

afterAll(() => productionStyle.remove());

afterEach(() => {
	document.body.replaceChildren();
	notice.set(null);
	vi.useRealTimers();
});

describe('app shell controls', () => {
	it('keeps the 5E wordmark and removes draft and repository controls from the header', () => {
		const component = mount(AppHeader, { target: document.body });

		expect(document.querySelector('.wordmark__mark')?.textContent).toBe('5E');
		expect(document.querySelector('.draft-name')).toBeNull();
		expect(document.querySelector('a[href="https://github.com/BlackHat-Magic/5e-Monster-Maker"]')).toBeNull();
		expect(document.querySelector('[aria-label="New"]')).not.toBeNull();
		expect(document.querySelector('[aria-label="Import"]')).not.toBeNull();
		expect(document.querySelector('[aria-label="Export"]')).not.toBeNull();
		unmount(component);
	});

	it('keeps New, Import, and Export without Reset or drop-target controls', () => {
		const component = mount(FileActions, { target: document.body });

		expect(document.querySelector('[aria-label="New"]')).not.toBeNull();
		expect(document.querySelector('[aria-label="Import"]')).not.toBeNull();
		expect(document.querySelector('[aria-label="Export"]')).not.toBeNull();
		expect(document.querySelector('[aria-label="Reset"]')).toBeNull();
		expect(document.querySelector('.drop-target')).toBeNull();
		expect(document.body.textContent).not.toContain('Drop TOML');
		unmount(component);
	});

	it('renders a compact accessible Ko-fi utility link', () => {
		const component = mount(KoFiLink, { target: document.body });
		const link = document.querySelector<HTMLAnchorElement>('a');

		expect(link?.href).toBe('https://ko-fi.com/lukethenderson');
		expect(link?.target).toBe('_blank');
		expect(link?.rel).toContain('noopener');
		expect(link?.getAttribute('aria-label')).toBe('Support 5e Monster Maker on Ko-fi');
		expect(link?.textContent?.trim()).toBe('');
		unmount(component);
	});

	it('mounts a text GitHub link in the footer', () => {
		const component = mount(AppFooter, { target: document.body });
		const link = document.querySelector<HTMLAnchorElement>('footer a[href="https://github.com/BlackHat-Magic/5e-Monster-Maker"]');

		expect(link?.href).toBe('https://github.com/BlackHat-Magic/5e-Monster-Maker');
		expect(link?.textContent).toContain('GitHub');
		expect(link?.target).toBe('_blank');
		expect(link?.rel).toContain('noreferrer');
		unmount(component);
	});

	it('opens and closes the theme picker on pointer hover', () => {
		let component: ReturnType<typeof mount> | undefined;

		try {
			Object.defineProperty(window, 'matchMedia', {
				configurable: true,
				value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
			});
			component = mount(ThemePicker, { target: document.body });
			flushSync();
			const picker = document.querySelector<HTMLElement>('.theme-picker');
			const trigger = picker?.querySelector<HTMLButtonElement>(':scope > button');

			expect(trigger?.getAttribute('aria-label')).toBe('Toggle light/dark theme');
			expect(trigger?.getAttribute('title')).toBe('Toggle theme');
			expect(trigger?.getAttribute('aria-expanded')).toBe('false');

			picker?.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
			flushSync();
			expect(trigger?.getAttribute('aria-expanded')).toBe('true');
			expect(picker?.querySelector('.theme-popover')).not.toBeNull();

			picker?.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
			flushSync();
			expect(trigger?.getAttribute('aria-expanded')).toBe('false');
			expect(picker?.querySelector('.theme-popover')).toBeNull();
		} finally {
			if (component) unmount(component);
		}
	});
});

describe('ToastHost', () => {
	it('uses status and alert roles, dismisses, and auto-dismisses normal notices', () => {
		vi.useFakeTimers();
		const component = mount(ToastHost, { target: document.body });

		notice.set({ kind: 'status', message: 'Imported TOML successfully.' });
		flushSync();
		expect(document.querySelector('[data-testid="toast-notice"]')?.getAttribute('role')).toBe('status');
		vi.advanceTimersByTime(3999);
		expect(document.querySelector('[data-testid="toast-notice"]')).not.toBeNull();
		vi.advanceTimersByTime(1);
		flushSync();
		expect(document.querySelector('[data-testid="toast-notice"]')).toBeNull();

		notice.set({ kind: 'error', message: 'Unable to parse TOML.' });
		flushSync();
		expect(document.querySelector('[data-testid="toast-notice"]')?.getAttribute('role')).toBe('alert');
		(document.querySelector('[aria-label="Dismiss notification"]') as HTMLButtonElement).click();
		flushSync();
		expect(document.querySelector('[data-testid="toast-notice"]')).toBeNull();
		unmount(component);
	});

	it('pauses normal notice timing while hovered and exposes dismissible warnings', () => {
		vi.useFakeTimers();
		const onDismissWarnings = vi.fn();
		const component = mount(ToastHost, {
			target: document.body,
			props: { warnings: [{ path: 'basics.extra', message: 'Unsupported key' }], onDismissWarnings },
		});

		notice.set({ kind: 'status', message: 'Imported with warnings.' });
		flushSync();
		const host = document.querySelector<HTMLElement>('[data-testid="notice-region"]');
		host?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
		vi.advanceTimersByTime(5000);
		flushSync();
		expect(document.querySelector('[data-testid="toast-notice"]')).not.toBeNull();
		host?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
		vi.advanceTimersByTime(4000);
		flushSync();
		expect(document.querySelector('[data-testid="toast-notice"]')).toBeNull();
		expect(document.querySelector('[data-testid="import-warnings"]')?.getAttribute('role')).toBe('alert');
		(document.querySelector('.toast__dismiss') as HTMLButtonElement).click();
		expect(onDismissWarnings).toHaveBeenCalledOnce();
		unmount(component);
	});

	it('preserves remaining timeout across simultaneous hover and focus pause', () => {
		vi.useFakeTimers();
		const component = mount(ToastHost, { target: document.body });

		notice.set({ kind: 'status', message: 'Saved the current monster.' });
		flushSync();
		const host = document.querySelector<HTMLElement>('[data-testid="notice-region"]');
		expect(host).not.toBeNull();
		const hostStyle = getComputedStyle(host as HTMLElement);
		expect(hostStyle.position).toBe('fixed');
		expect(hostStyle.bottom).not.toBe('');
		expect(hostStyle.right).not.toBe('');
		expect(appStyles).toContain('env(safe-area-inset-bottom)');
		expect(appStyles).toContain('env(safe-area-inset-right)');

		vi.advanceTimersByTime(1000);
		host?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
		host?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		vi.advanceTimersByTime(5000);
		flushSync();
		expect(document.querySelector('[data-testid="toast-notice"]')).not.toBeNull();

		host?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
		vi.advanceTimersByTime(5000);
		flushSync();
		expect(document.querySelector('[data-testid="toast-notice"]')).not.toBeNull();

		host?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
		vi.advanceTimersByTime(2999);
		flushSync();
		expect(document.querySelector('[data-testid="toast-notice"]')).not.toBeNull();
		vi.advanceTimersByTime(1);
		flushSync();
		expect(document.querySelector('[data-testid="toast-notice"]')).toBeNull();
		unmount(component);
	});
});
