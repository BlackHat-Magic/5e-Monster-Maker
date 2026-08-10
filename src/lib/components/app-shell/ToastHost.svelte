<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { TomlWarning } from '$lib/monster/toml';
	import { notice, type Notice } from '$lib/state/monster-store';
	import { formatTomlWarning } from './file-actions';

	const NOTICE_DURATION = 4000;

	type Props = {
		warnings?: TomlWarning[];
		onDismissWarnings?: () => void;
	};

	let { warnings = [], onDismissWarnings = () => undefined }: Props = $props();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let timerStartedAt = 0;
	let remaining = NOTICE_DURATION;
	let paused = false;
	let pointerOver = false;
	let focusWithin = false;
	let activeNotice: Notice | null = null;

	function clearNoticeTimer(): void {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	function dismissNotice(): void {
		clearNoticeTimer();
		paused = false;
		notice.set(null);
	}

	function startNoticeTimer(): void {
		clearNoticeTimer();
		if (!$notice || $notice.kind !== 'status' || paused || pointerOver || focusWithin) return;
		timerStartedAt = Date.now();
		timer = setTimeout(() => {
			timer = undefined;
			remaining = NOTICE_DURATION;
			notice.set(null);
		}, remaining);
	}

	function pauseNoticeTimer(): void {
		if (!$notice || $notice.kind !== 'status' || paused) return;
		remaining = Math.max(0, remaining - (Date.now() - timerStartedAt));
		clearNoticeTimer();
		paused = true;
	}

	function resumeNoticeTimer(): void {
		if (!paused) return;
		paused = false;
		if (remaining === 0) dismissNotice();
		else startNoticeTimer();
	}

	function syncPauseState(): void {
		if (pointerOver || focusWithin) pauseNoticeTimer();
		else resumeNoticeTimer();
	}

	function handlePointerEnter(): void {
		pointerOver = true;
		syncPauseState();
	}

	function handlePointerLeave(): void {
		pointerOver = false;
		syncPauseState();
	}

	function handleFocusIn(): void {
		focusWithin = true;
		syncPauseState();
	}

	function handleFocusOut(event: FocusEvent): void {
		if (event.currentTarget instanceof HTMLElement && event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
		focusWithin = false;
		syncPauseState();
	}

	onDestroy(clearNoticeTimer);

	$effect(() => {
		const currentNotice = $notice;
		if (currentNotice === activeNotice) return;
		activeNotice = currentNotice;
		clearNoticeTimer();
		if (!currentNotice) {
			remaining = NOTICE_DURATION;
			paused = false;
			return;
		}
		remaining = NOTICE_DURATION;
		paused = pointerOver || focusWithin;
		startNoticeTimer();
	});
</script>

{#if $notice || warnings.length > 0}
	<div
		class="toast-host"
		data-testid="notice-region"
		role="region"
		aria-label="Notifications"
		aria-live="polite"
		aria-atomic="true"
		onmouseenter={handlePointerEnter}
		onmouseleave={handlePointerLeave}
		onfocusin={handleFocusIn}
		onfocusout={handleFocusOut}
	>
		{#if $notice}
			<section class:error={$notice.kind === 'error'} class="toast" data-testid="toast-notice" role={$notice.kind === 'error' ? 'alert' : 'status'}>
				<p>{$notice.message}</p>
				<button class="toast__close" type="button" aria-label="Dismiss notification" title="Dismiss notification" onclick={dismissNotice}>x</button>
			</section>
		{/if}
		{#if warnings.length > 0}
			<section class="toast toast--warnings" role="alert" aria-labelledby="import-warnings-heading" data-testid="import-warnings">
				<div class="toast__heading">
					<strong id="import-warnings-heading">Import warnings</strong>
					<button class="toast__dismiss" type="button" onclick={onDismissWarnings}>Dismiss warnings</button>
				</div>
				<ul>
					{#each warnings as warning}
						<li aria-label={formatTomlWarning(warning)}><code aria-hidden="true">{warning.path}</code><span aria-hidden="true">: {warning.message}</span></li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
{/if}
