import '../shared/page_boot';

import { PortalContainerContext } from '@ui-kit/hooks/usePortalContainer';
import { type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Mounts a product page on the #root its index.html provides, the same way landing_entry does.
export function mountPage(page: ReactNode) {
	const rootElem = document.getElementById('root');
	if (!rootElem) throw new Error('No #root element on the page; its index.html should provide it.');
	createRoot(rootElem).render(
		<StrictMode>
			<PortalContainerContext value={rootElem}>{page}</PortalContainerContext>
		</StrictMode>,
	);
}
