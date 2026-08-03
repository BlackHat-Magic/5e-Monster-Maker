// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createPreviewModel } from '../../src/lib/monster/preview';
import { normalizeMonster } from '../../src/lib/monster/defaults';

describe('preview component model contract', () => {
	it('provides sanitized HTML for presentation components', () => {
		const model = createPreviewModel(normalizeMonster({ name: 'Preview fixture' }));

		expect(model.name.html).toContain('Preview fixture');
		expect(model.armorClass.html).toContain('<strong>Armor Class</strong>');
		expect(model.abilities).toHaveLength(6);
		expect(model.challenge.html).toContain('Proficiency Bonus');
	});

});
