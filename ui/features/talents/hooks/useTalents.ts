import { SavedTalents } from '@generated/proto/ui';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import { useMemo } from 'react';

export const useTalents = (): SavedTalents => {
	const talentsString = usePlayerStore('talentsString');
	return useMemo(() => SavedTalents.create({ talentsString }), [talentsString]);
};
