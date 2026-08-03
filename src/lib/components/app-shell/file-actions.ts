import { createDefaultMonster } from '$lib/monster/defaults';
import type { TomlWarning } from '$lib/monster/toml';
import type { Monster } from '$lib/monster/types';

export const IMPORT_SIZE_LIMIT = 5 * 1024 * 1024;

export function needsDraftConfirmation(draft: Monster): boolean {
	return JSON.stringify(draft) !== JSON.stringify(createDefaultMonster());
}

export function isImportTooLarge(size: number): boolean {
	return size > IMPORT_SIZE_LIMIT;
}

export function formatTomlWarning(warning: TomlWarning): string {
	return `${warning.path}: ${warning.message}`;
}
