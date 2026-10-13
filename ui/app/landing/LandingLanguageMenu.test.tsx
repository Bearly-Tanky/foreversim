import { supportedLanguages } from '@i18n/locale_service';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingLanguageMenu } from './LandingLanguageMenu';

describe('LandingLanguageMenu', () => {
	it('opens onto every supported language, marking the current one', () => {
		render(<LandingLanguageMenu />);
		fireEvent.click(document.getElementById('languageDropdown')!);
		const items = document.querySelectorAll('.ui-landing-language-popup [data-testid="dropdown-item"]');
		expect(items).toHaveLength(Object.keys(supportedLanguages).length);
		expect(document.querySelectorAll('.ui-landing-language-popup [data-active]')).toHaveLength(1);
	});
});
